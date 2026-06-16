# Comet Design Handoff

- Change: migrate-bun-monorepo
- Phase: design
- Mode: compact
- Context hash: e63403ba5f75e81000b7d18490b4f1bc65195644df2396b3d8618f16264c03b1

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/migrate-bun-monorepo/proposal.md

- Source: openspec/changes/migrate-bun-monorepo/proposal.md
- Lines: 1-52
- SHA256: 2d5359159d17d51edd75add48da4a6306dc0011f16cfa5f257b3d6d1f0cf9731

```md
## Why

The current coding harness is a single root package named `pi-code`. That works for the first CLI slice, but it makes future packages hard to add without mixing product code, repository tooling, and OpenSpec artifacts at the root. The product name should also become `pilot`, not `pi-code`.

This change migrates the repository to a Bun-managed monorepo so the `pilot` CLI can live in a dedicated workspace package while the root remains the orchestration surface for install, test, build, and run commands.

The user also requested that the result can be run directly with Bun commands, then merged into `main`, pushed to the remote, and cleaned up so remote branches other than `main` are removed.

## What Changes

- Convert the root `package.json` into a private Bun workspace root.
- Rename the product-facing CLI/package from `pi-code` to `pilot`.
- Move the current CLI package source, tests, package metadata, and TypeScript config into a workspace package under `packages/pilot`.
- Keep root-level scripts for common workflows:
  - install dependencies,
  - run tests,
  - typecheck,
  - build,
  - run the CLI directly with Bun.
- Update README instructions so a fresh checkout can run the CLI from the root with Bun.
- Preserve the current conservative default runtime behavior: `pilot run` blocks until a real `PiAgentAdapter` is connected.
- Preserve all existing tests and security hardening.
- Complete repository delivery after verification by merging the development branch into `main`, pushing `main`, and deleting remote branches other than `main`.

## Scope

In scope:

- Bun workspace configuration.
- Product-facing rename from `pi-code` to `pilot`.
- Package relocation to `packages/pilot`.
- Script and path updates required by the new package layout.
- README run instructions.
- Validation that root-level Bun commands work from a clean monorepo checkout.
- Git delivery actions requested by the user.

Out of scope:

- Adding a real Pi streaming adapter.
- Adding new model-provider behavior.
- Publishing the package to npm.
- Adding additional workspace packages beyond the CLI workspace unless needed for the migration.
- Changing the OpenAI auth or local tool semantics except where naming/path updates require it.

## Impact

- Repository layout changes from single-package to monorepo.
- `bun.lock` may change due workspace metadata.
- CLI package paths and test imports may move under `packages/pilot`.
- User-facing command examples and local product state paths change from `pi-code` / `.pi-code` to `pilot` / `.pilot`.
- Root commands become the documented public development surface.
- Remote branch cleanup is destructive for non-main branches but explicitly requested as part of delivery.
```

## openspec/changes/migrate-bun-monorepo/design.md

- Source: openspec/changes/migrate-bun-monorepo/design.md
- Lines: 1-91
- SHA256: 6e54ea90c5cac882a53996246776554f3828008a27a10fb77a02d4104f198140

[TRUNCATED]

```md
## Context

The repository currently has one Bun package at the root with source in `src/`, tests in `tests/`, and package scripts in root `package.json`. The next requested state is a Bun monorepo where the CLI remains runnable from the root and where the repository can later grow additional packages without reworking the root again. The product-facing name becomes `pilot`, replacing the previous tentative `pi-code` name.

Bun supports workspace package management via root `package.json` `workspaces`, and supports running workspace scripts using `--filter` or `--workspaces`.

## Decisions

### 1. Root Becomes Workspace Orchestrator

The root `package.json` remains private and owns workspace-level commands only. It should not expose the CLI binary directly. It defines:

- `workspaces`: `["packages/*"]`
- root scripts that delegate to `packages/pilot`
- repository-level validation scripts

Rationale: the root should be stable for contributors and CI. Product-specific dependencies and bin metadata belong in the package that owns the product.

### 2. CLI Package Moves To `packages/pilot`

Move the current product package into:

```text
packages/pilot/
  package.json
  tsconfig.json
  src/
  tests/
```

The package uses the private npm name `pilot` and exposes a `pilot` bin. Existing imports should remain relative inside the package.

Rationale: a single package move is enough for monorepo readiness and avoids inventing shared packages prematurely.

### 3. Root Commands Are The Public Run Surface

Root-level scripts should provide the commands a user can run immediately:

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run pilot -- --help
bun run pilot -- run "inspect this project"
```

Implementation may use `bun --filter pilot <script>` or `bun --cwd packages/pilot run <script>` depending on which form is more reliable in this repo and Bun version.

