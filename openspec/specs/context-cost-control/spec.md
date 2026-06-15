## Purpose

Define how the harness preserves stable context, tracks provider usage, compacts before overflow, and treats prompt caching as an optimization.

## Requirements

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
