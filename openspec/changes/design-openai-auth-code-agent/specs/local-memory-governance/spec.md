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