### 4. User-Facing Product Name Is `pilot`

The migration should remove `pi-code` from the live product surface:

- package name: `pilot`
- CLI binary and help examples: `pilot`
- root run script: `bun run pilot -- ...`
- package directory: `packages/pilot`
- workspace-local session state directory: `.pilot`

Pi Codex authentication terms and internal names such as `PiCodexAuthAdapter` remain valid because they describe the upstream Pi authentication boundary, not the product name.

### 5. Runtime Behavior Stays Conservative

The monorepo migration must not change the CLI safety semantics. In particular:

- default `pilot run` remains blocked while the real Pi adapter is disconnected,
- persisted transcripts remain redacted,
- local tool workspace and git/shell hardening remain intact,
- tests continue to cover the first-release tool surface.

### 6. Delivery Happens After Verification

After implementation and archive verification:

1. merge the development branch into `main`,
2. push `main` to `origin`,
3. delete remote branches other than `main`.

Rationale: these are repository delivery operations, not product behavior. They happen only after local validation and Comet verification pass.

```

Full source: openspec/changes/migrate-bun-monorepo/design.md

## openspec/changes/migrate-bun-monorepo/tasks.md

- Source: openspec/changes/migrate-bun-monorepo/tasks.md
- Lines: 1-25
- SHA256: adf6195fbe01a713da7d7a58dbdb8ddc1582ef3db951f02afe06b5306c279f58

```md
## 1. Workspace Layout

- [ ] 1.1 Convert root `package.json` into a private Bun workspace root with `workspaces` configured.
- [ ] 1.2 Move the existing CLI package files into `packages/pilot`.
- [ ] 1.3 Update package-local `tsconfig`, scripts, bin metadata, and build output paths for the new package location.
- [ ] 1.4 Rename the user-facing package, binary, help text, README examples, and local state path from `pi-code` / `.pi-code` to `pilot` / `.pilot`.

## 2. Root Run Surface

- [ ] 2.1 Add root scripts for test, typecheck, build, lint, and direct CLI execution.
- [ ] 2.2 Update README with root-level Bun install, validation, and run commands.
- [ ] 2.3 Ensure generated build artifacts and package-local runtime state remain ignored.

## 3. Validation

- [ ] 3.1 Run and fix root-level `bun run test`.
- [ ] 3.2 Run and fix root-level `bun run typecheck`.
- [ ] 3.3 Run and fix root-level `bun run build`.
- [ ] 3.4 Smoke-test direct CLI execution from the repository root with Bun.

## 4. Delivery

- [ ] 4.1 Merge the verified development branch into `main`.
- [ ] 4.2 Push `main` to `origin`.
- [ ] 4.3 Delete remote branches other than `main`.
```

## openspec/changes/migrate-bun-monorepo/specs/coding-harness-loop/spec.md

- Source: openspec/changes/migrate-bun-monorepo/specs/coding-harness-loop/spec.md
- Lines: 1-8
- SHA256: 25078da693e83d9af584d7b5ff125557aa56f899003bac3c8bc1deb6f8c69f06

```md
## MODIFIED Requirements

### Requirement: Run Coding Agent Sessions
The CLI SHALL run a coding agent session in the current workspace using Pi-backed model orchestration.

#### Scenario: Start a session
- **WHEN** the user runs `pilot run "inspect this project"`
- **THEN** the CLI creates a local session, sends the prompt through the agent runner, and streams model/tool progress to the terminal
```

## openspec/changes/migrate-bun-monorepo/specs/openai-auth/spec.md

- Source: openspec/changes/migrate-bun-monorepo/specs/openai-auth/spec.md
- Lines: 1-67
- SHA256: 9c8f773c9ee88e6495cb17d1a4b4ca1c873b9f1b640d826e805c3de751315923

```md
## MODIFIED Requirements

### Requirement: Reuse Pi Codex Credentials
The CLI SHALL prefer Pi's existing `openai-codex` authentication state for OpenAI Codex access.

#### Scenario: Pi Codex credentials are present
- **WHEN** Pi has a valid `openai-codex` login and the user runs `pilot auth status`
- **THEN** the CLI reports Codex subscription mode as available without printing OAuth token material

#### Scenario: Pi Codex credentials are missing
- **WHEN** Pi is installed but no valid `openai-codex` login exists
- **THEN** the CLI tells the user that Codex login is unavailable and offers the Pi-backed login flow

### Requirement: Delegate Pi Codex Login
The CLI SHALL delegate ChatGPT Plus/Pro Codex OAuth login to Pi instead of implementing a separate OAuth flow.

