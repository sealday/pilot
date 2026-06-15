# Comet Design Handoff

- Change: design-openai-auth-code-agent
- Phase: design
- Mode: compact
- Context hash: e410e9d2ebc900a2e6262947cf4a7d4429ac7c1bd0250efa1bcfd5267a442f2f

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/design-openai-auth-code-agent/proposal.md

- Source: openspec/changes/design-openai-auth-code-agent/proposal.md
- Lines: 1-59
- SHA256: bbbcfbecd9f09e7cd95657c7fa17cd6e044cc314bbf3379273b3a1190035d2ce

```md
## Why

The referenced article argues that coding agents become expensive and less reliable when the harness around the model is too broad, too noisy, and too opaque. This change proposes a lean Claude Code-like coding agent product that keeps the model loop small, adds OpenAI-friendly authentication, and uses pi-agent, Bun, and TypeScript as the implementation stack.

The goal is to define a product and architecture before implementation so the first build can stay narrow: one CLI, one reliable agent loop, one local state model, and a small set of coding tools.

Source inputs:
- WeChat article: "openclaw、Hermes 越用越傻越烧钱，我用 Rust 重写的 small Rust Hermes，既省钱又好用" by 老码小张.
- OpenAI Codex authentication docs:
  - https://developers.openai.com/codex/auth
  - https://developers.openai.com/codex/cli
  - https://developers.openai.com/codex/cli/reference
  - https://developers.openai.com/codex/enterprise/access-tokens
- pi-agent + Bun + TypeScript as requested technical stack.

## What Changes

- Introduce a new TypeScript/Bun CLI coding agent product concept, tentatively named `pi-code`.
- Support OpenAI authentication by reusing Pi's existing Codex login experience first:
  - delegate ChatGPT Plus/Pro Codex OAuth login to Pi where possible,
  - read Pi's configured `openai-codex` provider status without copying or printing secrets,
  - keep OpenAI API key mode as a fallback for API-billing users.
- Build the runtime around Pi's coding-agent primitives instead of a hand-rolled model loop.
- Define a compact coding harness with file read/write, patch edit, shell, grep/glob, git, web fetch, todo, and finish tools.
- Add context and cost controls inspired by the article:
  - stable system/tool prefix,
  - model-provider prompt cache hooks where supported,
  - compaction before context overflow,
  - visible token/cost telemetry.
- Add local memory governance:
  - confidence-gated auto memory,
  - explicit user "remember" override,
  - dedupe and conflict checks,
  - transparent memory event reporting.
- Add a Claude Code-like task planning surface:
  - whole-list todo replacement,
  - only one active item at a time,
  - session-scoped todo state,
  - structured finish signal instead of text marker scraping.

## Capabilities

### New Capabilities

- `openai-auth`: Pi Codex credential reuse, OpenAI API-key fallback, provider selection, session validation, logout delegation, and non-leaky auth error handling.
- `coding-harness-loop`: CLI interaction loop, model/tool orchestration through Pi coding-agent primitives, tool permission policy, todo planning, interruption handling, and structured completion.
- `context-cost-control`: stable prompt prefix discipline, provider-aware caching, compaction, token budget enforcement, and user-visible cost telemetry.
- `local-memory-governance`: local profile/project memory storage, confidence thresholds, explicit remember intent, dedupe/conflict controls, and transparent memory audit events.

### Modified Capabilities

- None. This repository has no existing OpenSpec capabilities.

## Impact

- Adds OpenSpec planning artifacts for a new product in an otherwise empty repository.
- Future implementation will add a Bun/TypeScript package, CLI entrypoint, Pi coding-agent integration, auth reuse adapter, local memory storage, tests, and developer documentation.
- Security impact: local credential handling must avoid committing secrets, must redact logs, and must support logout/revocation cleanup.
- Product impact: the first release intentionally excludes GUI, WeChat integration, remote sync, multi-model marketplace behavior, and broad plugin ecosystems.
```

## openspec/changes/design-openai-auth-code-agent/design.md

- Source: openspec/changes/design-openai-auth-code-agent/design.md
- Lines: 1-279
- SHA256: 4b8a32b1ad7004c5432f6a9cb29e5a40d0ba384070d974da0cdf4553b898ef4a

