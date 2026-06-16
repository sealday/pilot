import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PiCodexAuthAdapter } from "../src/auth/pi-auth-adapter.js";
import { authCommand } from "../src/cli/commands/auth.js";

async function tempHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pilot-auth-"));
}

async function writePiAuth(homeDir: string, value: unknown): Promise<void> {
  const authPath = join(homeDir, ".pi", "agent", "auth.json");
  await Bun.write(authPath, JSON.stringify(value));
}

describe("PiCodexAuthAdapter", () => {
  test("reports missing login when auth file is absent", async () => {
    const adapter = new PiCodexAuthAdapter({ homeDir: await tempHome() });

    const status = await adapter.status();

    expect(status).toMatchObject({
      provider: "openai-codex",
      source: "pi",
      authenticated: false,
      problem: "missing-login",
    });
  });

  test("reports valid OAuth metadata without leaking tokens", async () => {
    const homeDir = await tempHome();
    await writePiAuth(homeDir, {
      "openai-codex": {
        type: "oauth",
        access: "aaa.bbb.ccc",
        refresh: "rt_secret.secret",
        expires: "2099-01-01T00:00:00.000Z",
        accountId: "acct_123456789",
      },
    });

    const status = await new PiCodexAuthAdapter({ homeDir }).status(new Date("2026-06-15T00:00:00.000Z"));

    expect(status.authenticated).toBe(true);
    expect(status.expiresAt).toBe("2099-01-01T00:00:00.000Z");
    expect(status.accountHint).toBe("acct_123456789");
    expect(JSON.stringify(status)).not.toContain("aaa.bbb.ccc");
    expect(JSON.stringify(status)).not.toContain("rt_secret.secret");
    expect(status).not.toHaveProperty("access");
    expect(status).not.toHaveProperty("refresh");
  });

  test("accepts Pi OAuth numeric expiry metadata", async () => {
    const homeDir = await tempHome();
    await writePiAuth(homeDir, {
      "openai-codex": {
        type: "oauth",
        access: "aaa.bbb.ccc",
        refresh: "rt_secret.secret",
        expires: Date.parse("2099-01-01T00:00:00.000Z"),
        accountId: "acct_123456789",
      },
    });

    const status = await new PiCodexAuthAdapter({ homeDir }).status(new Date("2026-06-15T00:00:00.000Z"));

    expect(status.authenticated).toBe(true);
    expect(status.expiresAt).toBe("2099-01-01T00:00:00.000Z");
    expect(JSON.stringify(status)).not.toContain("aaa.bbb.ccc");
    expect(JSON.stringify(status)).not.toContain("rt_secret.secret");
  });

  test("reports expired OAuth metadata as unauthenticated", async () => {
    const homeDir = await tempHome();
    await writePiAuth(homeDir, {
      "openai-codex": {
        type: "oauth",
        access: "aaa.bbb.ccc",
        refresh: "rt_secret.secret",
        expires: "2020-01-01T00:00:00.000Z",
        accountId: "acct_123456789",
      },
    });

    const status = await new PiCodexAuthAdapter({ homeDir }).status(new Date("2026-06-15T00:00:00.000Z"));

    expect(status.authenticated).toBe(false);
    expect(status.problem).toBe("expired");
    expect(status.expiresAt).toBe("2020-01-01T00:00:00.000Z");
  });

  test("reports non-OAuth provider entries as invalid", async () => {
    const homeDir = await tempHome();
    await writePiAuth(homeDir, {
      "openai-codex": {
        type: "api-key",
        apiKey: "sk-test123456789",
      },
    });

    const status = await new PiCodexAuthAdapter({ homeDir }).status();

    expect(status.authenticated).toBe(false);
    expect(status.problem).toBe("invalid-provider");
    expect(JSON.stringify(status)).not.toContain("sk-test123456789");
  });

  test("reports malformed JSON without leaking file contents", async () => {
    const homeDir = await tempHome();
    const authPath = join(homeDir, ".pi", "agent", "auth.json");
    await Bun.write(authPath, '{"openai-codex":{"refresh":"rt_secret.secret"');

    const status = await new PiCodexAuthAdapter({ homeDir }).status();

    expect(status.authenticated).toBe(false);
    expect(status.problem).toBe("invalid-auth-file");
    expect(JSON.stringify(status)).not.toContain("rt_secret.secret");
  });

  test("reports unreadable auth paths separately from malformed JSON", async () => {
    const homeDir = await tempHome();
    await mkdir(join(homeDir, ".pi", "agent", "auth.json"), { recursive: true });

    const status = await new PiCodexAuthAdapter({ homeDir }).status();

    expect(status.authenticated).toBe(false);
    expect(status.problem).toBe("auth-file-unreadable");
  });

  test("returns login and logout guidance without mutating credentials", async () => {
    const adapter = new PiCodexAuthAdapter({ homeDir: await tempHome() });

    expect(await adapter.login()).toContain("pi");
    expect(await adapter.login()).toContain("/login");
    expect(await adapter.logout()).toContain("pi");
    expect(await adapter.logout()).toContain("/logout");
  });
});

