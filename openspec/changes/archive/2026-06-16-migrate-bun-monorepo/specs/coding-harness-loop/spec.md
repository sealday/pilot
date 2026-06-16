## MODIFIED Requirements

### Requirement: Run Coding Agent Sessions
The CLI SHALL run a coding agent session in the current workspace using Pi-backed model orchestration.

#### Scenario: Start a session
- **WHEN** the user runs `pilot run "inspect this project"`
- **THEN** the CLI creates a local session, sends the prompt through the agent runner, and streams model/tool progress to the terminal