[TRUNCATED]

```md
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
```

Full source: openspec/changes/design-openai-auth-code-agent/design.md

## openspec/changes/design-openai-auth-code-agent/tasks.md

- Source: openspec/changes/design-openai-auth-code-agent/tasks.md
- Lines: 1-39
- SHA256: f7b1d09e4484245fe9f298850f2600a09754be04b8c09d3adeb8a5023c6158e7

```md
## 1. Project Setup

- [ ] 1.1 Create a Bun + TypeScript project with package scripts for test, lint, typecheck, and CLI execution.
- [ ] 1.2 Add the selected Pi dependency surface (`@earendil-works/pi-coding-agent` / `@earendil-works/pi-agent-core`) and wrap it behind local adapter contracts.
- [ ] 1.3 Add repository configuration for TypeScript, formatting, tests, and executable packaging.

## 2. OpenAI Auth

- [ ] 2.1 Implement `PiCodexAuthAdapter` to detect Pi `openai-codex` status without exposing raw token material.
- [ ] 2.2 Implement `pi-code auth login`, `auth status`, and `auth logout` commands that delegate to Pi for Codex auth.
- [ ] 2.3 Implement OpenAI API-key fallback using Pi-compatible auth conventions or environment variables.
- [ ] 2.4 Add tests for missing, valid, expired, delegated logout, fallback API-key, and redacted credential flows.

## 3. Agent Harness

- [ ] 3.1 Implement the session runner around Pi coding-agent primitives with transcript persistence.
- [ ] 3.2 Implement first-release coding tools: file read, patch edit, shell, grep, glob, git, web fetch, todo write, and finish.
- [ ] 3.3 Implement tool risk classification, serial mutation execution, safe read parallelism, and interruption cleanup.
- [ ] 3.4 Implement structured finish handling and blocked-session resumability.

## 4. Context And Cost

- [ ] 4.1 Implement stable prompt prefix generation and separate runtime context injection.
- [ ] 4.2 Implement provider usage accounting and cached-token display when provider data is available.
- [ ] 4.3 Implement context budget estimation and compaction preserving current task, approvals, changed files, todos, and recent observations.
- [ ] 4.4 Add tests for compaction boundaries and stable prefix behavior.

## 5. Local Memory

- [ ] 5.1 Implement local user, project, and session memory stores.
- [ ] 5.2 Implement confidence gating, explicit remember intent, duplicate detection, and conflict detection.
- [ ] 5.3 Add memory inspection and deletion commands.
- [ ] 5.4 Add tests for accepted, skipped duplicate, rejected conflict, and explicit remember flows.

## 6. End-To-End CLI Validation

- [ ] 6.1 Add a smoke test for `pi-code run` using a stub model/provider.
- [ ] 6.2 Add a fixture workspace where the agent reads a file, edits it, runs a test command, updates todos, and calls finish.
- [ ] 6.3 Document first-release usage, auth modes, security model, and non-goals.
```

## openspec/changes/design-openai-auth-code-agent/specs/coding-harness-loop/spec.md

- Source: openspec/changes/design-openai-auth-code-agent/specs/coding-harness-loop/spec.md
- Lines: 1-52
- SHA256: 47543da887f4b9bb1fc61192cf9e13a51702f718bee116ac0e483687ce389bb6