describe("authCommand", () => {
  test("auth status prefers authenticated Pi status over env fallback", async () => {
    const result = await authCommand(["status"], {
      piAdapter: {
        status: async () => ({
          provider: "openai-codex",
          source: "pi",
          authenticated: true,
          expiresAt: "2099-01-01T00:00:00.000Z",
          accountHint: "acct_123456789",
        }),
        login: async () => "login guidance",
        logout: async () => "logout guidance",
      },
      env: { OPENAI_API_KEY: "sk-test123456789" },
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('"source": "pi"');
    expect(result.output).toContain('"authenticated": true');
    expect(result.output).not.toContain("sk-test123456789");
  });

  test("auth status falls back to env when Pi is missing", async () => {
    const result = await authCommand(["status"], {
      piAdapter: {
        status: async () => ({
          provider: "openai-codex",
          source: "pi",
          authenticated: false,
          problem: "missing-login",
        }),
        login: async () => "login guidance",
        logout: async () => "logout guidance",
      },
      env: { OPENAI_API_KEY: "sk-test123456789" },
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('"source": "env"');
    expect(result.output).toContain('"authenticated": true');
    expect(result.output).not.toContain("sk-test123456789");
  });

  test("auth status preserves Pi problems when env fallback is available", async () => {
    const result = await authCommand(["status"], {
      piAdapter: {
        status: async () => ({
          provider: "openai-codex",
          source: "pi",
          authenticated: false,
          problem: "invalid-auth-file",
        }),
        login: async () => "login guidance",
        logout: async () => "logout guidance",
      },
      env: { OPENAI_API_KEY: "sk-test123456789" },
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('"source": "env"');
    expect(result.output).toContain('"piStatus"');
    expect(result.output).toContain('"problem": "invalid-auth-file"');
    expect(result.output).not.toContain("sk-test123456789");
  });

  test("auth status includes Pi login guidance when no credential is available", async () => {
    const result = await authCommand(["status"], {
      piAdapter: {
        status: async () => ({
          provider: "openai-codex",
          source: "pi",
          authenticated: false,
          problem: "missing-login",
        }),
        login: async () => "Run `pi`, then `/login`.",
        logout: async () => "Run `pi`, then `/logout`.",
      },
      env: {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("/login");
    expect(result.output).toContain("openai-codex");
    expect(result.output).not.toContain("sk-test123456789");
  });

  test("auth login and logout return Pi guidance", async () => {
    const deps = {
      piAdapter: {
        status: async () => ({
          provider: "openai-codex" as const,
          source: "pi" as const,
          authenticated: false,
          problem: "missing-login" as const,
        }),
        login: async () => "Run `pi`, then `/login`.",
        logout: async () => "Run `pi`, then `/logout`.",
      },
      env: {},
    };

    const login = await authCommand(["login"], deps);
    const logout = await authCommand(["logout"], deps);

    expect(login.exitCode).toBe(0);
    expect(login.output).toContain("/login");
    expect(logout.exitCode).toBe(0);
    expect(logout.output).toContain("/logout");
  });

  test("unknown auth subcommands fail without leaking secret-like arguments", async () => {
    const result = await authCommand(["refresh", "sk-test123456789"], {
      piAdapter: {
        status: async () => ({
          provider: "openai-codex",
          source: "pi",
          authenticated: false,
          problem: "missing-login",
        }),
        login: async () => "login guidance",
        logout: async () => "logout guidance",
      },
      env: {},
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Unknown auth command: refresh");
    expect(result.output).toContain("[REDACTED]");
    expect(result.output).not.toContain("sk-test123456789");
  });
});
