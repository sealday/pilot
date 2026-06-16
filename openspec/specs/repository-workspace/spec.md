## Purpose

Define the Bun workspace layout, root command surface, and product-owned runtime state locations for the `pilot` CLI repository.

## Requirements

### Requirement: Use Bun Workspace Layout
The repository SHALL be organized as a Bun monorepo with a private root workspace and the `pilot` CLI in a dedicated workspace package.

#### Scenario: Install from repository root
- **WHEN** a user runs `bun install` from the repository root
- **THEN** Bun installs dependencies for the workspace root and the `packages/pilot` workspace package using the shared lockfile

#### Scenario: Package owns product metadata
- **WHEN** a developer inspects `packages/pilot/package.json`
- **THEN** it defines the `pilot` package name, `pilot` binary, product dependencies, and package-local build/test/typecheck scripts

### Requirement: Provide Root Bun Commands
The repository root SHALL expose Bun scripts for common validation, build, and direct CLI execution workflows.

#### Scenario: Validate from repository root
- **WHEN** a developer runs `bun run test`, `bun run typecheck`, or `bun run build` from the repository root
- **THEN** the command delegates to the `packages/pilot` workspace package and runs successfully

#### Scenario: Run pilot from repository root
- **WHEN** a user runs `bun run pilot -- --help` from the repository root
- **THEN** the CLI prints `pilot` command usage

#### Scenario: Blocked run from repository root
- **WHEN** a user runs `bun run pilot -- run "inspect this project"` from the repository root before a real Pi adapter is connected
- **THEN** the CLI returns the existing blocked result instead of faking a successful agent run

### Requirement: Store Pilot Runtime State Under Pilot Directory
The CLI SHALL store product-owned workspace session state under `.pilot`.

#### Scenario: Persist session transcript
- **WHEN** a session transcript is persisted for session `abc123`
- **THEN** the transcript is written to `.pilot/sessions/abc123/transcript.json`

#### Scenario: Search skips product runtime state
- **WHEN** local grep or glob tools enumerate workspace files
- **THEN** they skip `.pilot` runtime state alongside `.git` and `node_modules`