```md
## ADDED Requirements

### Requirement: Run Coding Agent Sessions
The CLI SHALL run a coding agent session in the current workspace using Pi-backed model orchestration.

#### Scenario: Start a session
- **WHEN** the user runs `pi-code run "inspect this project"`
- **THEN** the CLI creates a local session, sends the prompt through the agent runner, and streams model/tool progress to the terminal

### Requirement: Provide Minimal Coding Tools
The harness SHALL expose a small first-release tool set for coding work.

#### Scenario: Tool set is available
- **WHEN** an agent turn starts
- **THEN** the model has access to file read, patch edit, shell, grep, glob, git, web fetch, todo write, and finish tools

### Requirement: Enforce Tool Risk Policy
The harness SHALL classify tools by risk and execute them according to the permission policy.

#### Scenario: Safe read tools run together
- **WHEN** the model requests multiple file read or search operations
- **THEN** the harness may execute them in parallel and return observations for each call

#### Scenario: Mutating tools run serially
- **WHEN** the model requests file edits
- **THEN** the harness executes edits one at a time and records each changed path

#### Scenario: Risky shell command is blocked or approved
- **WHEN** the model requests a destructive shell command
- **THEN** the harness requires explicit approval or rejects the command in unattended mode

### Requirement: Maintain Session Todo List
The harness SHALL provide a session-scoped todo list with whole-list replacement.

#### Scenario: Write valid todo list
- **WHEN** the model calls `todo_write` with one `in_progress` item
- **THEN** the CLI displays the updated list and stores it only for the current session

#### Scenario: Reject multiple active todos
- **WHEN** the model calls `todo_write` with more than one `in_progress` item
- **THEN** the harness rejects the tool call and asks the model to submit a corrected list

### Requirement: Finish Through Structured Tool
The harness SHALL require a structured finish tool call to complete a session.

#### Scenario: Complete session
- **WHEN** the model calls `finish` with `status: "complete"` and there are no active tools
- **THEN** the CLI prints the summary, verification evidence, changed files, and residual risks

#### Scenario: Blocked session
- **WHEN** the model calls `finish` with `status: "blocked"`
- **THEN** the CLI reports the blocker and keeps the session resumable
```

## openspec/changes/design-openai-auth-code-agent/specs/context-cost-control/spec.md

- Source: openspec/changes/design-openai-auth-code-agent/specs/context-cost-control/spec.md
- Lines: 1-33
- SHA256: ff30123e99374a5c1ada36b3d1efea40e38a83a7f1d8f83ae74cb8948fae16ba

```md
## ADDED Requirements

### Requirement: Preserve Stable Prompt Prefix
The harness SHALL keep system prompt and tool definition content stable across turns unless configuration changes.

#### Scenario: Dynamic runtime values change
- **WHEN** date, workspace path, auth status, or token budget changes
- **THEN** the harness places those values in a separate runtime context block rather than mutating the stable prefix

### Requirement: Track Token And Cost Signals
The CLI SHALL display token and cost signals returned by the model provider when available.

#### Scenario: Provider returns usage
- **WHEN** a model response includes input, output, or cached token usage
- **THEN** the CLI records the usage in the session transcript and shows a concise per-turn summary

### Requirement: Compact Context Before Overflow
The harness SHALL compact session context before exceeding the selected model context window.

#### Scenario: Transcript approaches budget
- **WHEN** projected context size crosses the configured compaction threshold
- **THEN** the harness summarizes older turns while preserving current task, approvals, changed files, todos, and recent tool observations

### Requirement: Treat Caching As Provider Optimization
The harness MUST NOT make correctness depend on prompt caching.

#### Scenario: Provider lacks explicit cache controls
- **WHEN** the active provider does not expose explicit prompt cache controls
- **THEN** the harness still runs correctly and reports caching as unavailable or provider-managed

#### Scenario: Provider reports cached tokens
- **WHEN** the active provider reports cached-token usage
- **THEN** the harness includes cached-token usage in the cost summary
```

## openspec/changes/design-openai-auth-code-agent/specs/local-memory-governance/spec.md

- Source: openspec/changes/design-openai-auth-code-agent/specs/local-memory-governance/spec.md
- Lines: 1-37
- SHA256: dc622f72184dedcf7b330ea74121ccc65fb91b07fa2e15ed6b48199ad65e1b4a

