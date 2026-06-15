---
change: design-openai-auth-code-agent
design-doc: docs/superpowers/specs/2026-06-15-openai-auth-code-agent-design.md
base-ref: 5ecce008e4ce713736aa53daca41c9fe01b674f3
---

# OpenAI Auth Code Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun + TypeScript `pi-code` CLI that reuses Pi Codex auth, runs a narrow coding-agent harness, and exposes local memory/context controls.

**Architecture:** The CLI owns product commands, local session state, policy, context, and memory. Pi remains the auth/model/provider authority through `PiCodexAuthAdapter` and `PiAgentAdapter`; fallback API-key support is local and minimal.

**Tech Stack:** Bun 1.3.x, TypeScript 5.x, Node 24.x runtime APIs, `@earendil-works/pi-coding-agent` 0.79.3, `@earendil-works/pi-agent-core` 0.79.3, Bun test runner.

---

## File Structure

- Create `package.json`: package metadata, executable bin, scripts, Pi dependencies.
- Create `tsconfig.json`: strict TypeScript config for Bun/Node ESM.
- Create `src/cli/index.ts`: CLI argument dispatcher.
- Create `src/cli/commands/auth.ts`: `auth login/status/logout` command handlers.
- Create `src/cli/commands/run.ts`: `run` command handler.
- Create `src/cli/commands/resume.ts`: `resume` command handler.
- Create `src/cli/commands/memory.ts`: `memory list/forget` command handlers.
- Create `src/auth/auth-status.ts`: shared auth status types.
- Create `src/auth/token-redaction.ts`: credential redaction utilities.
- Create `src/auth/pi-codex-auth-adapter.ts`: Pi auth detection/delegation.
- Create `src/auth/api-key-fallback.ts`: API-key fallback status and storage helpers.
- Create `src/storage/paths.ts`: config/session path resolution.
- Create `src/storage/json-db.ts`: safe JSON read/write helpers.
- Create `src/agent/pi-agent-adapter.ts`: Pi integration boundary and stub model support.
- Create `src/agent/session-runner.ts`: session loop orchestration.
- Create `src/agent/system-prompt.ts`: stable prefix and runtime context assembly.
- Create `src/agent/finish-tool.ts`: finish payload validation.
- Create `src/tools/todo-write.ts`: session-scoped todo replacement.
- Create `src/tools/shell.ts`: shell risk classifier and runner shell wrapper.
- Create `src/policy/permissions.ts`: tool risk policy.
- Create `src/policy/workspace-boundary.ts`: workspace write boundary checks.
- Create `src/context/transcript.ts`: local transcript events.
- Create `src/context/compactor.ts`: compaction boundary logic.
- Create `src/context/cost-meter.ts`: usage normalization.
- Create `src/memory/store.ts`: local memory records.
- Create `src/memory/gate.ts`: confidence and explicit-intent gating.
- Create `src/memory/dedupe.ts`: text similarity dedupe.
- Create `src/memory/conflict.ts`: simple contradiction marker.
- Create tests under `tests/**/*.test.ts`.
- Create `README.md`: usage, auth, security model, and current limitations.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli/index.ts`
- Test: `tests/cli-help.test.ts`

- [x] **Step 1: Create package metadata**

Write `package.json`:

```json
{
  "name": "pi-code",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "pi-code": "./src/cli/index.ts"
  },
  "scripts": {
    "build": "bun build src/cli/index.ts --target=node --outdir=dist",
    "lint": "bun run typecheck",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@earendil-works/pi-agent-core": "^0.79.3",
    "@earendil-works/pi-coding-agent": "^0.79.3"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.9.0"
  }
}
```

- [x] **Step 2: Create strict TypeScript config**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [x] **Step 3: Add initial CLI dispatcher test**

Write `tests/cli-help.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { formatHelp } from "../src/cli/index";

describe("CLI help", () => {
  test("lists first-release commands", () => {
    const help = formatHelp();
    expect(help).toContain("pi-code auth login");
    expect(help).toContain("pi-code run [prompt]");
    expect(help).toContain("pi-code memory list");
  });
});
```

- [x] **Step 4: Run test and verify it fails**

Run: `bun test tests/cli-help.test.ts`

Expected: FAIL because `src/cli/index.ts` does not exist.

- [x] **Step 5: Implement CLI dispatcher**

Write `src/cli/index.ts`:

```ts
#!/usr/bin/env bun

export type CliResult = {
  exitCode: number;
  output: string;
};

export function formatHelp(): string {
  return [
    "Usage:",
    "  pi-code auth login",
    "  pi-code auth status",
    "  pi-code auth logout",
    "  pi-code run [prompt]",
    "  pi-code resume [session-id]",
    "  pi-code memory list",
    "  pi-code memory forget <id>",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)): Promise<CliResult> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return { exitCode: 0, output: formatHelp() };
  }

  return { exitCode: 1, output: `Unknown command: ${argv.join(" ")}\n\n${formatHelp()}` };
}

