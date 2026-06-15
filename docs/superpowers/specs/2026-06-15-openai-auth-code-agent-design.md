---
comet_change: design-openai-auth-code-agent
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-15-design-openai-auth-code-agent
status: final
---

# OpenAI Auth Code Agent Design

## Summary

Build `pi-code`, a Bun + TypeScript coding-agent CLI that behaves like a narrow Claude Code-style harness while reusing Pi's existing Codex login experience. The product should not duplicate OAuth or invent a second OpenAI credential system. Pi owns Codex subscription authentication; `pi-code` owns product-specific session state, memory governance, context/cost policy, and a small coding tool surface.

The design follows the article's core lesson: the harness should become cleaner, not larger. The first release therefore favors a small CLI, a thin Pi adapter, structured completion, stable context, visible cost signals, and local memory quality gates.

## Source Of Truth

OpenSpec remains canonical for product requirements:

- `openspec/specs/openai-auth/spec.md`
- `openspec/specs/coding-harness-loop/spec.md`
- `openspec/specs/context-cost-control/spec.md`
- `openspec/specs/local-memory-governance/spec.md`
- `openspec/changes/archive/2026-06-15-design-openai-auth-code-agent/`

This document explains how to implement those requirements.

## Product Boundary

`pi-code` is a CLI wrapper and opinionated harness, not a fork of Pi's full TUI.

First release commands:

```text
pi-code auth login
pi-code auth status
pi-code auth logout
pi-code run [prompt]
pi-code resume [session-id]
pi-code memory list
pi-code memory forget <id>
```

Non-goals for the first release:

- no desktop GUI,
- no WeChat or chat-platform integration,
- no plugin marketplace,
- no remote memory sync,
- no private OpenAI OAuth implementation,
- no broad model-provider abstraction beyond Pi/OpenAI Codex and API-key fallback.

## Package And Runtime

Use Bun for development scripts, tests, and packaging. Use TypeScript for source.

The concrete Pi dependency surface is:

- `@earendil-works/pi-coding-agent` for installed CLI behavior and docs,
- `@earendil-works/pi-agent-core` for core integration when exported APIs are stable,
- `@earendil-works/pi-ai` only if implementation needs lower-level provider primitives.

Implementation must verify which APIs are stable imports before binding. If auth operations are only exposed through Pi's CLI/TUI path, the first implementation should delegate by spawning Pi or giving a precise Pi login instruction rather than importing unstable internals.

## Architecture

```text
┌──────────────┐
│ pi-code CLI  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Command Controllers  │
│ auth/run/resume/mem  │
└──────┬───────────────┘
       │
       ├───────────────┐
       ▼               ▼
┌──────────────┐  ┌─────────────────┐
│ Auth Adapter │  │ Session Runner  │
│ Pi Codex     │  │ Pi Agent Adapter│
└──────┬───────┘  └──────┬──────────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌─────────────────┐
│ Pi auth.json │  │ Tools + Policy  │
│ openai-codex │  │ Context/Memory  │
└──────────────┘  └─────────────────┘
```

Proposed source layout:

```text
src/
  cli/
    index.ts
    commands/auth.ts
    commands/run.ts
    commands/resume.ts
    commands/memory.ts
  auth/
    pi-codex-auth-adapter.ts
    api-key-fallback.ts
    auth-status.ts
    token-redaction.ts
  agent/
    pi-agent-adapter.ts
    session-runner.ts
    system-prompt.ts
    finish-tool.ts
  tools/
    file-read.ts
    file-write.ts
    patch-edit.ts
    shell.ts
    search.ts
    git.ts
    web-fetch.ts
    todo-write.ts
  context/
    transcript.ts
    stable-prefix.ts
    runtime-context.ts
    compactor.ts
    cost-meter.ts
  memory/
    store.ts
    extractor.ts
    gate.ts
    dedupe.ts
    conflict.ts
  policy/
    permissions.ts
    workspace-boundary.ts
  storage/
    paths.ts
    json-db.ts
```

