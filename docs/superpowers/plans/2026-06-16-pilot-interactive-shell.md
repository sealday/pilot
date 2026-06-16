---
change: pilot-interactive-shell
design-doc: docs/superpowers/specs/2026-06-16-pilot-interactive-shell-design.md
base-ref: b9d03baff15c08ecf98f74640616a389a1d57061
archived-with: 2026-06-16-pilot-interactive-shell
---

# Pilot Interactive Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `bun run pilot` open the Pi-backed interactive coding-agent interface while preserving explicit pilot commands.

**Architecture:** Add a small Pi interactive wrapper and a testable CLI dispatch boundary. No-argument `pilot` delegates to `@earendil-works/pi-coding-agent` while `--help`, `auth`, `run`, and `memory` continue through pilot-owned handlers.

**Tech Stack:** Bun, TypeScript, Bun test, `@earendil-works/pi-coding-agent`, OpenSpec, Comet.

## File Structure

- Modify: `package.json` so root `bun run pilot` preserves the repository working directory.
- Modify: `packages/pilot/src/storage/paths.ts` to expose `.pilot/pi-sessions`.
- Create: `packages/pilot/src/cli/pi-interactive.ts` for Pi runtime delegation and env setup.
- Modify: `packages/pilot/src/cli/index.ts` to split dispatch from process execution.
- Modify: `packages/pilot/tests/cli-help.test.ts` for empty-argv delegation and help preservation.
- Modify: `packages/pilot/tests/e2e-smoke.test.ts` only if help smoke expectations need the new dispatch helper.
- Modify: `README.md` to document interactive default behavior.
- Modify: `openspec/changes/pilot-interactive-shell/tasks.md` as implementation tasks complete.

## Task 1: Lock The CLI Dispatch Contract

**Files:**
- Modify: `packages/pilot/tests/cli-help.test.ts`
- Modify: `openspec/changes/pilot-interactive-shell/tasks.md`

- [ ] **Step 1: Replace the empty-help expectation with interactive delegation**

In `packages/pilot/tests/cli-help.test.ts`, replace the test named `returns help for empty and flag invocations` with two tests:

```ts
test("delegates empty invocations to the Pi interactive runner", async () => {
  const calls: string[][] = [];
  const env: NodeJS.ProcessEnv = {};

  const result = await main([], {
    cwd: "/tmp/pilot-workspace",
    env,
    piInteractive: async (args) => {
      calls.push(args);
    },
  });

  expect(result).toEqual({ exitCode: 0, output: "" });
  expect(calls).toEqual([[]]);
  expect(env.PI_CODING_AGENT_SESSION_DIR).toBe("/tmp/pilot-workspace/.pilot/pi-sessions");
  expect(env.PI_CODING_AGENT_DIR).toBeUndefined();
});

test("returns help for explicit help flags", async () => {
  for (const argv of [["--help"], ["-h"]]) {
    const result = await main(argv);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("pilot auth status");
  }
});
```

- [ ] **Step 2: Add explicit routing coverage for pilot-owned commands**

Add this test to the same file:

```ts
test("does not delegate explicit pilot commands to the Pi interactive runner", async () => {
  const calls: string[][] = [];

  const help = await main(["--help"], { piInteractive: async (args) => calls.push(args) });
  const runUsage = await main(["run"], { piInteractive: async (args) => calls.push(args) });
  const memoryUsage = await main(["memory", "forget"], { piInteractive: async (args) => calls.push(args) });

  expect(help.exitCode).toBe(0);
  expect(runUsage.output).toContain("Usage: pilot run [prompt]");
  expect(memoryUsage.output).toContain("Usage: pilot memory forget <id>");
  expect(calls).toEqual([]);
});
```

- [ ] **Step 3: Run the focused test and confirm it fails**

Run:

```bash
bun --cwd=packages/pilot test tests/cli-help.test.ts
```

Expected: TypeScript/runtime failure because `main` does not yet accept injected `piInteractive` deps, and empty argv still returns help.

- [ ] **Step 4: Mark spec task 1.1 complete if delta specs are still valid**

Run:

```bash
openspec validate pilot-interactive-shell --strict
```

Expected: validation passes.

Then change only this line in `openspec/changes/pilot-interactive-shell/tasks.md`:

```md
- [x] 1.1 Add delta specs for `repository-workspace`, `coding-harness-loop`, and `openai-auth`.
```

- [ ] **Step 5: Commit the failing dispatch contract**

```bash
git add packages/pilot/tests/cli-help.test.ts openspec/changes/pilot-interactive-shell/tasks.md
git commit -m "Specify pilot interactive dispatch" \
  -m "Constraint: No-argument pilot must delegate to Pi interactive mode while explicit subcommands remain pilot-owned." \
  -m "Rejected: Keep empty argv as help | It conflicts with the interactive shell requirement." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Do not launch the real Pi TUI from unit tests; inject a runner instead." \
  -m "Tested: openspec validate pilot-interactive-shell --strict; bun --cwd=packages/pilot test tests/cli-help.test.ts fails as expected before implementation." \
  -m "Not-tested: Full test suite until implementation exists."
```