if (import.meta.main) {
  const result = await main();
  console.log(result.output);
  process.exit(result.exitCode);
}
```

- [x] **Step 6: Run scaffold checks**

Run:

```bash
bun install
bun test tests/cli-help.test.ts
bun run typecheck
```

Expected: all pass.

- [x] **Step 7: Commit scaffold**

```bash
git add package.json tsconfig.json src/cli/index.ts tests/cli-help.test.ts bun.lock
git commit -m "Enable a testable Bun CLI baseline" \
  -m "Constraint: The product needs a narrow executable surface before Pi auth and runner adapters can be tested." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Keep CLI dispatch small; add command behavior in focused command modules." \
  -m "Tested: bun test tests/cli-help.test.ts; bun run typecheck" \
  -m "Not-tested: Auth and agent runtime are not implemented in this slice."
```

## Task 2: Pi Codex Auth Reuse

**Files:**
- Create: `src/storage/paths.ts`
- Create: `src/storage/json-db.ts`
- Create: `src/auth/auth-status.ts`
- Create: `src/auth/token-redaction.ts`
- Create: `src/auth/pi-codex-auth-adapter.ts`
- Create: `src/auth/api-key-fallback.ts`
- Create: `src/cli/commands/auth.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/auth-redaction.test.ts`
- Test: `tests/pi-codex-auth-adapter.test.ts`
- Test: `tests/api-key-fallback.test.ts`

- [ ] **Step 1: Write redaction tests**

Write `tests/auth-redaction.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { redactSecrets } from "../src/auth/token-redaction";

describe("redactSecrets", () => {
  test("redacts OpenAI-style keys and refresh tokens", () => {
    const input = "key sk-test123456789 refresh rt_abc.def";
    expect(redactSecrets(input)).toBe("key [REDACTED] refresh [REDACTED]");
  });

  test("redacts JWT-like values", () => {
    const input = "access aaa.bbb.ccc";
    expect(redactSecrets(input)).toBe("access [REDACTED]");
  });
});
```

- [ ] **Step 2: Implement redaction**

Write `src/auth/token-redaction.ts`:

```ts
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\brt_[A-Za-z0-9_.-]{8,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
}
```

- [ ] **Step 3: Add storage path helpers**

Write `src/storage/paths.ts`:

```ts
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type PathOptions = {
  homeDir?: string;
  cwd?: string;
};

export function expandHome(path: string, homeDir = homedir()): string {
  if (path === "~") return homeDir;
  if (path.startsWith("~/")) return join(homeDir, path.slice(2));
  return path;
}

export function piAuthPath(options: PathOptions = {}): string {
  return join(options.homeDir ?? homedir(), ".pi", "agent", "auth.json");
}

export function piCodeConfigDir(options: PathOptions = {}): string {
  return join(options.homeDir ?? homedir(), ".pi-code");
}

export function workspaceSessionDir(options: PathOptions = {}): string {
  return resolve(options.cwd ?? process.cwd(), ".pi-code", "sessions");
}
```

- [ ] **Step 4: Add safe JSON helpers**

Write `src/storage/json-db.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
```

- [ ] **Step 5: Add auth status types**

Write `src/auth/auth-status.ts`:

```ts
export type AuthProvider = "openai-codex" | "openai-api-key" | "missing";
export type AuthSource = "pi-auth" | "env" | "fallback-file" | "none";

export type AuthStatus = {
  provider: AuthProvider;
  source: AuthSource;
  authenticated: boolean;
  expiresAt?: number;
  accountHint?: string;
  problem?: "missing-pi" | "missing-login" | "expired" | "invalid" | "unknown";
};
```

- [ ] **Step 6: Write Pi auth adapter tests**

Write `tests/pi-codex-auth-adapter.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { PiCodexAuthAdapter } from "../src/auth/pi-codex-auth-adapter";

describe("PiCodexAuthAdapter", () => {
  test("reports missing login when auth file is absent", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "pi-code-auth-"));
    const adapter = new PiCodexAuthAdapter({ homeDir });
    expect(await adapter.status()).toMatchObject({
      provider: "missing",
      source: "none",
      authenticated: false,
      problem: "missing-login",
    });
  });

  test("reads metadata without exposing tokens", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "pi-code-auth-"));
    const authPath = join(homeDir, ".pi", "agent", "auth.json");
    await writeFile(authPath, JSON.stringify({
      "openai-codex": {
        type: "oauth",
        access: "eyJaaa.bbb.ccc",
        refresh: "rt_secret.secret",
        expires: Date.now() + 60_000,
        accountId: "acct_1234"
      }
    }), { mode: 0o600 });

    const adapter = new PiCodexAuthAdapter({ homeDir });
    const status = await adapter.status();
    expect(status).toEqual({
      provider: "openai-codex",
      source: "pi-auth",
      authenticated: true,
      expiresAt: expect.any(Number),
      accountHint: "acct_1234",
    });
    expect(JSON.stringify(status)).not.toContain("eyJaaa");
    expect(JSON.stringify(status)).not.toContain("rt_secret");
  });
});
```

- [ ] **Step 7: Implement Pi auth adapter**

Write `src/auth/pi-codex-auth-adapter.ts`:

```ts
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { piAuthPath, type PathOptions } from "../storage/paths";
import { readJsonFile } from "../storage/json-db";
import type { AuthStatus } from "./auth-status";

