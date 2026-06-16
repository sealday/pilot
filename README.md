# pilot

`pilot` is a local coding harness prototype for running a Pi-backed coding agent against a workspace. The first release keeps the production CLI conservative: the default adapter is a blocked stub until a real `PiAgentAdapter` implementation is connected.

## Install

Run from the repository root:

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run pilot
bun run pilot -- --help
bun run pilot -- run "inspect this project"
```

## Auth Modes

The CLI includes auth commands for the planned Pi integration:

```bash
pilot auth login
pilot auth status
pilot auth logout
```

API-key fallback code is present for harness tests, but real credentials should not be printed or stored in transcripts. CLI-visible output is passed through secret redaction before it is returned.

## Run Behavior

```bash
bun run pilot
```

The default command opens the Pi-backed interactive coding-agent interface. It reuses Pi's Codex login and interactive runtime. Pi/Codex auth and config remain in Pi's normal config/auth location; they are not moved into `.pilot`. Only delegated interactive session artifacts are stored under `.pilot/pi-sessions` unless `PI_CODING_AGENT_SESSION_DIR` is already set.

Explicit pilot commands remain available:

```bash
bun run pilot -- --help
bun run pilot -- auth status
bun run pilot -- memory list
bun run pilot -- memory forget <id>
bun run pilot -- run "inspect this project"
```

The explicit `pilot run` harness path still exits nonzero with a blocked result by default because the real `PiAgentAdapter` is not connected. This is intentional; the harness must not fake a successful agent run in production.

Local tool execution is available behind `SessionRunner` for adapters that emit structured tool calls. The first-release tool surface includes:

- `file_read` for workspace-contained text reads
- `patch_edit` for deterministic text replacement in workspace-contained files
- `shell` for policy-allowed safe shell commands
- `grep` and `glob` for workspace-contained search
- `git` for safe read-only status/diff style operations
- `web_fetch` for HTTP/HTTPS fetches
- `todo_write` and `finish` for progress and final status

The real Pi model/tool streaming integration remains behind `PiAgentAdapter`.

## Security Model

File and path tools enforce the workspace boundary with lexical checks plus real-path validation, and symlinks are rejected or skipped before reads, writes, and searches. Mutating file tools run through `SessionRunner`'s ordered tool loop. Shell commands are classified with `classifyShellCommand`, resolved by `decisionForShellRisk`, and then constrained to a narrow read-only allowlist for unattended runs. The `git` tool only allows a small read-only status/diff command set. `web_fetch` only accepts HTTP and HTTPS URLs and can be dependency-injected for deterministic tests.

Transcript events are persisted under `.pilot/sessions/<session-id>/transcript.json` with secret-like strings redacted from prompts, messages, tool inputs, tool outputs, and finish payloads. Default CLI run output intentionally omits the full transcript and returns only the structured finish summary.

## Checks

Targeted smoke:

```bash
bun run pilot -- --help
bun run pilot -- run "inspect this project"
```

Full validation:

```bash
bun run test
bun run typecheck
bun run build
git diff --check
```

## Non-Goals

- No fake complete result from the default production CLI.
- No broad shell automation or destructive unattended commands.
- No dependency installation or package changes in the first-release tool surface.
- No real Pi adapter implementation in this harness layer; connect it through `PiAgentAdapter`.
