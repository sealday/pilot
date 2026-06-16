# Comet Design Handoff

- Change: pilot-interactive-shell
- Phase: design
- Mode: compact
- Context hash: 172648c81b96db1dc653e546b634addd6090f022f6123fabf80306e5943ba4c5

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/pilot-interactive-shell/proposal.md

- Source: openspec/changes/pilot-interactive-shell/proposal.md
- Lines: 1-57
- SHA256: 4a9fd880ff60a9867f316aabcf55f18b4b53150920ce8e3f326d8ef15a1edbd5

```md
## Why

`bun run pilot` currently prints command help because the CLI treats an empty argument list as `--help`. The requested product behavior is different: running `pilot` with no arguments should open an interactive coding-agent shell, similar to Claude Code, and it should reuse pi-agent's existing OpenAI Codex authentication and base interaction experience instead of rebuilding those pieces.

This change turns the root Bun command into the interactive entrypoint while preserving the explicit pilot subcommands that already exist for auth, single-run harness execution, and memory management.

## What Changes

- Change the no-argument `pilot` entrypoint so `bun run pilot` starts the pi-agent-backed interactive interface when launched from a terminal.
- Reuse `@earendil-works/pi-coding-agent`'s interactive runtime instead of creating a separate readline shell.
- Preserve explicit help behavior through `bun run pilot -- --help` and `pilot --help`.
- Preserve existing pilot-owned subcommands:
  - `pilot auth ...`
  - `pilot run ...`
  - `pilot memory ...`
- Reuse Pi's Codex login/auth state by leaving the Pi agent config/auth directory under Pi control.
- Keep product-owned runtime session artifacts under `.pilot` where the Pi runtime allows a session directory override.
- Add tests and docs that show the new default command behavior and the retained explicit subcommands.

## Scope

In scope:

- CLI dispatch behavior for no-argument `pilot`.
- A thin adapter/wrapper around pi-coding-agent interactive startup.
- TTY-aware behavior for the interactive entrypoint.
- Session-directory configuration needed to keep pilot runtime state under `.pilot` without copying secrets.
- README and help text updates for the new default run command.
- Unit and smoke tests that verify dispatch, help preservation, and command compatibility without launching the full TUI in tests.

Out of scope:

- Reimplementing pi-agent's TUI, slash commands, model picker, or login UX.
- Replacing Pi's auth storage or copying OAuth/API-key material into pilot-owned files.
- Full Claude Code parity beyond pi-agent's base interactive capabilities.
- Reworking the existing `SessionRunner` and stub adapter unless required to keep current `pilot run` tests passing.
- Publishing or packaging a standalone binary.

## Capabilities

### New Capabilities

- None. This change modifies existing CLI, harness-loop, and auth behavior rather than adding a separate product domain.

### Modified Capabilities

- `repository-workspace`: Root `bun run pilot` should start the interactive shell by default; explicit `--help` remains the help path.
- `coding-harness-loop`: The first-release session loop should include an interactive Pi-backed terminal mode, not only `pilot run "prompt"`.
- `openai-auth`: Interactive sessions should reuse Pi-owned Codex auth/login behavior and keep secret material out of pilot-owned state.

## Impact

- `packages/pilot/src/cli/index.ts` will need a side-effecting process entrypoint path in addition to the current pure `CliResult` command helper.
- A new CLI command module or adapter is likely needed to wrap `@earendil-works/pi-coding-agent`'s exported `main(args)` function behind an injectable boundary for tests.
- Tests that currently expect `main([])` to return help must be updated to expect interactive dispatch, while `main(["--help"])` continues to return help.
- `.pilot` remains the product runtime state root; Pi auth/config remains Pi-owned so Codex login can be reused.
- README run instructions need to distinguish interactive `bun run pilot` from explicit command invocations such as `bun run pilot -- --help` and `bun run pilot -- run "..."`.
```
## openspec/changes/pilot-interactive-shell/design.md