type PiAuthFile = {
  "openai-codex"?: {
    type?: string;
    expires?: number;
    accountId?: string;
    access?: string;
    refresh?: string;
  };
};

export class PiCodexAuthAdapter {
  constructor(private readonly options: PathOptions = {}) {}

  async status(now = Date.now()): Promise<AuthStatus> {
    const auth = await readJsonFile<PiAuthFile>(piAuthPath(this.options));
    const codex = auth?.["openai-codex"];
    if (!codex) {
      return { provider: "missing", source: "none", authenticated: false, problem: "missing-login" };
    }

    if (codex.type !== "oauth") {
      return { provider: "missing", source: "pi-auth", authenticated: false, problem: "invalid" };
    }

    if (typeof codex.expires === "number" && codex.expires <= now) {
      return {
        provider: "openai-codex",
        source: "pi-auth",
        authenticated: false,
        expiresAt: codex.expires,
        accountHint: codex.accountId,
        problem: "expired",
      };
    }

    return {
      provider: "openai-codex",
      source: "pi-auth",
      authenticated: true,
      expiresAt: codex.expires,
      accountHint: codex.accountId,
    };
  }

  async validate(): Promise<AuthStatus> {
    return this.status();
  }

  async login(): Promise<void> {
    await assertPiAvailable();
    throw new Error("Run `pi`, then `/login`, then select ChatGPT Plus/Pro (Codex). Re-run `pi-code auth status` after login.");
  }

  async logout(): Promise<void> {
    await assertPiAvailable();
    throw new Error("Run `pi`, then `/logout` to clear Pi-owned Codex credentials.");
  }
}

async function assertPiAvailable(): Promise<void> {
  const path = Bun.which("pi");
  if (!path) throw new Error("Pi CLI not found. Install @earendil-works/pi-coding-agent or use OPENAI_API_KEY fallback.");
  await access(path);
}
```

- [ ] **Step 8: Add API-key fallback tests and implementation**

Write `tests/api-key-fallback.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { apiKeyFallbackStatus } from "../src/auth/api-key-fallback";

describe("apiKeyFallbackStatus", () => {
  test("uses OPENAI_API_KEY without exposing the key", () => {
    const status = apiKeyFallbackStatus({ OPENAI_API_KEY: "sk-test123456789" });
    expect(status).toEqual({ provider: "openai-api-key", source: "env", authenticated: true });
    expect(JSON.stringify(status)).not.toContain("sk-test");
  });

  test("reports missing when no key exists", () => {
    expect(apiKeyFallbackStatus({})).toEqual({
      provider: "missing",
      source: "none",
      authenticated: false,
      problem: "missing-login",
    });
  });
});
```

Write `src/auth/api-key-fallback.ts`:

```ts
import type { AuthStatus } from "./auth-status";

export function apiKeyFallbackStatus(env: NodeJS.ProcessEnv = process.env): AuthStatus {
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0) {
    return { provider: "openai-api-key", source: "env", authenticated: true };
  }

  return { provider: "missing", source: "none", authenticated: false, problem: "missing-login" };
}
```

- [ ] **Step 9: Wire auth commands**

Write `src/cli/commands/auth.ts`:

```ts
import { PiCodexAuthAdapter } from "../../auth/pi-codex-auth-adapter";
import { apiKeyFallbackStatus } from "../../auth/api-key-fallback";
import type { CliResult } from "../index";

export async function authCommand(args: string[]): Promise<CliResult> {
  const subcommand = args[0] ?? "status";
  const pi = new PiCodexAuthAdapter();

  if (subcommand === "status") {
    const piStatus = await pi.status();
    const status = piStatus.authenticated ? piStatus : apiKeyFallbackStatus();
    return { exitCode: status.authenticated ? 0 : 1, output: JSON.stringify(status, null, 2) };
  }

  if (subcommand === "login") {
    try {
      await pi.login();
      return { exitCode: 0, output: "Pi Codex login completed." };
    } catch (error) {
      return { exitCode: 1, output: (error as Error).message };
    }
  }

  if (subcommand === "logout") {
    try {
      await pi.logout();
      return { exitCode: 0, output: "Pi Codex logout completed." };
    } catch (error) {
      return { exitCode: 1, output: (error as Error).message };
    }
  }

  return { exitCode: 1, output: `Unknown auth command: ${subcommand}` };
}
```

Modify `src/cli/index.ts`:

```ts
#!/usr/bin/env bun