```md
## ADDED Requirements

### Requirement: Store Memory Locally By Scope
The harness SHALL store memory locally and separate it by user, project, and session scope.

#### Scenario: Project memory is written
- **WHEN** the agent accepts a project-specific memory
- **THEN** the memory is stored under the local project scope and is not sent to unrelated workspaces

### Requirement: Gate Auto Memory By Confidence
The harness SHALL require auto-extracted memories to meet a configured confidence threshold.

#### Scenario: Auto memory below threshold
- **WHEN** a candidate memory has confidence below the configured threshold
- **THEN** the harness skips persistence and records a transparent skipped event

#### Scenario: Auto memory meets threshold
- **WHEN** a candidate memory meets the confidence threshold and passes duplicate and conflict checks
- **THEN** the harness persists it to the selected local scope

### Requirement: Honor Explicit Remember Intent
The harness SHALL treat explicit user remember instructions as intentional memory candidates.

#### Scenario: User explicitly asks to remember preference
- **WHEN** the user says to remember a durable preference
- **THEN** the harness may bypass the confidence floor but still performs safety and conflict checks

### Requirement: Dedupe And Conflict Check Memory
The harness SHALL prevent memory quality from degrading through duplicate or contradictory entries.

#### Scenario: Similar memory already exists
- **WHEN** a candidate memory is similar to an existing memory above the duplicate threshold
- **THEN** the harness skips the candidate and reports which existing memory caused the skip

#### Scenario: Candidate conflicts with existing memory
- **WHEN** a candidate contradicts existing memory
- **THEN** the harness rejects automatic persistence and requires user confirmation before replacing the old memory
```

## openspec/changes/design-openai-auth-code-agent/specs/openai-auth/spec.md

- Source: openspec/changes/design-openai-auth-code-agent/specs/openai-auth/spec.md
- Lines: 1-67
- SHA256: e155079ec853e56538d1d19df18a80b8d6544d8469f9858d59af4579bb663d00

```md
## ADDED Requirements

### Requirement: Reuse Pi Codex Credentials
The CLI SHALL prefer Pi's existing `openai-codex` authentication state for OpenAI Codex access.

#### Scenario: Pi Codex credentials are present
- **WHEN** Pi has a valid `openai-codex` login and the user runs `pi-code auth status`
- **THEN** the CLI reports Codex subscription mode as available without printing OAuth token material

#### Scenario: Pi Codex credentials are missing
- **WHEN** Pi is installed but no valid `openai-codex` login exists
- **THEN** the CLI tells the user that Codex login is unavailable and offers the Pi-backed login flow

### Requirement: Delegate Pi Codex Login
The CLI SHALL delegate ChatGPT Plus/Pro Codex OAuth login to Pi instead of implementing a separate OAuth flow.

#### Scenario: Start Pi-backed login
- **WHEN** the user runs `pi-code auth login` and chooses Codex subscription mode
- **THEN** the CLI launches or guides the user through Pi's `/login` flow for `openai-codex`

#### Scenario: Login completes
- **WHEN** the Pi-backed login succeeds
- **THEN** the CLI detects the Pi-owned `openai-codex` auth state and reports authenticated status without copying tokens into product-owned storage

### Requirement: Configure OpenAI API-Key Fallback
The CLI SHALL allow API-key fallback when Pi Codex login is unavailable or not desired.

#### Scenario: Configure API key from environment
- **WHEN** `OPENAI_API_KEY` is set and the user runs `pi-code auth status`
- **THEN** the CLI reports API-key mode as available without printing the key

#### Scenario: Store API key through Pi-compatible auth file
- **WHEN** the user runs `pi-code auth login` and selects API-key fallback mode
- **THEN** the CLI stores or delegates storage using Pi-compatible auth conventions and redacts the key from output

### Requirement: Validate OpenAI Credentials
The CLI SHALL validate stored credentials before sending model requests.

#### Scenario: Valid credentials
- **WHEN** credentials are present and accepted by the provider validation call
- **THEN** the CLI reports authenticated status and allows `pi-code run`

#### Scenario: Invalid credentials
- **WHEN** credentials are missing, expired, or rejected
- **THEN** the CLI blocks `pi-code run` and displays a redacted remediation message

### Requirement: Logout OpenAI Credentials
The CLI SHALL allow the user to remove locally stored OpenAI credentials.

#### Scenario: Logout delegates Pi-owned Codex credentials
- **WHEN** the user runs `pi-code auth logout`
- **THEN** the CLI delegates or instructs Pi-owned Codex credential cleanup and confirms without printing previous values

#### Scenario: Logout removes fallback secret material
- **WHEN** the user runs `pi-code auth logout` for API-key fallback credentials
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

