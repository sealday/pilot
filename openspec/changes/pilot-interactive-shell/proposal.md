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
