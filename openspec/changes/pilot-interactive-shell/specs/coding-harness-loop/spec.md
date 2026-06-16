## MODIFIED Requirements

### Requirement: Run Coding Agent Sessions
The CLI SHALL run coding agent sessions in the current workspace using Pi-backed model orchestration.

#### Scenario: Start an interactive session
- **WHEN** the user runs `pilot` with no arguments in an interactive terminal
- **THEN** the CLI delegates to the Pi coding-agent interactive runtime and opens a multi-turn coding-agent interface for the current workspace

#### Scenario: Start an explicit single-prompt session
- **WHEN** the user runs `pilot run "inspect this project"`
- **THEN** the CLI creates a local session, sends the prompt through the agent runner, and streams model/tool progress to the terminal

#### Scenario: Preserve explicit help outside the interactive loop
- **WHEN** the user runs `pilot --help`
- **THEN** the CLI prints usage for pilot-owned commands without starting an agent session

#### Scenario: Keep explicit pilot commands outside the interactive loop
- **WHEN** the user runs `pilot auth status`, `pilot memory list`, or `pilot run "inspect this project"`
- **THEN** the CLI routes the command to the pilot-owned command handler instead of the Pi interactive runtime
