---
change: migrate-bun-monorepo
design-doc: docs/superpowers/specs/2026-06-16-migrate-bun-monorepo-design.md
base-ref: eefeb0b0fb193da319dd2cb35683643b4eec2d4e
---

# Migrate Bun Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the repo to a Bun monorepo and rename the live product surface from `pi-code` to `pilot`.

**Architecture:** The repository root becomes a private Bun workspace orchestrator. The product package moves intact to `packages/pilot`, owns runtime dependencies and CLI bin metadata, and root scripts delegate into it.

**Tech Stack:** Bun 1.3.13, TypeScript, Bun test, OpenSpec, Comet.

---

## File Structure

- Modify: `package.json` into root workspace manifest.
- Move: `package.json` to `packages/pilot/package.json` before replacing root manifest.
- Move: `src/` to `packages/pilot/src/`.
- Move: `tests/` to `packages/pilot/tests/`.
- Move: `tsconfig.json` to `packages/pilot/tsconfig.json`.
- Modify: `packages/pilot/src/cli/index.ts`, `packages/pilot/src/cli/commands/run.ts`, `packages/pilot/src/cli/commands/memory.ts`, `packages/pilot/src/agent/session-runner.ts`, `packages/pilot/src/agent/system-prompt.ts`, `packages/pilot/src/storage/paths.ts`, `packages/pilot/src/tools/local-execution.ts`.
- Modify: package-local tests under `packages/pilot/tests/`.
- Modify: `README.md`, `.gitignore`, `openspec/changes/migrate-bun-monorepo/tasks.md`.
- Modify generated lockfile: `bun.lock` after `bun install`.

## Task 1: Move The Package Into The Monorepo

**Files:**
- Move: `src/` -> `packages/pilot/src/`
- Move: `tests/` -> `packages/pilot/tests/`
- Move: `tsconfig.json` -> `packages/pilot/tsconfig.json`
- Move and modify: `package.json` -> `packages/pilot/package.json`
- Create: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Move product-owned files**

```bash
mkdir -p packages/pilot
git mv src packages/pilot/src
git mv tests packages/pilot/tests
git mv tsconfig.json packages/pilot/tsconfig.json
git mv package.json packages/pilot/package.json
```

- [ ] **Step 2: Replace the root package manifest**

Write `package.json` exactly as:

```json
{
  "name": "my-harness",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "bun --cwd packages/pilot run build",
    "lint": "bun run typecheck",
    "pilot": "bun --cwd packages/pilot run cli",
    "test": "bun --cwd packages/pilot run test",
    "typecheck": "bun --cwd packages/pilot run typecheck"
  }
}
```

- [ ] **Step 3: Update `packages/pilot/package.json`**

Write `packages/pilot/package.json` exactly as:

```json
{
  "name": "pilot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "pilot": "./src/cli/index.ts"
  },
  "scripts": {
    "build": "bun build src/cli/index.ts --target=node --outdir=dist",
    "cli": "bun run src/cli/index.ts",
    "lint": "bun run typecheck",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@earendil-works/pi-agent-core": "0.79.4",
    "@earendil-works/pi-coding-agent": "0.79.4"
  },
  "devDependencies": {
    "@types/bun": "^1.3.14",
    "@types/node": "^24.0.0",
    "typescript": "^5.9.0"
  }
}
```

- [ ] **Step 4: Regenerate workspace install metadata**

Run:

```bash
bun install
```

Expected: lockfile is updated for the workspace root and no install error occurs.

- [ ] **Step 5: Verify package-local tests still resolve after the move**

Run:

```bash
bun --cwd packages/pilot run test
```

Expected: tests may fail only on expected `pi-code` to `pilot` naming assertions. Import resolution and TypeScript module paths must not fail.

- [ ] **Step 6: Commit the package move**

```bash
git add package.json packages/pilot bun.lock
git commit -m "Move CLI into pilot workspace" \
  -m "Constraint: Bun monorepo root must remain the contributor command surface." \
  -m "Rejected: Keep product dependencies at the repository root | It would blur package ownership." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Add future product dependencies to packages/pilot unless they are true root tooling." \
  -m "Tested: bun install; bun --cwd packages/pilot run test." \
  -m "Not-tested: Root scripts are added in this commit but fully smoke-tested after product rename."
```

## Task 2: Rename The Live Product Surface To Pilot

**Files:**
- Modify: `packages/pilot/src/cli/index.ts`
- Modify: `packages/pilot/src/cli/commands/run.ts`
- Modify: `packages/pilot/src/cli/commands/memory.ts`
- Modify: `packages/pilot/src/agent/session-runner.ts`
- Modify: `packages/pilot/src/agent/system-prompt.ts`
- Modify: `packages/pilot/src/storage/paths.ts`
- Modify: `packages/pilot/src/tools/local-execution.ts`
- Modify: `packages/pilot/tests/*.test.ts`