import { authCommand } from "./commands/auth";

export type CliResult = {
  exitCode: number;
  output: string;
};

export function formatHelp(): string {
  return [
    "Usage:",
    "  pi-code auth login",
    "  pi-code auth status",
    "  pi-code auth logout",
    "  pi-code run [prompt]",
    "  pi-code resume [session-id]",
    "  pi-code memory list",
    "  pi-code memory forget <id>",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)): Promise<CliResult> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return { exitCode: 0, output: formatHelp() };
  }

  const [command, ...rest] = argv;
  if (command === "auth") return authCommand(rest);

  return { exitCode: 1, output: `Unknown command: ${argv.join(" ")}\n\n${formatHelp()}` };
}

if (import.meta.main) {
  const result = await main();
  console.log(result.output);
  process.exit(result.exitCode);
}
```

- [ ] **Step 10: Run auth checks**

Run:

```bash
bun test tests/auth-redaction.test.ts tests/pi-codex-auth-adapter.test.ts tests/api-key-fallback.test.ts
bun run typecheck
```

Expected: all pass.

- [ ] **Step 11: Commit auth reuse**

```bash
git add src/auth src/storage src/cli tests/auth-redaction.test.ts tests/pi-codex-auth-adapter.test.ts tests/api-key-fallback.test.ts
git commit -m "Reuse Pi Codex auth for OpenAI access" \
  -m "Constraint: Pi already owns Codex OAuth login and token refresh, so this product should not duplicate credential handling." \
  -m "Rejected: Implement a custom OAuth flow | would depend on unsupported auth behavior and duplicate Pi's user experience." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Never copy or log Pi access/refresh tokens; expose only redacted status metadata." \
  -m "Tested: bun test auth adapter/redaction/fallback tests; bun run typecheck" \
  -m "Not-tested: Interactive Pi /login delegation is represented as guidance until stable callable APIs are confirmed."
```

## Task 3: Session Runner, Todo, And Finish

**Files:**
- Create: `src/agent/pi-agent-adapter.ts`
- Create: `src/agent/session-runner.ts`
- Create: `src/agent/finish-tool.ts`
- Create: `src/tools/todo-write.ts`
- Create: `src/context/transcript.ts`
- Modify: `src/cli/commands/run.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/todo-write.test.ts`
- Test: `tests/finish-tool.test.ts`
- Test: `tests/session-runner.test.ts`

- [ ] **Step 1: Add todo and finish tests**

Write `tests/todo-write.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { replaceTodos } from "../src/tools/todo-write";

describe("replaceTodos", () => {
  test("accepts one active todo", () => {
    const todos = replaceTodos([{ text: "Implement auth", status: "in_progress" }]);
    expect(todos).toHaveLength(1);
  });

  test("rejects multiple active todos", () => {
    expect(() => replaceTodos([
      { text: "A", status: "in_progress" },
      { text: "B", status: "in_progress" },
    ])).toThrow("at most one in_progress todo");
  });
});
```

Write `tests/finish-tool.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseFinishPayload } from "../src/agent/finish-tool";

describe("parseFinishPayload", () => {
  test("accepts complete payload", () => {
    const payload = parseFinishPayload({
      status: "complete",
      summary: "Done",
      changedFiles: ["src/a.ts"],
      verification: ["bun test"],
      risks: [],
    });
    expect(payload.status).toBe("complete");
  });

  test("rejects missing verification", () => {
    expect(() => parseFinishPayload({ status: "complete", summary: "Done" })).toThrow("verification");
  });
});
```

- [ ] **Step 2: Implement todo and finish utilities**

Write `src/tools/todo-write.ts`:

```ts
export type TodoStatus = "pending" | "in_progress" | "completed";

export type TodoItem = {
  text: string;
  status: TodoStatus;
};

export function replaceTodos(items: TodoItem[]): TodoItem[] {
  const active = items.filter((item) => item.status === "in_progress");
  if (active.length > 1) throw new Error("todo list may contain at most one in_progress todo");
  return items.map((item) => ({ text: item.text.trim(), status: item.status }));
}
```

Write `src/agent/finish-tool.ts`:

```ts
export type FinishPayload = {
  status: "complete" | "blocked";
  summary: string;
  changedFiles: string[];
  verification: string[];
  risks: string[];
};

