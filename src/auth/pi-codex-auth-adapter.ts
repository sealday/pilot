import type { AuthProblem, AuthStatus } from "./auth-status.js";
import { redactSecrets } from "./token-redaction.js";
import { piAuthPath } from "../storage/paths.js";
import { readJson } from "../storage/json-db.js";

const PROVIDER = "openai-codex";

export type PiCodexAuthAdapterDeps = {
  homeDir?: string;
};

type PiAuthFile = Record<string, unknown>;

type OAuthEntry = {
  type: "oauth";
  expires: string;
  accountId?: string;
};

export class PiCodexAuthAdapter {
  private readonly authPath: string;

  constructor(deps: PiCodexAuthAdapterDeps = {}) {
    this.authPath = piAuthPath(deps.homeDir === undefined ? {} : { homeDir: deps.homeDir });
  }

  async status(now = new Date()): Promise<AuthStatus> {
    let authFile: PiAuthFile | null;

    try {
      authFile = await readJson<PiAuthFile>(this.authPath);
    } catch {
      return this.statusWithProblem("invalid-auth-file");
    }

    if (authFile === null) {
      return this.statusWithProblem("missing-login");
    }

    const entry = authFile[PROVIDER];
    if (entry === undefined) {
      return this.statusWithProblem("missing-login");
    }

    if (!isOAuthEntry(entry)) {
      return this.statusWithProblem("invalid-provider");
    }

    const expiresAt = normalizeExpires(entry.expires);
    if (expiresAt === null) {
      return this.statusWithProblem("invalid-provider");
    }

    const base: AuthStatus = {
      provider: PROVIDER,
      source: "pi",
      authenticated: true,
      expiresAt,
      ...(entry.accountId ? { accountHint: entry.accountId } : {}),
    };

    if (new Date(expiresAt).getTime() <= now.getTime()) {
      return {
        ...base,
        authenticated: false,
        problem: "expired",
      };
    }

    return base;
  }

  async login(): Promise<string> {
    return redactSecrets("Run `pi` interactively, then enter `/login` to connect OpenAI Codex auth.");
  }

  async logout(): Promise<string> {
    return redactSecrets("Run `pi` interactively, then enter `/logout` to disconnect OpenAI Codex auth.");
  }

  private statusWithProblem(problem: AuthProblem): AuthStatus {
    return {
      provider: PROVIDER,
      source: "pi",
      authenticated: false,
      problem,
    };
  }
}

function isOAuthEntry(value: unknown): value is OAuthEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === "oauth" &&
    typeof value.expires === "string" &&
    (value.accountId === undefined || typeof value.accountId === "string")
  );
}

function normalizeExpires(value: string): string | null {
  const expires = new Date(value);

  if (Number.isNaN(expires.getTime())) {
    return null;
  }

  return expires.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