## Task 2: Add The Pi Interactive Runner

**Files:**
- Modify: `packages/pilot/src/storage/paths.ts`
- Create: `packages/pilot/src/cli/pi-interactive.ts`
- Test: `packages/pilot/tests/cli-help.test.ts`
- Modify: `openspec/changes/pilot-interactive-shell/tasks.md`

- [ ] **Step 1: Add the delegated Pi session path helper**

In `packages/pilot/src/storage/paths.ts`, add:

```ts
export function workspacePiSessionDir(deps: PathDeps = {}): string {
  return join(deps.cwd ?? process.cwd(), ".pilot", "pi-sessions");
}
```

- [ ] **Step 2: Create the Pi interactive wrapper**

Create `packages/pilot/src/cli/pi-interactive.ts`:

```ts
import { main as piCodingAgentMain } from "@earendil-works/pi-coding-agent";
import { workspacePiSessionDir } from "../storage/paths.js";

export type PiInteractiveRunner = (args: string[]) => Promise<void>;

export type PiInteractiveDeps = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  runner?: PiInteractiveRunner;
};

export function configurePiInteractiveEnv(deps: Pick<PiInteractiveDeps, "cwd" | "env"> = {}): void {
  const env = deps.env ?? process.env;

  if (!env.PI_CODING_AGENT_SESSION_DIR) {
    env.PI_CODING_AGENT_SESSION_DIR = workspacePiSessionDir({ cwd: deps.cwd });
  }
}

export async function runPiInteractive(args: string[] = [], deps: PiInteractiveDeps = {}): Promise<void> {
  configurePiInteractiveEnv(deps);
  await (deps.runner ?? piCodingAgentMain)(args);
}
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
bun --cwd=packages/pilot test tests/cli-help.test.ts
```

Expected: still fails because `index.ts` has not routed empty argv to `runPiInteractive`.

- [ ] **Step 4: Commit the runner wrapper**

```bash
git add packages/pilot/src/storage/paths.ts packages/pilot/src/cli/pi-interactive.ts
git commit -m "Add Pi interactive runner wrapper" \
  -m "Constraint: Pilot must reuse Pi auth/config while keeping delegated session artifacts under .pilot." \
  -m "Rejected: Override PI_CODING_AGENT_DIR | It would break reuse of Pi-owned Codex login state." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Preserve caller-provided PI_CODING_AGENT_SESSION_DIR values." \
  -m "Tested: bun --cwd=packages/pilot test tests/cli-help.test.ts fails only on missing CLI routing." \
  -m "Not-tested: Full suite until CLI routing is wired."
```

## Task 3: Wire CLI Dispatch And Root Script

**Files:**
- Modify: `packages/pilot/src/cli/index.ts`
- Modify: `package.json`
- Test: `packages/pilot/tests/cli-help.test.ts`
- Modify: `openspec/changes/pilot-interactive-shell/tasks.md`

- [ ] **Step 1: Update CLI imports and deps**

In `packages/pilot/src/cli/index.ts`, import the wrapper:

```ts
import { runPiInteractive, type PiInteractiveRunner } from "./pi-interactive.js";
```

Then add:

```ts
export type CliDeps = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  piInteractive?: PiInteractiveRunner;
};
```

- [ ] **Step 2: Route empty argv to Pi interactive mode**

Change `main` to accept deps and delegate only for empty argv:

```ts
export async function main(argv = process.argv.slice(2), deps: CliDeps = {}): Promise<CliResult> {
  if (argv.length === 0) {
    await runPiInteractive([], {
      cwd: deps.cwd ?? process.cwd(),
      env: deps.env,
      runner: deps.piInteractive,
    });
    return { exitCode: 0, output: "" };
  }

  if (argv[0] === "--help" || argv[0] === "-h") {
    return { exitCode: 0, output: formatHelp() };
  }

  const [command, ...rest] = argv;

  if (command === "auth") {
    return authCommand(rest);
  }

  if (command === "run") {
    return runCommand(rest);
  }

  if (command === "memory") {
    return memoryCommand(rest);
  }

  return { exitCode: 1, output: `${redactSecrets(`Unknown command: ${argv.join(" ")}`)}\n\n${formatHelp()}` };
}
```

- [ ] **Step 3: Avoid printing a blank line after interactive exit**

In the `if (import.meta.main)` block, only write non-empty output:

```ts
if (import.meta.main) {
  const result = await main();
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  if (result.output.length > 0) {
    stream.write(`${result.output}\n`);
  }
  process.exit(result.exitCode);
}
```

- [ ] **Step 4: Preserve repository cwd for root `bun run pilot`**

In root `package.json`, change only the `pilot` script:

```json
"pilot": "bun packages/pilot/src/cli/index.ts"
```

- [ ] **Step 5: Run focused dispatch tests**

Run:

```bash
bun --cwd=packages/pilot test tests/cli-help.test.ts
```