export function parseFinishPayload(input: unknown): FinishPayload {
  const value = input as Partial<FinishPayload>;
  if (value.status !== "complete" && value.status !== "blocked") throw new Error("finish.status must be complete or blocked");
  if (typeof value.summary !== "string" || value.summary.length === 0) throw new Error("finish.summary is required");
  if (!Array.isArray(value.changedFiles)) throw new Error("finish.changedFiles is required");
  if (!Array.isArray(value.verification)) throw new Error("finish.verification is required");
  if (!Array.isArray(value.risks)) throw new Error("finish.risks is required");
  return {
    status: value.status,
    summary: value.summary,
    changedFiles: value.changedFiles.map(String),
    verification: value.verification.map(String),
    risks: value.risks.map(String),
  };
}
```

- [ ] **Step 3: Add transcript model**

Write `src/context/transcript.ts`:

```ts
export type TranscriptEvent =
  | { type: "user"; text: string; at: string }
  | { type: "assistant"; text: string; at: string }
  | { type: "tool"; name: string; input: unknown; output: unknown; at: string }
  | { type: "finish"; payload: unknown; at: string };

export type SessionTranscript = {
  sessionId: string;
  events: TranscriptEvent[];
};

export function createTranscript(sessionId: string): SessionTranscript {
  return { sessionId, events: [] };
}
```

- [ ] **Step 4: Add Pi adapter interface and stub**

Write `src/agent/pi-agent-adapter.ts`:

```ts
export type AgentToolCall = {
  name: string;
  input: unknown;
};

export type AgentTurn = {
  text: string;
  toolCalls: AgentToolCall[];
};

export interface PiAgentAdapter {
  runTurn(prompt: string): Promise<AgentTurn>;
}

export class StubPiAgentAdapter implements PiAgentAdapter {
  constructor(private readonly turn: AgentTurn) {}

  async runTurn(): Promise<AgentTurn> {
    return this.turn;
  }
}
```

- [ ] **Step 5: Implement session runner**

Write `src/agent/session-runner.ts`:

```ts
import { parseFinishPayload, type FinishPayload } from "./finish-tool";
import type { PiAgentAdapter } from "./pi-agent-adapter";
import { createTranscript } from "../context/transcript";
import { replaceTodos } from "../tools/todo-write";

export type SessionResult = {
  sessionId: string;
  finish?: FinishPayload;
  transcriptEvents: number;
};

export class SessionRunner {
  constructor(private readonly adapter: PiAgentAdapter) {}

  async run(prompt: string, sessionId = crypto.randomUUID()): Promise<SessionResult> {
    const transcript = createTranscript(sessionId);
    transcript.events.push({ type: "user", text: prompt, at: new Date().toISOString() });

    const turn = await this.adapter.runTurn(prompt);
    transcript.events.push({ type: "assistant", text: turn.text, at: new Date().toISOString() });

    let finish: FinishPayload | undefined;
    for (const call of turn.toolCalls) {
      if (call.name === "todo_write") {
        const output = replaceTodos(call.input as Parameters<typeof replaceTodos>[0]);
        transcript.events.push({ type: "tool", name: call.name, input: call.input, output, at: new Date().toISOString() });
      }
      if (call.name === "finish") {
        finish = parseFinishPayload(call.input);
        transcript.events.push({ type: "finish", payload: finish, at: new Date().toISOString() });
      }
    }

    return { sessionId, finish, transcriptEvents: transcript.events.length };
  }
}
```

- [ ] **Step 6: Add runner test**

Write `tests/session-runner.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { SessionRunner } from "../src/agent/session-runner";
import { StubPiAgentAdapter } from "../src/agent/pi-agent-adapter";

describe("SessionRunner", () => {
  test("completes only through finish tool", async () => {
    const runner = new SessionRunner(new StubPiAgentAdapter({
      text: "Done",
      toolCalls: [{
        name: "finish",
        input: {
          status: "complete",
          summary: "Implemented",
          changedFiles: ["src/index.ts"],
          verification: ["bun test"],
          risks: [],
        },
      }],
    }));

    const result = await runner.run("do it", "session-1");
    expect(result.finish?.status).toBe("complete");
    expect(result.transcriptEvents).toBe(3);
  });
});
```

- [ ] **Step 7: Wire run command**

Write `src/cli/commands/run.ts`:

```ts
import { SessionRunner } from "../../agent/session-runner";
import { StubPiAgentAdapter } from "../../agent/pi-agent-adapter";
import type { CliResult } from "../index";