- Source: openspec/changes/pilot-interactive-shell/design.md
- Lines: 1-104
- SHA256: 0d7c09d131ebbfc34958e220f15d14d9b522bc5f7b4b5036bbc629d5408dd87f

[TRUNCATED]

```md
## Context

The repository is now a Bun monorepo with the `pilot` CLI in `packages/pilot`. The root script is:

```bash
bun --cwd=packages/pilot run cli
```

The current CLI has a pure `main(argv): CliResult` function. With no arguments it returns help, and the executable wrapper prints that result. The coding harness path still uses `SessionRunner`, whose default adapter is `StubPiAgentAdapter`, so `pilot run "..."` is intentionally blocked until a real adapter is connected.

The installed pi-agent packages provide a better fit for the requested interactive behavior. `@earendil-works/pi-coding-agent` exports `main(args)`, `InteractiveMode`, `createAgentSession*`, auth storage, session management, built-in tools, and the TUI. Its own `main([])` resolves to interactive mode when stdin/stdout are TTYs and uses Pi's existing auth/config directory by default.

## Decisions

### 1. Delegate No-Argument `pilot` To Pi Interactive Runtime

The primary implementation should not hand-roll a prompt loop. When `pilot` is launched with no arguments, the process entrypoint delegates to `@earendil-works/pi-coding-agent`'s `main([])` through a small wrapper.

Rationale: the user explicitly wants pi-agent's base interaction and login experience. Delegating preserves Pi's TUI, slash commands, model/auth handling, session runtime, and tool UX with minimal product-specific code.

### 2. Keep Explicit Pilot Commands Product-Owned

The pilot command dispatcher still owns explicit subcommands:

```text
pilot --help
pilot auth ...
pilot run ...
pilot memory ...
```

`--help` and `-h` remain pure command-result paths. Unknown explicit commands continue to return a redacted error plus help. This avoids surprising users who need the existing pilot auth/status and harness test surface.

### 3. Split Testable Dispatch From Process Ownership

The CLI needs a process-owning entrypoint because pi-coding-agent's `main()` may print directly, take over the terminal, and set process exit state. The implementation should split responsibilities:

- a testable dispatcher that decides whether an argv set is a pilot command or a Pi interactive delegation,
- a process runner that performs side effects for delegated Pi execution,
- the existing `CliResult` shape for pure pilot commands.

Tests should inject a fake Pi runner and assert that `[]` delegates without starting the real TUI.

### 4. Reuse Pi Auth, Scope Pilot Session State

Do not set `PI_CODING_AGENT_DIR` by default. Leaving it unset lets Pi resolve its normal `~/.pi/agent` directory, including Codex OAuth/API-key auth state and model settings.

If Pi's session directory override is not already set, set `PI_CODING_AGENT_SESSION_DIR` to a path under the workspace `.pilot` directory before delegating. That keeps session transcripts product-owned without copying or rewriting credential material.

If this separation conflicts with a Pi runtime limitation during implementation, prefer auth reuse over session relocation and document the limitation in the verification report.

### 5. Preserve Existing `pilot run` Until The Adapter Is Reworked

This change is about making `bun run pilot` enter an interactive Pi-backed shell. The existing `pilot run "prompt"` path can remain on `SessionRunner` and the stub adapter for this slice, because it is already covered by the current conservative spec.

If implementation reveals that sharing the Pi runtime with `pilot run` is a small, low-risk change, it may be folded in only when existing tests and specs are updated accordingly. Otherwise it should stay as follow-up work.

## Data Flow

```text
bun run pilot
  -> packages/pilot CLI executable
  -> argv is empty
  -> configure pilot session directory override under .pilot/pi-sessions
  -> call @earendil-works/pi-coding-agent main([])
  -> Pi runtime handles TUI, auth, model selection, tools, slash commands, sessions
```

Explicit command flow stays separate:

```text
bun run pilot -- --help
  -> pilot dispatcher
  -> formatHelp()
  -> CliResult printed by pilot executable

bun run pilot -- run "inspect this project"
  -> pilot dispatcher
  -> SessionRunner
  -> current PiAgentAdapter boundary
