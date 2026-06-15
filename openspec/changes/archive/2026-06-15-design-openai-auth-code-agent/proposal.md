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