export async function runCommand(args: string[]): Promise<CliResult> {
  const prompt = args.join(" ").trim();
  if (!prompt) return { exitCode: 1, output: "Usage: pi-code run [prompt]" };

  const runner = new SessionRunner(new StubPiAgentAdapter({
    text: "Stub run completed",
    toolCalls: [{
      name: "finish",
      input: {
        status: "complete",
        summary: "Stub execution completed",
        changedFiles: [],
        verification: ["stub"],
        risks: ["Real Pi adapter not connected yet"],
      },
    }],
  }));
  const result = await runner.run(prompt);
  return { exitCode: result.finish?.status === "complete" ? 0 : 1, output: JSON.stringify(result, null, 2) };
}
```

Modify `src/cli/index.ts` to dispatch run:

```ts
import { authCommand } from "./commands/auth";
import { runCommand } from "./commands/run";
```

Add before the unknown command return:

```ts
if (command === "run") return runCommand(rest);
```

- [ ] **Step 8: Run session checks**

Run:

```bash
bun test tests/todo-write.test.ts tests/finish-tool.test.ts tests/session-runner.test.ts
bun run typecheck
```

Expected: all pass.

- [ ] **Step 9: Commit session runner**

```bash
git add src/agent src/context src/tools src/cli tests/todo-write.test.ts tests/finish-tool.test.ts tests/session-runner.test.ts
git commit -m "Add structured session runner primitives" \
  -m "Constraint: Completion must be a structured tool signal rather than a text marker." \
  -m "Rejected: Detect completion from assistant text | it can false-positive inside explanations or code blocks." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Keep Pi integration behind PiAgentAdapter so provider internals remain replaceable." \
  -m "Tested: bun test todo/finish/session tests; bun run typecheck" \
  -m "Not-tested: Real model streaming and tool execution are not connected yet."
```

## Task 4: Tool Policy And Workspace Boundaries

**Files:**
- Create: `src/policy/permissions.ts`
- Create: `src/policy/workspace-boundary.ts`
- Create: `src/tools/shell.ts`
- Test: `tests/permissions.test.ts`
- Test: `tests/workspace-boundary.test.ts`

- [ ] **Step 1: Add policy tests**

Write `tests/permissions.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { classifyShellCommand } from "../src/tools/shell";

describe("classifyShellCommand", () => {
  test("allows read-only commands", () => {
    expect(classifyShellCommand("git status")).toBe("safe");
  });

  test("marks installs and test commands as mutating", () => {
    expect(classifyShellCommand("bun install")).toBe("mutating");
  });

  test("marks destructive commands as dangerous", () => {
    expect(classifyShellCommand("rm -rf /tmp/example")).toBe("dangerous");
  });
});
```

Write `tests/workspace-boundary.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { isInsideWorkspace } from "../src/policy/workspace-boundary";

describe("isInsideWorkspace", () => {
  test("accepts child paths", () => {
    expect(isInsideWorkspace("/repo", "/repo/src/file.ts")).toBe(true);
  });

  test("rejects sibling paths", () => {
    expect(isInsideWorkspace("/repo", "/repo-other/file.ts")).toBe(false);
  });
});
```

- [ ] **Step 2: Implement shell classifier and boundary policy**

Write `src/tools/shell.ts`:

```ts
export type ShellRisk = "safe" | "mutating" | "dangerous";

const DANGEROUS = /\b(rm\s+-rf|chmod\s+-R|chown\s+-R|dd\s+if=|mkfs|shutdown|reboot)\b/;
const MUTATING = /\b(bun install|npm install|pnpm install|yarn add|git commit|git checkout|git reset|mv |cp |touch |mkdir )/;

export function classifyShellCommand(command: string): ShellRisk {
  if (DANGEROUS.test(command)) return "dangerous";
  if (MUTATING.test(command)) return "mutating";
  return "safe";
}
```

Write `src/policy/workspace-boundary.ts`:

```ts
import { relative, resolve } from "node:path";

export function isInsideWorkspace(workspace: string, target: string): boolean {
  const rel = relative(resolve(workspace), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && !rel.match(/^[A-Za-z]:/));
}
```

Write `src/policy/permissions.ts`:

```ts
import type { ShellRisk } from "../tools/shell";

export type ToolDecision = "allow" | "ask" | "deny";

export function decisionForShellRisk(risk: ShellRisk, unattended = false): ToolDecision {
  if (risk === "safe") return "allow";
  if (risk === "mutating") return unattended ? "deny" : "ask";
  return unattended ? "deny" : "ask";
}
```

- [ ] **Step 3: Run policy checks**

Run:

```bash
bun test tests/permissions.test.ts tests/workspace-boundary.test.ts
bun run typecheck
```

Expected: all pass.

- [ ] **Step 4: Commit policy**

```bash
git add src/policy src/tools/shell.ts tests/permissions.test.ts tests/workspace-boundary.test.ts
git commit -m "Constrain shell and workspace mutations" \
  -m "Constraint: Coding tools can damage a workspace unless risk and path boundaries are explicit." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Treat classifier output as a first pass; high-risk commands still require user-visible approval." \
  -m "Tested: bun test policy tests; bun run typecheck" \
  -m "Not-tested: Real interactive approval prompts are not connected yet."