- [ ] **Step 1: Update CLI help and usage strings**

Replace user-facing `pi-code` command strings with `pilot` in:

```text
packages/pilot/src/cli/index.ts
packages/pilot/src/cli/commands/run.ts
packages/pilot/src/cli/commands/memory.ts
```

Required usage strings:

```text
pilot auth login
pilot auth status
pilot auth logout
pilot run [prompt]
pilot resume [session-id]
pilot memory list
pilot memory forget <id>
```

- [ ] **Step 2: Update local state paths**

In `packages/pilot/src/storage/paths.ts`, change product-owned config and workspace state from `.pi-code` to `.pilot`:

```ts
export function pilotConfigDir(deps: PathDeps = {}): string {
  return join(deps.homeDir ?? homedir(), ".pilot");
}

export function workspaceSessionDir(deps: PathDeps = {}): string {
  return join(deps.cwd ?? process.cwd(), ".pilot", "sessions");
}
```

If no code imports `piCodeConfigDir`, rename it to `pilotConfigDir`. If an import exists, update the import site in the same step.

- [ ] **Step 3: Update transcript persistence**

In `packages/pilot/src/agent/session-runner.ts`, write transcripts under:

```ts
join(this.cwd, ".pilot", "sessions", transcript.sessionId, "transcript.json")
```

- [ ] **Step 4: Update the stable system prompt**

In `packages/pilot/src/agent/system-prompt.ts`, use:

```ts
"You are pilot, a narrow coding agent harness."
```

- [ ] **Step 5: Update local search skips**

In `packages/pilot/src/tools/local-execution.ts`, skip `.pilot`:

```ts
if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".pilot") {
  continue;
}
```

- [ ] **Step 6: Update package-local tests**

Replace live product assertions:

```text
pi-code -> pilot
.pi-code -> .pilot
```

Do not rename `PiCodexAuthAdapter`, `pi-codex-auth-adapter.ts`, or `openai-codex` because those are Pi integration names.

- [ ] **Step 7: Run targeted rename tests**

Run:

```bash
bun --cwd packages/pilot test tests/cli-help.test.ts tests/e2e-smoke.test.ts tests/session-runner.test.ts tests/memory-gate.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 8: Confirm no live old-name strings remain in implementation/tests**

Run:

```bash
rg -n "pi-code|\\.pi-code" packages/pilot/src packages/pilot/tests
```

Expected: no matches except temporary directory prefixes in tests are allowed only if they are not user-visible assertions. Prefer renaming those prefixes to `pilot-` too so the command exits with no matches.

- [ ] **Step 9: Commit the product rename**

```bash
git add packages/pilot
git commit -m "Rename product surface to pilot" \
  -m "Constraint: User explicitly rejected the pi-code product name." \
  -m "Rejected: Keep pi-code aliases | Mixed naming would make the live CLI surface ambiguous." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Keep PiCodex naming only for upstream Pi auth boundaries, not product commands." \
  -m "Tested: bun --cwd packages/pilot test tests/cli-help.test.ts tests/e2e-smoke.test.ts tests/session-runner.test.ts tests/memory-gate.test.ts; rg -n \"pi-code|\\\\.pi-code\" packages/pilot/src packages/pilot/tests." \
  -m "Not-tested: Root README commands and OpenSpec archive are handled in later tasks."
```

## Task 3: Document And Verify The Root Run Surface

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `openspec/changes/migrate-bun-monorepo/tasks.md`

- [ ] **Step 1: Update `.gitignore`**

Ensure generated artifacts and runtime state are ignored:

```gitignore
node_modules/
dist/
packages/*/dist/
.pilot/
packages/*/.pilot/
```

Remove `.pi-code/` unless kept only as a legacy local cleanup note. The repo should not document `.pi-code` as active state.

- [ ] **Step 2: Update README commands**

Update README to describe `pilot`, root-level Bun commands, and `.pilot` transcript storage. Required command block:

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run pilot -- --help
bun run pilot -- run "inspect this project"
```

Auth examples must use:

```bash
pilot auth login
pilot auth status
pilot auth logout
```

- [ ] **Step 3: Mark implementation tasks complete as they are verified**

In `openspec/changes/migrate-bun-monorepo/tasks.md`, mark completed tasks with `[x]` only after their verification command has passed.

- [ ] **Step 4: Run root command smoke checks**

Run:

```bash
bun run pilot -- --help
```

