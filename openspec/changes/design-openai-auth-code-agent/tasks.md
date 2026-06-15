## 1. Project Setup

- [x] 1.1 Create a Bun + TypeScript project with package scripts for test, lint, typecheck, and CLI execution.
- [x] 1.2 Add the selected Pi dependency surface (`@earendil-works/pi-coding-agent` / `@earendil-works/pi-agent-core`) and wrap it behind local adapter contracts.
- [x] 1.3 Add repository configuration for TypeScript, formatting, tests, and executable packaging.

## 2. OpenAI Auth

- [x] 2.1 Implement `PiCodexAuthAdapter` to detect Pi `openai-codex` status without exposing raw token material.
- [x] 2.2 Implement `pi-code auth login`, `auth status`, and `auth logout` commands that delegate to Pi for Codex auth.
- [x] 2.3 Implement OpenAI API-key fallback using Pi-compatible auth conventions or environment variables.
- [x] 2.4 Add tests for missing, valid, expired, delegated logout, fallback API-key, and redacted credential flows.

## 3. Agent Harness

- [x] 3.1 Implement the session runner around Pi coding-agent primitives with transcript persistence.
- [x] 3.2 Implement first-release coding tools: file read, patch edit, shell, grep, glob, git, web fetch, todo write, and finish.
- [x] 3.3 Implement tool risk classification, serial mutation execution, safe read parallelism, and interruption cleanup.
- [x] 3.4 Implement structured finish handling and blocked-session resumability.

## 4. Context And Cost

- [x] 4.1 Implement stable prompt prefix generation and separate runtime context injection.
- [x] 4.2 Implement provider usage accounting and cached-token display when provider data is available.
- [x] 4.3 Implement context budget estimation and compaction preserving current task, approvals, changed files, todos, and recent observations.
- [x] 4.4 Add tests for compaction boundaries and stable prefix behavior.

## 5. Local Memory

- [x] 5.1 Implement local user, project, and session memory stores.
- [x] 5.2 Implement confidence gating, explicit remember intent, duplicate detection, and conflict detection.
- [x] 5.3 Add memory inspection and deletion commands.
- [x] 5.4 Add tests for accepted, skipped duplicate, rejected conflict, and explicit remember flows.

## 6. End-To-End CLI Validation

- [x] 6.1 Add a smoke test for `pi-code run` using a stub model/provider.
- [x] 6.2 Add a fixture workspace where the agent reads a file, edits it, runs a test command, updates todos, and calls finish.
- [x] 6.3 Document first-release usage, auth modes, security model, and non-goals.