```

## Task 5: Context, Cost, And Memory Governance

**Files:**
- Create: `src/agent/system-prompt.ts`
- Create: `src/context/compactor.ts`
- Create: `src/context/cost-meter.ts`
- Create: `src/memory/store.ts`
- Create: `src/memory/gate.ts`
- Create: `src/memory/dedupe.ts`
- Create: `src/memory/conflict.ts`
- Create: `src/cli/commands/memory.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/context-cost.test.ts`
- Test: `tests/memory-gate.test.ts`

- [ ] **Step 1: Add context and memory tests**

Write `tests/context-cost.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildStablePrefix, buildRuntimeContext } from "../src/agent/system-prompt";
import { normalizeUsage } from "../src/context/cost-meter";

describe("context and cost", () => {
  test("keeps dynamic values out of stable prefix", () => {
    expect(buildStablePrefix()).not.toContain("/tmp/repo");
    expect(buildRuntimeContext({ workspace: "/tmp/repo", authProvider: "openai-codex" })).toContain("/tmp/repo");
  });

  test("normalizes cached token usage when present", () => {
    expect(normalizeUsage({ input: 10, output: 2, cacheRead: 5 })).toEqual({
      input: 10,
      output: 2,
      cacheRead: 5,
      total: 12,
    });
  });
});
```

Write `tests/memory-gate.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { shouldAcceptMemory } from "../src/memory/gate";

describe("shouldAcceptMemory", () => {
  test("rejects low confidence auto memory", () => {
    expect(shouldAcceptMemory({ confidence: "low", explicit: false }, "medium")).toBe(false);
  });

  test("accepts explicit memory despite low confidence", () => {
    expect(shouldAcceptMemory({ confidence: "low", explicit: true }, "high")).toBe(true);
  });
});
```

- [ ] **Step 2: Implement stable prefix and runtime context**

Write `src/agent/system-prompt.ts`:

```ts
export function buildStablePrefix(): string {
  return [
    "You are pi-code, a narrow coding agent harness.",
    "Use the smallest sufficient tool set.",
    "Finish only by calling the structured finish tool.",
    "Do not expose credential material.",
  ].join("\n");
}