Expected: exit code 0 and output contains `pilot run [prompt]`.

Run:

```bash
bun run pilot -- run "inspect this project"
```

Expected: exit code 1 and JSON output contains `"status": "blocked"`.

- [ ] **Step 5: Commit docs and root surface**

```bash
git add README.md .gitignore openspec/changes/migrate-bun-monorepo/tasks.md
git commit -m "Document pilot root commands" \
  -m "Constraint: The repository root must run install, checks, build, and pilot directly through Bun." \
  -m "Rejected: Package-local-only instructions | They do not satisfy direct root execution." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Keep README examples rooted at repository-level Bun commands." \
  -m "Tested: bun run pilot -- --help; bun run pilot -- run \"inspect this project\"." \
  -m "Not-tested: Full validation runs in the final build task."
```

## Task 4: Full Validation And Build Completion

**Files:**
- Modify: `openspec/changes/migrate-bun-monorepo/tasks.md`

- [ ] **Step 1: Run full root validation**

Run:

```bash
bun run test
bun run typecheck
bun run build
git diff --check
openspec validate --all --strict
```

Expected: all commands pass.

- [ ] **Step 2: Confirm live source/tests do not expose the old product name**

Run:

```bash
rg -n "pi-code|\\.pi-code" package.json README.md packages/pilot/src packages/pilot/tests openspec/specs
```

Expected: no matches in live root manifest, README, package source, package tests, or main specs after archive. Before archive, matches in `openspec/specs` are acceptable only if the delta specs are present and `openspec validate --all --strict` passes; record that in the commit message.

- [ ] **Step 3: Mark all build tasks complete**

Update `openspec/changes/migrate-bun-monorepo/tasks.md` so tasks 1.1 through 3.4 are `[x]`. Leave delivery tasks 4.1 through 4.3 unchecked until merge/push/remote cleanup actually complete.

- [ ] **Step 4: Commit final build state**

```bash
git add openspec/changes/migrate-bun-monorepo/tasks.md
git commit -m "Verify pilot monorepo migration" \
  -m "Constraint: Build phase must prove root Bun commands before Comet verification." \
  -m "Rejected: Treat package-local validation as sufficient | The requested run surface is root-level Bun commands." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Do not mark delivery tasks complete until main is pushed and remote branches are cleaned." \
  -m "Tested: bun run test; bun run typecheck; bun run build; git diff --check; openspec validate --all --strict; bun run pilot -- --help; bun run pilot -- run \"inspect this project\"." \
  -m "Not-tested: Live Pi model streaming remains behind the existing adapter boundary."
```

- [ ] **Step 5: Run Comet build guard**

Run:

```bash
. /Users/seal/.codex/skills/comet/scripts/comet-env.sh
bash "$COMET_GUARD" migrate-bun-monorepo build --apply
```

Expected: build guard passes and `.comet.yaml` moves to `phase: verify`.

## Task 5: Verify, Archive, Merge, Push, And Remote Cleanup

**Files:**
- Create: `docs/superpowers/reports/2026-06-16-migrate-bun-monorepo-verify.md`
- Modify through archive: `openspec/specs/**`, `docs/superpowers/specs/2026-06-16-migrate-bun-monorepo-design.md`, `docs/superpowers/plans/2026-06-16-migrate-bun-monorepo.md`, `openspec/changes/archive/**`

- [ ] **Step 1: Run Comet verify**

Use `comet-verify`. The verification report must record:

```text
bun run test
bun run typecheck
bun run build
bun run pilot -- --help
bun run pilot -- run "inspect this project" -> expected blocked exit code 1
git diff --check
openspec validate --all --strict
```

- [ ] **Step 2: Archive the change**

Use `comet-archive` after verify passes. Expected: delta specs sync into `openspec/specs`, design/plan metadata are marked archived, and the change moves to `openspec/changes/archive/2026-06-16-migrate-bun-monorepo/`.

- [ ] **Step 3: Merge into main**

Run after archive commit exists:

```bash
git fetch origin --prune
git checkout main
git merge design-openai-auth-code-agent
bun run test
bun run typecheck
bun run build
openspec validate --all --strict
```

Expected: merge succeeds and validation passes on `main`.

- [ ] **Step 4: Push main**

Run:

```bash
git push -u origin main
```

Expected: remote `origin/main` points at the verified merged result.

- [ ] **Step 5: Delete remote branches other than main**

List remote branches:

```bash
git branch -r
```

Delete every `origin/<branch>` where `<branch>` is not `main`:

```bash
git push origin --delete <branch>
```

Expected: `git branch -r` shows only `origin/main` and any symbolic `origin/HEAD -> origin/main`.
