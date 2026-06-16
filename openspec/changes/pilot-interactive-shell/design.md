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

## Error Handling

- Missing or invalid Codex credentials should be surfaced by the Pi interactive runtime with its normal login guidance.
- Pilot-owned output must continue to pass through the existing redaction helpers for pure pilot commands.
- Delegated Pi output is not re-rendered by pilot; pilot should avoid intercepting terminal streams once Pi owns the process.
- If the Pi runner throws before taking over the terminal, pilot should print a concise redacted error and return a non-zero exit code.

## Testing

- Unit-test no-argument dispatch with an injected Pi runner.
- Unit-test `--help` and `-h` still return pilot help and do not invoke Pi.
- Unit-test existing explicit subcommands still route to their current handlers.
- Unit-test session directory override behavior without mutating the caller's existing `PI_CODING_AGENT_SESSION_DIR`.
- Run package tests, typecheck, build, and a smoke command for `bun run pilot -- --help`.
- For the interactive path, use an injected runner in automated tests; avoid launching the real TUI in CI-style validation.

## Risks

- Pi's exported `main()` is process-oriented and may call `process.exit`; the wrapper must keep that side effect out of unit tests.
- Pi runtime uses its own config/auth defaults. That is desirable for Codex login reuse, but it means pilot should not claim it owns those credentials.
- Session-directory relocation may not cover every Pi-generated artifact. Verification should inspect which files are created during a smoke run when safe.
- Leaving `pilot run` on the stub adapter can look inconsistent with the new interactive mode, so README wording must describe the distinction clearly.
