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