#### Scenario: Start Pi-backed login
- **WHEN** the user runs `pilot auth login` and chooses Codex subscription mode
- **THEN** the CLI launches or guides the user through Pi's `/login` flow for `openai-codex`

#### Scenario: Login completes
- **WHEN** the Pi-backed login succeeds
- **THEN** the CLI detects the Pi-owned `openai-codex` auth state and reports authenticated status without copying tokens into product-owned storage

### Requirement: Configure OpenAI API-Key Fallback
The CLI SHALL allow API-key fallback when Pi Codex login is unavailable or not desired.

#### Scenario: Configure API key from environment
- **WHEN** `OPENAI_API_KEY` is set and the user runs `pilot auth status`
- **THEN** the CLI reports API-key mode as available without printing the key

#### Scenario: Store API key through Pi-compatible auth file
- **WHEN** the user runs `pilot auth login` and selects API-key fallback mode
- **THEN** the CLI stores or delegates storage using Pi-compatible auth conventions and redacts the key from output

### Requirement: Validate OpenAI Credentials
The CLI SHALL validate stored credentials before sending model requests.

#### Scenario: Valid credentials
- **WHEN** credentials are present and accepted by the provider validation call
- **THEN** the CLI reports authenticated status and allows `pilot run`

#### Scenario: Invalid credentials
- **WHEN** credentials are missing, expired, or rejected
- **THEN** the CLI blocks `pilot run` and displays a redacted remediation message

### Requirement: Logout OpenAI Credentials
The CLI SHALL allow the user to remove locally stored OpenAI credentials.

#### Scenario: Logout delegates Pi-owned Codex credentials
- **WHEN** the user runs `pilot auth logout`
- **THEN** the CLI delegates or instructs Pi-owned Codex credential cleanup and confirms without printing previous values

#### Scenario: Logout removes fallback secret material
- **WHEN** the user runs `pilot auth logout` for API-key fallback credentials
- **THEN** the CLI deletes product-owned fallback secret material and confirms without printing previous values

### Requirement: Protect Secret Material
The CLI MUST NOT expose credential values in logs, errors, transcripts, or telemetry.

#### Scenario: Provider error contains token fragment
- **WHEN** a provider error includes a credential-like string
- **THEN** the CLI redacts that string before displaying or persisting the error

#### Scenario: Reading Pi auth state
- **WHEN** the CLI reads Pi-owned auth state
- **THEN** it extracts only provider type, expiry/status metadata, and account hints needed for display, never raw access or refresh tokens
```

## openspec/changes/migrate-bun-monorepo/specs/repository-workspace/spec.md

- Source: openspec/changes/migrate-bun-monorepo/specs/repository-workspace/spec.md
- Lines: 1-38
- SHA256: 521ba2b0bb3920f7a4985abea89974335cfe98c74727b4cdebdb6910aad91363

```md
## ADDED Requirements

### Requirement: Use Bun Workspace Layout
The repository SHALL be organized as a Bun monorepo with a private root workspace and the `pilot` CLI in a dedicated workspace package.

#### Scenario: Install from repository root
- **WHEN** a user runs `bun install` from the repository root
- **THEN** Bun installs dependencies for the workspace root and the `packages/pilot` workspace package using the shared lockfile

#### Scenario: Package owns product metadata
- **WHEN** a developer inspects `packages/pilot/package.json`
- **THEN** it defines the `pilot` package name, `pilot` binary, product dependencies, and package-local build/test/typecheck scripts

### Requirement: Provide Root Bun Commands
The repository root SHALL expose Bun scripts for common validation, build, and direct CLI execution workflows.

#### Scenario: Validate from repository root
- **WHEN** a developer runs `bun run test`, `bun run typecheck`, or `bun run build` from the repository root
- **THEN** the command delegates to the `packages/pilot` workspace package and runs successfully

#### Scenario: Run pilot from repository root
- **WHEN** a user runs `bun run pilot -- --help` from the repository root
- **THEN** the CLI prints `pilot` command usage

#### Scenario: Blocked run from repository root
- **WHEN** a user runs `bun run pilot -- run "inspect this project"` from the repository root before a real Pi adapter is connected
- **THEN** the CLI returns the existing blocked result instead of faking a successful agent run

### Requirement: Store Pilot Runtime State Under Pilot Directory
The CLI SHALL store product-owned workspace session state under `.pilot` instead of `.pi-code`.

#### Scenario: Persist session transcript
- **WHEN** a session transcript is persisted for session `abc123`
- **THEN** the transcript is written to `.pilot/sessions/abc123/transcript.json`

#### Scenario: Search skips product runtime state
- **WHEN** local grep or glob tools enumerate workspace files
- **THEN** they skip `.pilot` runtime state alongside `.git` and `node_modules`
```