Expected: all tests in `cli-help.test.ts` pass.

- [ ] **Step 6: Mark dispatch tasks complete**

Change these lines in `openspec/changes/pilot-interactive-shell/tasks.md`:

```md
- [x] 1.2 Update CLI help/run expectations so no-argument `pilot` is interactive and explicit `--help` remains help.
- [x] 2.1 Add a thin Pi interactive runner around `@earendil-works/pi-coding-agent`'s exported `main(args)`.
- [x] 2.2 Configure a default Pi session directory under `.pilot/pi-sessions` without overriding Pi's auth/config directory.
- [x] 2.3 Split CLI dispatch from process-owned execution so tests can inject a fake interactive runner.
- [x] 2.4 Route no-argument `pilot` / `bun run pilot` to the Pi interactive runner.
```

- [ ] **Step 7: Commit dispatch implementation**

```bash
git add package.json packages/pilot/src/cli/index.ts openspec/changes/pilot-interactive-shell/tasks.md
git commit -m "Route pilot into Pi interactive mode" \
  -m "Constraint: Empty pilot invocation owns the interactive path; explicit subcommands stay product-owned." \
  -m "Rejected: Keep root script using --cwd packages/pilot | It would make repo-root runs operate from the package directory." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Keep no-argument dispatch injectable so tests never start the real TUI." \
  -m "Tested: bun --cwd=packages/pilot test tests/cli-help.test.ts." \
  -m "Not-tested: Full validation deferred until docs and compatibility checks are updated."
```

## Task 4: Update Docs And Run Full Validation

**Files:**
- Modify: `README.md`
- Modify: `openspec/changes/pilot-interactive-shell/tasks.md`

- [ ] **Step 1: Update README install commands**

Change the install command block to include interactive default usage:

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run pilot
bun run pilot -- --help
bun run pilot -- run "inspect this project"
```

- [ ] **Step 2: Update README run behavior**

Replace the opening of `## Run Behavior` with:

```md
## Run Behavior

```bash
bun run pilot
```

The default command opens the Pi-backed interactive coding-agent interface. It reuses Pi's Codex login and interactive runtime, while storing delegated session artifacts under `.pilot/pi-sessions` unless `PI_CODING_AGENT_SESSION_DIR` is already set.

Explicit pilot commands remain available:

```bash
bun run pilot -- --help
bun run pilot -- auth status
bun run pilot -- run "inspect this project"
```

The explicit `pilot run` harness path still exits nonzero with a blocked result by default because the real `PiAgentAdapter` is not connected. This is intentional; the harness must not fake a successful agent run in production.
```

- [ ] **Step 3: Run validation**

Run:

```bash
bun run test
bun run typecheck
bun run build
openspec validate pilot-interactive-shell --strict
bun run pilot -- --help
```

Expected:

- `bun run test` passes.
- `bun run typecheck` passes.
- `bun run build` passes.
- `openspec validate pilot-interactive-shell --strict` passes.
- `bun run pilot -- --help` prints pilot usage and exits 0.

- [ ] **Step 4: Mark compatibility and validation tasks complete**

Change these lines in `openspec/changes/pilot-interactive-shell/tasks.md`:

```md
- [x] 3.1 Preserve `pilot --help`, `pilot auth ...`, `pilot run ...`, and `pilot memory ...` behavior.
- [x] 3.2 Keep redaction on pilot-owned command output and error paths.
- [x] 3.3 Keep existing `pilot run` behavior unless the Pi runtime bridge can be safely shared in this change.
- [x] 4.1 Add unit tests for no-argument interactive dispatch and fake-runner injection.
- [x] 4.2 Add tests for explicit help and explicit subcommand routing.
- [x] 4.3 Update README with `bun run pilot` interactive usage and explicit command examples.
- [x] 4.4 Run `bun run test`, `bun run typecheck`, `bun run build`, `openspec validate`, and a help-command smoke test.
```

- [ ] **Step 5: Commit docs and validation**

```bash
git add README.md openspec/changes/pilot-interactive-shell/tasks.md
git commit -m "Document pilot interactive entrypoint" \
  -m "Constraint: README must distinguish interactive pilot from the explicit blocked harness run." \
  -m "Rejected: Claim pilot run is fully Pi-backed | This change only makes the default interactive path Pi-backed." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Keep docs explicit about auth reuse and session state paths." \
  -m "Tested: bun run test; bun run typecheck; bun run build; openspec validate pilot-interactive-shell --strict; bun run pilot -- --help." \
  -m "Not-tested: Manual full-screen TUI interaction in an authenticated Pi session."
```

## Self-Review

- Spec coverage: repository command behavior is covered by Tasks 1, 3, and 4; coding harness loop behavior is covered by Tasks 1 and 3; OpenAI auth reuse is covered by Task 2 and README updates.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation steps remain.
- Type consistency: `PiInteractiveRunner`, `PiInteractiveDeps`, `CliDeps`, `workspacePiSessionDir`, and `runPiInteractive` are defined before use in later steps.
