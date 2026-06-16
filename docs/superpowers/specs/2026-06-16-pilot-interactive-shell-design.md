---
comet_change: pilot-interactive-shell
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-16-pilot-interactive-shell
status: final
---

# Pilot Interactive Shell Design

## Goal

`bun run pilot` should open the Pi-backed interactive coding-agent interface by default. The implementation should reuse pi-agent's interactive runtime and Codex login experience while preserving the existing pilot-owned commands for help, auth, memory, and explicit `pilot run` sessions.

## Architecture

The CLI should split command classification from process-owned execution.

The current `main(argv): CliResult` shape is useful for pure pilot commands, but interactive Pi delegation is side-effecting: it owns stdin/stdout, may render a TUI, and can set process exit state. Add a dispatch layer that returns either a pure `CliResult` or an instruction to run the Pi interactive runtime.

Recommended module boundaries:

- `src/cli/index.ts`: command dispatch and executable entrypoint.
- `src/cli/pi-interactive.ts`: thin wrapper around `@earendil-works/pi-coding-agent`'s exported `main(args)`.
- `src/storage/paths.ts`: helper for the delegated Pi session directory under `.pilot/pi-sessions`.

`pilot` with no arguments should delegate to Pi. `pilot --help`, `pilot -h`, and all explicit pilot subcommands should remain pure pilot paths.

## Pi Runtime Delegation

Use `@earendil-works/pi-coding-agent`'s `main([])` for the no-argument path. This preserves Pi's TUI, slash commands, model selector, project trust behavior, login guidance, and session runtime.

Do not instantiate `InteractiveMode` directly unless `main([])` proves unusable. Direct `InteractiveMode` setup would require copying Pi's startup logic for settings, sessions, auth storage, model resolution, project trust, migrations, and terminal setup.

Do not build a custom readline shell for this change. It would not satisfy the requirement to reuse pi-agent's base interaction capability.

## Auth And State

The wrapper must not set `PI_CODING_AGENT_DIR` by default. Leaving that environment variable unset allows Pi to use its normal `~/.pi/agent` config/auth directory, including existing `openai-codex` credentials.

Before delegation, if `PI_CODING_AGENT_SESSION_DIR` is unset, set it to:

```text
<workspace>/.pilot/pi-sessions
```

This keeps delegated interactive session artifacts in pilot workspace state without copying OAuth tokens or API keys. If the caller already set `PI_CODING_AGENT_SESSION_DIR`, preserve the caller's value.

The existing `SessionRunner` transcript path remains:

```text
<workspace>/.pilot/sessions/<session-id>/transcript.json
```

## Compatibility

The following paths must not delegate to Pi interactive mode:

- `pilot --help`
- `pilot -h`
- `pilot auth ...`
- `pilot run ...`
- `pilot memory ...`

`pilot run "..."` remains on the existing `SessionRunner` / `PiAgentAdapter` boundary for this slice. The default adapter can remain the blocked stub unless a later change connects the real adapter.

## Error Handling

Pure pilot command output continues to use existing redaction before display or persistence.

The delegated Pi runtime writes directly to the terminal. Pilot should not proxy or reformat that stream after delegation starts. If the wrapper fails before Pi takes over the terminal, catch the error at the executable boundary, redact the message, write it to stderr, and exit nonzero.

## Tests

Automated tests should not launch the real TUI. Instead, inject a fake Pi runner into the dispatch/execution boundary.

Required tests:

- empty argv delegates to the fake Pi runner;
- `--help` and `-h` return pilot help and do not call the runner;
- `auth`, `run`, and `memory` continue to route to current handlers;
- default session env injection sets `PI_CODING_AGENT_SESSION_DIR` under `.pilot/pi-sessions`;
- an existing `PI_CODING_AGENT_SESSION_DIR` is preserved;
- `PI_CODING_AGENT_DIR` is not set by pilot delegation;
- existing redaction tests still pass.

Validation should include:

```bash
bun run test
bun run typecheck
bun run build
openspec validate pilot-interactive-shell --strict
bun run pilot -- --help
```
