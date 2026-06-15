## Context

The target product is a Claude Code-like coding agent built on Pi coding-agent packages, Bun, and TypeScript. The user enters a project directory, runs a CLI, reuses Pi's OpenAI Codex login where available, and asks the agent to inspect code, edit files, run commands, and verify work.

The article's central product lesson is that the harness matters as much as the model. The design therefore avoids a feature pile and concentrates on four quality levers:

- a small, opinionated tool surface,
- stable context and cost control,
- local memory with quality gates,
- visible task planning and completion.

There is currently no application code in this repository, so this design establishes the first architectural baseline.

## Goals / Non-Goals

**Goals:**

- Provide a Bun-powered CLI that feels close to Claude Code for coding tasks.
- Use Pi coding-agent primitives as the core agent orchestration layer.
- Support OpenAI auth by reusing Pi's Codex login state and provider behavior first, with explicit local API-key fallback.
- Keep the first tool set small and coding-specific.
- Make cost, context, memory writes, permissions, and completion visible to the user.
- Keep all persistent state local by default.

**Non-Goals:**

- No desktop GUI in the first implementation.
- No WeChat, Slack, or browser extension integration.
- No private or undocumented OpenAI auth endpoint scraping.
- No general plugin marketplace.
- No automatic memory sync to external services.
- No new model provider support beyond the OpenAI provider boundary in the first release.

## Decisions

### 1. Product Shape: `pi-code` CLI

Create a single CLI binary with these commands:

- `pi-code auth login`: delegate to Pi's Codex login flow when available, or configure API-key fallback.
- `pi-code auth status`: show provider, account hint, and token validity without printing secrets.
- `pi-code auth logout`: delegate Pi credential cleanup for Codex credentials or delete fallback credentials.
- `pi-code run [prompt]`: start one agent session in the current workspace.
- `pi-code resume [session-id]`: reopen a local session.
- `pi-code memory list|forget`: inspect or remove local memories.

Rationale: a narrow CLI keeps the first product close to the coding harness problem. GUI and multi-channel integrations can arrive later after the loop is reliable.

Rejected alternative: start with CLI + GUI + chat integrations. That widens state, auth, and telemetry concerns before the agent loop is proven.

### 2. Implementation Stack

Use Bun for the package runtime, test runner, and executable packaging. Use TypeScript for source. Use `@earendil-works/pi-coding-agent` / `@earendil-works/pi-agent-core` as the concrete Pi integration surface, subject to API verification during implementation.

Proposed layout:

```text
src/
  cli/
    index.ts
    commands/auth.ts
    commands/run.ts
  auth/
    pi-codex-auth-adapter.ts
    api-key-fallback.ts
    token-redaction.ts
  agent/
    session-runner.ts
    pi-agent-adapter.ts
    system-prompt.ts
    completion-tool.ts
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
    compactor.ts
    cost-meter.ts
    cache-policy.ts
  memory/
    store.ts
    extractor.ts
    gate.ts
    dedupe.ts
  policy/
    permissions.ts
    workspace-sandbox.ts
  storage/
    paths.ts
    json-db.ts
```

### 3. Pi Codex Auth Boundary

Prefer Pi's existing Codex auth implementation over a new OAuth implementation. Local evidence from the installed Pi package shows:

- Pi package: `@earendil-works/pi-coding-agent`.
- Core packages include `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai`.
- Pi supports `/login` in interactive mode.
- Pi supports ChatGPT Plus/Pro through the `openai-codex` provider.
- Pi stores OAuth and API-key credentials in `~/.pi/agent/auth.json`.
- Pi auto-refreshes OAuth tokens when expired.
- Pi credential resolution order is CLI API key, auth file, environment variable, then custom provider config.

Implement auth as a thin adapter over Pi's auth state:

```ts
interface CredentialProvider {
  readonly id: "pi-openai-codex" | "openai-api-key-fallback";
  status(): Promise<AuthStatus>;
  login(): Promise<void>;
  validate(): Promise<AuthStatus>;
  logout(): Promise<void>;
}
```

OpenAI's public Codex docs describe local Codex authentication with ChatGPT account, API key, and access token modes. The CLI reference also exposes `codex login --device-auth`, `codex login --with-api-key`, and `codex login --with-access-token`. For this product, the supported boundary is:

- Pi `openai-codex` mode for ChatGPT Plus/Pro Codex subscription usage.
- OpenAI API key fallback for normal OpenAI Platform billing.
- Access-token import only if Pi exposes a supported API or file-compatible path for it.

First-release behavior:

- If Pi already has a valid `openai-codex` login, use it.
- If Pi is installed but not logged in, `pi-code auth login` launches or guides the user through Pi's `/login` flow.
- If Pi is unavailable or Codex login is not desired, support `OPENAI_API_KEY` and a minimal local API-key fallback.
- Do not copy Pi OAuth tokens into a second credential store.
- Do not print or persist raw token material in this product's transcripts.

Browser/device OAuth remains Pi-owned. The product must not reverse-engineer or scrape private login endpoints.

Credential storage:

- Prefer Pi's existing `~/.pi/agent/auth.json` for Codex credentials.
- For fallback API keys, prefer environment variables or the same Pi-supported auth-file conventions.
- Store only the minimum needed fallback credential material.
- Redact all tokens in logs, traces, and error messages.