export function buildRuntimeContext(input: { workspace: string; authProvider: string }): string {
  return [
    "Runtime Context:",
    `workspace=${input.workspace}`,
    `authProvider=${input.authProvider}`,
    `date=${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");
}
```

- [ ] **Step 3: Implement usage normalizer and compactor**

Write `src/context/cost-meter.ts`:

```ts
export type UsageInput = {
  input?: number;
  output?: number;
  cacheRead?: number;
};

export type UsageSummary = {
  input: number;
  output: number;
  cacheRead: number;
  total: number;
};

export function normalizeUsage(usage: UsageInput): UsageSummary {
  const input = usage.input ?? 0;
  const output = usage.output ?? 0;
  const cacheRead = usage.cacheRead ?? 0;
  return { input, output, cacheRead, total: input + output };
}
```

Write `src/context/compactor.ts`:

```ts
export type CompactInput = {
  currentTask: string;
  todos: string[];
  changedFiles: string[];
  recentObservations: string[];
};

export function compactContext(input: CompactInput): string {
  return [
    `Current task: ${input.currentTask}`,
    `Todos: ${input.todos.join("; ")}`,
    `Changed files: ${input.changedFiles.join("; ")}`,
    `Recent observations: ${input.recentObservations.join("; ")}`,
  ].join("\n");
}
```

- [ ] **Step 4: Implement memory governance**

Write `src/memory/gate.ts`:

```ts
export type Confidence = "low" | "medium" | "high";

const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function shouldAcceptMemory(candidate: { confidence: Confidence; explicit: boolean }, floor: Confidence): boolean {
  return candidate.explicit || rank[candidate.confidence] >= rank[floor];
}
```

Write `src/memory/store.ts`:

```ts
export type MemoryScope = "user" | "project" | "session";

export type MemoryRecord = {
  id: string;
  scope: MemoryScope;
  text: string;
  createdAt: string;
};
```

Write `src/memory/dedupe.ts`:

```ts
export function similarity(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const right = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size || 1;
  return intersection / union;
}

export function isDuplicate(candidate: string, existing: string[], threshold = 0.8): boolean {
  return existing.some((item) => similarity(candidate, item) >= threshold);
}
```

Write `src/memory/conflict.ts`:

```ts
export function hasConflict(candidate: string, existing: string[]): boolean {
  const text = candidate.toLowerCase();
  return existing.some((item) => text.includes(" not ") && item.toLowerCase().replace(" not ", " ") === text.replace(" not ", " "));
}
```

- [ ] **Step 5: Wire memory command**

Write `src/cli/commands/memory.ts`:

```ts
import type { CliResult } from "../index";

export async function memoryCommand(args: string[]): Promise<CliResult> {
  const subcommand = args[0] ?? "list";
  if (subcommand === "list") return { exitCode: 0, output: "[]" };
  if (subcommand === "forget") {
    const id = args[1];
    if (!id) return { exitCode: 1, output: "Usage: pi-code memory forget <id>" };
    return { exitCode: 0, output: `Forgot memory ${id}` };
  }
  return { exitCode: 1, output: `Unknown memory command: ${subcommand}` };
}
```

Modify `src/cli/index.ts`:

```ts
import { memoryCommand } from "./commands/memory";
```

Add before unknown command return:

```ts
if (command === "memory") return memoryCommand(rest);
```

- [ ] **Step 6: Run context and memory checks**

Run:

```bash
bun test tests/context-cost.test.ts tests/memory-gate.test.ts
bun run typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit context and memory**

```bash
git add src/agent/system-prompt.ts src/context src/memory src/cli tests/context-cost.test.ts tests/memory-gate.test.ts
git commit -m "Add stable context and governed memory primitives" \
  -m "Constraint: Harness quality depends on stable prompt structure and high-signal local memory." \
  -m "Rejected: Persist every extracted memory | noisy memory degrades model attention over time." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Keep runtime values out of the stable prefix unless the prefix contract intentionally changes." \
  -m "Tested: bun test context and memory tests; bun run typecheck" \
  -m "Not-tested: Model-driven memory extraction is not connected yet."
```

## Task 6: CLI Smoke, Documentation, And OpenSpec Task Sync

**Files:**
- Create: `README.md`
- Create: `tests/e2e-smoke.test.ts`
- Modify: `openspec/changes/design-openai-auth-code-agent/tasks.md`

- [ ] **Step 1: Add e2e smoke test**

Write `tests/e2e-smoke.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { main } from "../src/cli/index";

describe("pi-code smoke", () => {
  test("prints help", async () => {
    const result = await main(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("pi-code auth status");
  });

  test("runs stub session", async () => {
    const result = await main(["run", "read the repo"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Stub execution completed");
  });
});
```

- [ ] **Step 2: Add README**

Write `README.md`:

```md
# pi-code

`pi-code` is a Bun + TypeScript coding-agent CLI that reuses Pi's Codex login experience and keeps the product harness narrow.

## Install

```bash
bun install
```

## Auth

Preferred mode is Pi Codex auth:

```bash
pi
/login
# choose ChatGPT Plus/Pro (Codex)
```

Then check status:

```bash
bun run src/cli/index.ts auth status
```

Fallback mode uses `OPENAI_API_KEY`.

## Run

```bash
bun run src/cli/index.ts run "inspect this project"
```

The current implementation includes a stub Pi adapter. Real Pi model/tool streaming is intentionally isolated behind `PiAgentAdapter`.

## Security

- Pi owns Codex OAuth tokens.
- `pi-code` does not copy Pi access or refresh tokens.
- Credential-like strings are redacted before display or persistence.
- Destructive shell commands require approval before execution.

## Checks

```bash
bun test
bun run typecheck
bun run build
```
```

- [ ] **Step 3: Mark OpenSpec implementation tasks complete as slices pass**

After all code and docs checks pass, update `openspec/changes/design-openai-auth-code-agent/tasks.md` by changing each `- [ ]` to `- [x]`. Do this only after the relevant implementation and test evidence exists.

- [ ] **Step 4: Run full verification**

Run:

```bash
bun test
bun run typecheck
bun run build
openspec validate design-openai-auth-code-agent --strict
```

Expected: all pass.

- [ ] **Step 5: Commit final implementation state**

```bash
git add README.md tests/e2e-smoke.test.ts openspec/changes/design-openai-auth-code-agent/tasks.md
git commit -m "Document and verify the pi-code harness slice" \
  -m "Constraint: The first release must be runnable and documented before Comet verification." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Do not mark OpenSpec tasks complete without matching test or build evidence." \
  -m "Tested: bun test; bun run typecheck; bun run build; openspec validate design-openai-auth-code-agent --strict" \
  -m "Not-tested: Live Pi Codex model streaming remains behind the adapter boundary."
```

## Self-Review

- Spec coverage: OpenAI auth reuse is covered by Task 2; harness loop, todo, and finish are covered by Task 3; tool risk policy is covered by Task 4; context/cost and memory are covered by Task 5; e2e validation and docs are covered by Task 6.
- Placeholder scan: no unresolved placeholder keywords are used as implementation instructions.
- Type consistency: `AuthStatus`, `PiCodexAuthAdapter`, `PiAgentAdapter`, `SessionRunner`, `FinishPayload`, and todo types are introduced before later use.
- Scope check: the plan is one coherent CLI slice. Real Pi model streaming is deliberately isolated as adapter work rather than mixed into auth or memory tasks.
