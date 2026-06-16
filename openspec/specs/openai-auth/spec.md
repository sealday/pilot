## Purpose

Define how `pilot` reuses Pi-owned OpenAI Codex authentication, supports API-key fallback, and protects credential material.

## Requirements

### Requirement: Reuse Pi Codex Credentials
The CLI SHALL prefer Pi's existing `openai-codex` authentication state for OpenAI Codex access.

#### Scenario: Pi Codex credentials are present
- **WHEN** Pi has a valid `openai-codex` login and the user runs `pilot auth status`
- **THEN** the CLI reports Codex subscription mode as available without printing OAuth token material

#### Scenario: Pi Codex credentials are missing
- **WHEN** Pi is installed but no valid `openai-codex` login exists
- **THEN** the CLI tells the user that Codex login is unavailable and offers the Pi-backed login flow

### Requirement: Delegate Pi Codex Login
The CLI SHALL delegate ChatGPT Plus/Pro Codex OAuth login to Pi instead of implementing a separate OAuth flow.

#### Scenario: Start Pi-backed login
- **WHEN** the user runs `pilot auth login` and chooses Codex subscription mode
- **THEN** the CLI launches or guides the user through Pi's `/login` flow for `openai-codex`

#### Scenario: Login completes
- **WHEN** the Pi-backed login succeeds
- **THEN** the CLI detects the Pi-owned `openai-codex` auth state and reports authenticated status without copying tokens into product-owned storage

### Requirement: Configure OpenAI API-Key Fallback
The CLI SHALL allow API-key fallback when Pi Codex login is unavailable or not desired.

#### Scenario: Configure API key from environment
- **WHEN** `OPENAI_API_KEY` is set and the user runs `pilot auth status`
- **THEN** the CLI reports API-key mode as available without printing the key

#### Scenario: Store API key through Pi-compatible auth file
- **WHEN** the user runs `pilot auth login` and selects API-key fallback mode
- **THEN** the CLI stores or delegates storage using Pi-compatible auth conventions and redacts the key from output

### Requirement: Validate OpenAI Credentials
The CLI SHALL validate stored credentials before sending model requests.

#### Scenario: Valid credentials
- **WHEN** credentials are present and accepted by the provider validation call
- **THEN** the CLI reports authenticated status and allows `pilot run`

#### Scenario: Invalid credentials
- **WHEN** credentials are missing, expired, or rejected
- **THEN** the CLI blocks `pilot run` and displays a redacted remediation message

### Requirement: Logout OpenAI Credentials
The CLI SHALL allow the user to remove locally stored OpenAI credentials.

#### Scenario: Logout delegates Pi-owned Codex credentials
- **WHEN** the user runs `pilot auth logout`
- **THEN** the CLI delegates or instructs Pi-owned Codex credential cleanup and confirms without printing previous values

#### Scenario: Logout removes fallback secret material
- **WHEN** the user runs `pilot auth logout` for API-key fallback credentials
- **THEN** the CLI deletes product-owned fallback secret material and confirms without printing previous values

### Requirement: Protect Secret Material
The CLI MUST NOT expose credential values in logs, errors, transcripts, or telemetry.

#### Scenario: Provider error contains token fragment
- **WHEN** a provider error includes a credential-like string
- **THEN** the CLI redacts that string before displaying or persisting the error

#### Scenario: Reading Pi auth state
- **WHEN** the CLI reads Pi-owned auth state
- **THEN** it extracts only provider type, expiry/status metadata, and account hints needed for display, never raw access or refresh tokens