### 4. Agent Loop

The session runner owns a single loop:

```text
user prompt
  -> assemble context
  -> call Pi agent/model turn
  -> execute approved tool calls
  -> append observations
  -> compact or continue
  -> finish only through structured finish tool
```

Tools are grouped by risk:

- Safe parallel tools: read file, grep, glob, git status/diff, web fetch.
- Mutating tools: patch edit, write file.
- Dangerous tools: shell command with destructive patterns, delete, chmod, networked publishing.

Policy:

- Safe reads may run in parallel.
- Mutating tools run serially and are recorded in the transcript.
- Dangerous tools require explicit user approval or are rejected in unattended mode.
- Interruptions cancel active tools and produce a clean observation back to the model.

### 5. Todo Planning

Add a `todo_write` tool that replaces the entire todo list for a session. It must enforce:

- at most one `in_progress` item,
- stable order,
- clear statuses: `pending`, `in_progress`, `completed`,
- session-scoped storage.

Rationale: whole-list replacement avoids fragile item-id patching and keeps the model's current plan visible.

### 6. Structured Completion

Do not detect completion by looking for a magic text marker in model output. Add a `finish` tool with a schema:

```ts
type FinishPayload = {
  status: "complete" | "blocked";
  summary: string;
  changedFiles: string[];
  verification: string[];
  risks: string[];
};
```

The CLI only exits as successful when the model calls `finish` with `status: "complete"` and the runner has no active tools.

### 7. Context And Cost Control

The system prompt and tool definitions must be byte-stable across turns unless configuration changes. Dynamic values such as date, workspace path, auth status, and token budget go into a separate runtime context block.

Provider hooks:

- For OpenAI, rely on provider-reported cached-token accounting where available and preserve stable prefix order.
- For providers with explicit cache-control markers, add adapter-specific cache policies without leaking them into the generic harness.

Budget policy:

- Show per-turn input/output/cached-token estimates when available.
- Warn before compaction.
- Compact before hitting model context limits.
- Preserve user intent, current todo list, changed files, approvals, and recent tool observations during compaction.

### 8. Local Memory Governance

Memory is local and split by scope:

- user profile memory,
- project memory,
- session notes.

Auto-extracted memory must pass:

- confidence threshold,
- dedupe check,
- conflict check,
- scope selection.

Explicit remember intent bypasses the confidence floor but not safety or conflict checks. The CLI prints memory events such as accepted, skipped duplicate, or rejected conflict.

### 9. Security Model

Security defaults:

- Never print secrets.
- Never send local memories unless selected for the current turn.
- Never execute destructive shell commands without approval.
- Never write outside the workspace unless the user approves the exact path.
- Store transcripts locally and allow session deletion.

## Risks / Trade-offs

- Pi auth API ambiguity -> Treat Pi's CLI/docs/auth file as the integration boundary; do not duplicate OAuth or depend on undocumented OpenAI login internals.
- Pi package API drift -> Wrap Pi behind `PiAgentAdapter` and `PiCodexAuthAdapter`; keep contract tests around both adapters.
- Overly small tool surface may feel limited -> Start narrow, then add tools only when repeated tasks prove the need.
- Memory quality may be too conservative -> Let users lower thresholds, but keep transparent event logs.
- Prompt caching may vary by provider -> Treat caching as an optimization with telemetry, not as a correctness dependency.
- Shell tools can damage user workspaces -> Serial execution, permission policy, command display, and interrupt cleanup are required.

## Migration Plan

This is a greenfield product. Implementation can start by creating the Bun/TypeScript project, then adding Pi auth reuse and the agent loop in slices.

Rollback strategy for future implementation:

- Keep generated app files isolated from OpenSpec artifacts.
- Preserve user state under a single config root.
- Make `pi-code auth logout` delegate to Pi credential cleanup for Pi-owned credentials and make `pi-code session delete` remove product-owned local state.

## Open Questions

- Which Pi auth operations are importable API calls versus only CLI/TUI flows in `@earendil-works/pi-coding-agent` 0.76.0?
- Should `pi-code auth login` spawn interactive `pi` for `/login`, or should it call an internal Pi auth module if the exported API is stable?
- Should first release include web fetch, or should web access be disabled until the permission model is tested?
- Should shell execution default to ask-before-run for all commands or only risky commands?

## Sources Consulted

- WeChat article provided by the user: https://mp.weixin.qq.com/s/xDPrWqLYAaRhsKoyGHZrRw
- OpenAI Codex auth: https://developers.openai.com/codex/auth
- OpenAI Codex CLI: https://developers.openai.com/codex/cli
- OpenAI Codex CLI reference: https://developers.openai.com/codex/cli/reference
- OpenAI Codex access tokens: https://developers.openai.com/codex/enterprise/access-tokens
- Pi local docs consulted from installed package:
  - `@earendil-works/pi-coding-agent` 0.76.0 `docs/providers.md`
  - `@earendil-works/pi-coding-agent` 0.76.0 `docs/quickstart.md`
  - `@earendil-works/pi-coding-agent` 0.76.0 `docs/settings.md`
