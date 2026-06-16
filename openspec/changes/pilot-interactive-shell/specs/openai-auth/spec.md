## MODIFIED Requirements

### Requirement: Reuse Pi Codex Credentials
The CLI SHALL prefer Pi's existing `openai-codex` authentication state for OpenAI Codex access.

#### Scenario: Pi Codex credentials are present
- **WHEN** Pi has a valid `openai-codex` login and the user runs `pilot auth status`
- **THEN** the CLI reports Codex subscription mode as available without printing OAuth token material

#### Scenario: Pi Codex credentials are missing
- **WHEN** Pi is installed but no valid `openai-codex` login exists
- **THEN** the CLI tells the user that Codex login is unavailable and offers the Pi-backed login flow

#### Scenario: Interactive session reuses Pi auth directory
- **WHEN** the user runs `pilot` with no arguments and the CLI delegates to the Pi interactive runtime
- **THEN** the CLI does not override Pi's agent config/auth directory and the delegated runtime can use Pi-owned Codex credentials

### Requirement: Delegate Pi Codex Login
The CLI SHALL delegate ChatGPT Plus/Pro Codex OAuth login to Pi instead of implementing a separate OAuth flow.

#### Scenario: Start Pi-backed login
- **WHEN** the user runs `pilot auth login` and chooses Codex subscription mode
- **THEN** the CLI launches or guides the user through Pi's `/login` flow for `openai-codex`

#### Scenario: Login completes
- **WHEN** the Pi-backed login succeeds
- **THEN** the CLI detects the Pi-owned `openai-codex` auth state and reports authenticated status without copying tokens into product-owned storage

#### Scenario: Interactive login guidance is Pi-owned
- **WHEN** the delegated Pi interactive runtime requires OpenAI Codex authentication
- **THEN** the user is shown Pi's normal login guidance rather than a separate pilot OAuth flow

### Requirement: Protect Secret Material
The CLI MUST NOT expose credential values in logs, errors, transcripts, or telemetry.

#### Scenario: Provider error contains token fragment
- **WHEN** a provider error includes a credential-like string
- **THEN** the CLI redacts that string before displaying or persisting the error

#### Scenario: Reading Pi auth state
- **WHEN** the CLI reads Pi-owned auth state
- **THEN** it extracts only provider type, expiry/status metadata, and account hints needed for display, never raw access or refresh tokens

#### Scenario: Delegated interactive sessions do not copy credentials
- **WHEN** `pilot` configures product-owned runtime state for a delegated Pi interactive session
- **THEN** the CLI stores session artifacts under `.pilot` without copying access tokens, refresh tokens, or API keys into pilot-owned files