## Authentication Design

### Decision

Reuse Pi Codex auth first.

Pi already provides a good login experience:

- interactive `/login`,
- `openai-codex` provider,
- ChatGPT Plus/Pro Codex subscription auth,
- `~/.pi/agent/auth.json`,
- token auto-refresh,
- API-key fallback conventions.

`pi-code` should treat that as the integration boundary.

### PiCodexAuthAdapter

Responsibilities:

- detect whether Pi is installed and discover its config root,
- read Pi-owned auth status without exposing raw token fields,
- determine whether `openai-codex` is present and plausibly usable,
- surface account hints such as provider id and expiry state only,
- delegate login/logout instead of reimplementing OAuth,
- redact all credential-like strings from errors and transcripts.

The adapter must not:

- copy Pi OAuth access or refresh tokens into product-owned storage,
- print token values,
- store raw Pi token material in transcripts,
- depend on OpenAI private login endpoints.

Suggested status shape:

```ts
type AuthStatus = {
  provider: "openai-codex" | "openai-api-key" | "missing";
  source: "pi-auth" | "env" | "fallback-file" | "none";
  authenticated: boolean;
  expiresAt?: number;
  accountHint?: string;
  problem?: "missing-pi" | "missing-login" | "expired" | "invalid" | "unknown";
};
```

### Login Flow

`pi-code auth login` should provide two modes:

1. Codex subscription mode:
   - If Pi exposes a stable auth API, call it.
   - Otherwise spawn or guide the user into Pi's `/login` flow and select ChatGPT Plus/Pro (Codex).
   - After completion, re-read Pi auth status.

2. API-key fallback mode:
   - Prefer `OPENAI_API_KEY`.
   - If storing is necessary, use Pi-compatible auth-file conventions or a minimal product-owned fallback file with strict permissions.

### Logout Flow

For Pi-owned Codex auth, logout should delegate to Pi or provide exact cleanup guidance. Product code should not silently mutate Pi-owned credential files unless the implementation confirms Pi's expected format and locking behavior.

For fallback API-key credentials owned by `pi-code`, delete the local fallback entry.

## Agent Loop

The runner owns a single session loop:

```text
prompt
  -> assemble stable prefix + runtime context + memory + transcript
  -> call Pi-backed model turn
  -> classify requested tools
  -> execute allowed tools
  -> append observations
  -> compact if needed
  -> finish only through finish tool
```

The Pi integration belongs behind `PiAgentAdapter` so the rest of the product is not coupled to Pi internal APIs.

Adapter responsibilities:

- create model requests using Pi primitives,
- stream assistant content and tool calls,
- normalize provider usage data,
- normalize tool-call observations,
- surface retryable versus terminal errors.

## Tool Surface

The first release exposes only coding tools:

- `file_read`,
- `file_write`,
- `patch_edit`,
- `shell`,
- `grep`,
- `glob`,
- `git`,
- `web_fetch`,
- `todo_write`,
- `finish`.

Risk policy:

- Read-only tools may run in parallel.
- Mutating file tools run serially.
- Shell commands are classified before execution.
- Destructive shell commands require explicit approval or are rejected in unattended mode.
- Tools cannot write outside the workspace unless the user approves the exact path.

This keeps the model's choice set small while still covering real coding work.

## Todo And Completion

`todo_write` replaces the full session todo list. It must reject lists with more than one `in_progress` item.

Rationale:

- whole-list replacement is easier for models than patching individual todo ids,
- session-scoped todos avoid cross-project leakage,
- visible progress anchors long tasks.

Completion must use a structured `finish` tool:

```ts
type FinishPayload = {
  status: "complete" | "blocked";
  summary: string;
  changedFiles: string[];
  verification: string[];
  risks: string[];
};
```