```

Full source: openspec/changes/pilot-interactive-shell/design.md

## openspec/changes/pilot-interactive-shell/tasks.md

- Source: openspec/changes/pilot-interactive-shell/tasks.md
- Lines: 1-24
- SHA256: d5c709bbc7b588f0a8dc9a65f95aded4bc659d01c360916aab9a8325a71eb055

```md
## 1. Spec And Dispatch Contract

- [ ] 1.1 Add delta specs for `repository-workspace`, `coding-harness-loop`, and `openai-auth`.
- [ ] 1.2 Update CLI help/run expectations so no-argument `pilot` is interactive and explicit `--help` remains help.

## 2. Pi Interactive Delegation

- [ ] 2.1 Add a thin Pi interactive runner around `@earendil-works/pi-coding-agent`'s exported `main(args)`.
- [ ] 2.2 Configure a default Pi session directory under `.pilot/pi-sessions` without overriding Pi's auth/config directory.
- [ ] 2.3 Split CLI dispatch from process-owned execution so tests can inject a fake interactive runner.
- [ ] 2.4 Route no-argument `pilot` / `bun run pilot` to the Pi interactive runner.

## 3. Compatibility

- [ ] 3.1 Preserve `pilot --help`, `pilot auth ...`, `pilot run ...`, and `pilot memory ...` behavior.
- [ ] 3.2 Keep redaction on pilot-owned command output and error paths.
- [ ] 3.3 Keep existing `pilot run` behavior unless the Pi runtime bridge can be safely shared in this change.

## 4. Tests And Documentation

- [ ] 4.1 Add unit tests for no-argument interactive dispatch and fake-runner injection.
- [ ] 4.2 Add tests for explicit help and explicit subcommand routing.
- [ ] 4.3 Update README with `bun run pilot` interactive usage and explicit command examples.
- [ ] 4.4 Run `bun run test`, `bun run typecheck`, `bun run build`, `openspec validate`, and a help-command smoke test.
```

## openspec/changes/pilot-interactive-shell/specs/coding-harness-loop/spec.md

- Source: openspec/changes/pilot-interactive-shell/specs/coding-harness-loop/spec.md
- Lines: 1-20
- SHA256: 34d91d6cabd3d082d5024d453687c1941c40c2372a96beff98e14cbcc4c0c871

```md
## MODIFIED Requirements

### Requirement: Run Coding Agent Sessions
The CLI SHALL run coding agent sessions in the current workspace using Pi-backed model orchestration.

#### Scenario: Start an interactive session
- **WHEN** the user runs `pilot` with no arguments in an interactive terminal
- **THEN** the CLI delegates to the Pi coding-agent interactive runtime and opens a multi-turn coding-agent interface for the current workspace

#### Scenario: Start an explicit single-prompt session
- **WHEN** the user runs `pilot run "inspect this project"`
- **THEN** the CLI creates a local session, sends the prompt through the agent runner, and streams model/tool progress to the terminal

#### Scenario: Preserve explicit help outside the interactive loop
- **WHEN** the user runs `pilot --help`
- **THEN** the CLI prints usage for pilot-owned commands without starting an agent session

