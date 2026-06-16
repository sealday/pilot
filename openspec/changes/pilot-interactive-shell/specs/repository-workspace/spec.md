## MODIFIED Requirements

### Requirement: Provide Root Bun Commands
The repository root SHALL expose Bun scripts for common validation, build, and direct CLI execution workflows.

#### Scenario: Validate from repository root
- **WHEN** a developer runs `bun run test`, `bun run typecheck`, or `bun run build` from the repository root
- **THEN** the command delegates to the `packages/pilot` workspace package and runs successfully

#### Scenario: Run interactive pilot from repository root
- **WHEN** a user runs `bun run pilot` from the repository root in an interactive terminal
- **THEN** the CLI starts the Pi-backed interactive coding-agent interface in the current workspace

#### Scenario: Print pilot help from repository root
- **WHEN** a user runs `bun run pilot -- --help` from the repository root
- **THEN** the CLI prints `pilot` command usage without starting the interactive interface

#### Scenario: Blocked explicit run from repository root
- **WHEN** a user runs `bun run pilot -- run "inspect this project"` from the repository root before a real Pi adapter is connected
- **THEN** the CLI returns the existing blocked result instead of faking a successful agent run

### Requirement: Store Pilot Runtime State Under Pilot Directory
The CLI SHALL store product-owned workspace session state under `.pilot`.

#### Scenario: Persist harness session transcript
- **WHEN** a `pilot run` session transcript is persisted for session `abc123`
- **THEN** the transcript is written to `.pilot/sessions/abc123/transcript.json`

#### Scenario: Persist delegated Pi interactive sessions
- **WHEN** `pilot` delegates an interactive session to the Pi runtime and no Pi session directory override is already configured
- **THEN** the CLI configures the delegated session directory under `.pilot/pi-sessions`

#### Scenario: Preserve caller-provided Pi session override
- **WHEN** `PI_CODING_AGENT_SESSION_DIR` is already set and the user runs `pilot`
- **THEN** the CLI does not overwrite the caller-provided Pi session directory

#### Scenario: Search skips product runtime state
- **WHEN** local grep or glob tools enumerate workspace files
- **THEN** they skip `.pilot` runtime state alongside `.git` and `node_modules`