The CLI exits successful only when `finish.status` is `complete` and no tools are active. Text markers such as `[GOAL_COMPLETE]` are not used.

## Context And Cost Control

The stable prompt prefix is separate from runtime context.

Stable prefix:

- system instructions,
- tool schemas,
- fixed policy text.

Runtime context:

- current date,
- workspace path,
- auth status,
- token budget,
- selected memories,
- current todos,
- recent tool results.

This preserves prompt-cache friendliness without making caching a correctness requirement.

Cost policy:

- record provider usage when Pi exposes it,
- show input/output/cached token counts when available,
- compact before context overflow,
- preserve current task, todos, approvals, changed files, and recent observations during compaction.

## Memory Governance

Memory stays local and scoped:

- user profile memory,
- project memory,
- session notes.

Auto memory must pass:

- confidence threshold,
- duplicate detection,
- conflict detection,
- scope selection.

Explicit user remember intent may bypass the confidence floor but not safety or conflict checks.

Every memory event should be visible:

- accepted,
- skipped duplicate,
- rejected conflict,
- forgotten.

## Error Handling

Auth errors:

- missing Pi -> explain install requirement or offer API-key fallback,
- missing Codex login -> direct the user to Pi-backed login,
- expired/invalid token -> retry Pi status refresh path or request re-login,
- redaction failure risk -> fail closed and avoid logging raw provider error.

Tool errors:

- return structured observations to the model,
- avoid hiding command stderr,
- mark interrupted tools as cancelled,
- do not retry mutating operations automatically unless idempotent.

Context errors:

- if compaction fails, stop before exceeding budget,
- preserve the last valid transcript snapshot,
- make blocked state resumable.

## Testing Strategy

Unit tests:

- `PiCodexAuthAdapter` reads fixture auth files and redacts token fields.
- API-key fallback resolves environment and fallback-file credentials.
- token redaction catches JWT-like and key-like strings.
- `todo_write` rejects multiple active items.
- `finish` validates required fields.
- shell policy classifies safe, mutating, and destructive commands.
- compactor preserves required session facts.
- memory gate handles accepted, duplicate, conflict, and explicit remember cases.

Contract tests:

- Pi adapter maps Pi model/tool events into local runner events.
- Auth adapter works against fixture shapes matching Pi 0.76.0 docs.
- Usage accounting handles providers with and without cached-token fields.

End-to-end smoke:

- Stub model asks to read a file, patch it, run a test command, update todos, then call `finish`.
- CLI prints changed files and verification evidence.
- Transcript contains no credential material.

Manual verification:

- With an existing Pi `openai-codex` login, `pi-code auth status` reports authenticated without secrets.
- With no login, `pi-code auth login` routes to Pi-backed login guidance.
- With `OPENAI_API_KEY`, API-key fallback is reported without printing the key.

## Implementation Order

1. Scaffold Bun + TypeScript project and tests.
2. Add Pi dependency surface and local adapters.
3. Implement auth status/login/logout with Pi Codex reuse.
4. Implement session runner with stub model support.
5. Add tools and permission policy.
6. Add context/cost tracking.
7. Add memory governance.
8. Add e2e smoke and usage docs.

## Risks And Mitigations

- Pi auth APIs may not be stable imports -> isolate behind adapter and delegate to CLI/TUI behavior when needed.
- Reading Pi auth files can leak secrets -> parse only metadata and apply redaction before any error/output leaves the adapter.
- Too much custom harness code can duplicate Pi -> use Pi primitives for model/provider behavior and keep product logic in session policy, memory, and completion.
- Context optimization can become provider-specific -> keep cache behavior optional and telemetry-driven.
- Shell execution can damage workspaces -> classify commands, require approvals for destructive actions, and keep all mutations in the transcript.

## Spec Patch

OpenSpec was already updated during design brainstorming to make Pi Codex auth reuse the primary auth path. No further delta spec patch is required before build.