#### Scenario: Keep explicit pilot commands outside the interactive loop
- **WHEN** the user runs `pilot auth status`, `pilot memory list`, or `pilot run "inspect this project"`
- **THEN** the CLI routes the command to the pilot-owned command handler instead of the Pi interactive runtime
```

## openspec/changes/pilot-interactive-shell/specs/openai-auth/spec.md

- Source: openspec/changes/pilot-interactive-shell/specs/openai-auth/spec.md
- Lines: 1-46
- SHA256: 9aefd1a1be882e83ba25b5bc641fef0180b7100cba72dc394e5ebd1d6453c20e

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

#### Scenario: Interactive session reuses Pi auth directory
- **WHEN** the user runs `pilot` with no arguments and the CLI delegates to the Pi interactive runtime
- **THEN** the CLI does not override Pi's agent config/auth directory and the delegated runtime can use Pi-owned Codex credentials

### Requirement: Delegate Pi Codex Login
The CLI SHALL delegate ChatGPT Plus/Pro Codex OAuth login to Pi instead of implementing a separate OAuth flow.

#### Scenario: Start Pi-backed login
- **WHEN** the user runs `pilot auth login` and chooses Codex subscription mode
- **THEN** the CLI launches or guides the user through Pi's `/login` flow for `openai-codex`

#### Scenario: Login completes
- **WHEN** the Pi-backed login succeeds
- **THEN** the CLI detects the Pi-owned `openai-codex` auth state and reports authenticated status without copying tokens into product-owned storage

#### Scenario: Interactive login guidance is Pi-owned
- **WHEN** the delegated Pi interactive runtime requires OpenAI Codex authentication
- **THEN** the user is shown Pi's normal login guidance rather than a separate pilot OAuth flow

### Requirement: Protect Secret Material
The CLI MUST NOT expose credential values in logs, errors, transcripts, or telemetry.

#### Scenario: Provider error contains token fragment
- **WHEN** a provider error includes a credential-like string
- **THEN** the CLI redacts that string before displaying or persisting the error

#### Scenario: Reading Pi auth state
- **WHEN** the CLI reads Pi-owned auth state
- **THEN** it extracts only provider type, expiry/status metadata, and account hints needed for display, never raw access or refresh tokens

#### Scenario: Delegated interactive sessions do not copy credentials
- **WHEN** `pilot` configures product-owned runtime state for a delegated Pi interactive session
- **THEN** the CLI stores session artifacts under `.pilot` without copying access tokens, refresh tokens, or API keys into pilot-owned files
```

## openspec/changes/pilot-interactive-shell/specs/repository-workspace/spec.md

- Source: openspec/changes/pilot-interactive-shell/specs/repository-workspace/spec.md
- Lines: 1-39
- SHA256: a89cd8fa7d79f974b52a65c9e36725a2ec638fd49ef4ab2ef12315949f376cfb

```md
## MODIFIED Requirements

### Requirement: Provide Root Bun Commands
The repository root SHALL expose Bun scripts for common validation, build, and direct CLI execution workflows.

#### Scenario: Validate from repository root
- **WHEN** a developer runs `bun run test`, `bun run typecheck`, or `bun run build` from the repository root
- **THEN** the command delegates to the `packages/pilot` workspace package and runs successfully

#### Scenario: Run interactive pilot from repository root
- **WHEN** a user runs `bun run pilot` from the repository root in an interactive terminal
- **THEN** the CLI starts the Pi-backed interactive coding-agent interface in the current workspace

#### Scenario: Print pilot help from repository root
- **WHEN** a user runs `bun run pilot -- --help` from the repository root
- **THEN** the CLI prints `pilot` command usage without starting the interactive interface

#### Scenario: Blocked explicit run from repository root
- **WHEN** a user runs `bun run pilot -- run "inspect this project"` from the repository root before a real Pi adapter is connected
- **THEN** the CLI returns the existing blocked result instead of faking a successful agent run

### Requirement: Store Pilot Runtime State Under Pilot Directory
The CLI SHALL store product-owned workspace session state under `.pilot`.

#### Scenario: Persist harness session transcript
- **WHEN** a `pilot run` session transcript is persisted for session `abc123`
- **THEN** the transcript is written to `.pilot/sessions/abc123/transcript.json`

#### Scenario: Persist delegated Pi interactive sessions
- **WHEN** `pilot` delegates an interactive session to the Pi runtime and no Pi session directory override is already configured
- **THEN** the CLI configures the delegated session directory under `.pilot/pi-sessions`

#### Scenario: Preserve caller-provided Pi session override
- **WHEN** `PI_CODING_AGENT_SESSION_DIR` is already set and the user runs `pilot`
- **THEN** the CLI does not overwrite the caller-provided Pi session directory

#### Scenario: Search skips product runtime state
- **WHEN** local grep or glob tools enumerate workspace files
- **THEN** they skip `.pilot` runtime state alongside `.git` and `node_modules`
```
