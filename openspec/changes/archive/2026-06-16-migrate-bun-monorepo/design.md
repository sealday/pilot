## Context

The repository currently has one Bun package at the root with source in `src/`, tests in `tests/`, and package scripts in root `package.json`. The next requested state is a Bun monorepo where the CLI remains runnable from the root and where the repository can later grow additional packages without reworking the root again. The product-facing name becomes `pilot`, replacing the previous tentative `pi-code` name.

Bun supports workspace package management via root `package.json` `workspaces`, and supports running workspace scripts using `--filter` or `--workspaces`.

## Decisions

### 1. Root Becomes Workspace Orchestrator

The root `package.json` remains private and owns workspace-level commands only. It should not expose the CLI binary directly. It defines:

- `workspaces`: `["packages/*"]`
- root scripts that delegate to `packages/pilot`
- repository-level validation scripts

Rationale: the root should be stable for contributors and CI. Product-specific dependencies and bin metadata belong in the package that owns the product.

### 2. CLI Package Moves To `packages/pilot`

Move the current product package into:

```text
packages/pilot/
  package.json
  tsconfig.json
  src/
  tests/
```

The package uses the private npm name `pilot` and exposes a `pilot` bin. Existing imports should remain relative inside the package.

Rationale: a single package move is enough for monorepo readiness and avoids inventing shared packages prematurely.

### 3. Root Commands Are The Public Run Surface

Root-level scripts should provide the commands a user can run immediately:

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run pilot -- --help
bun run pilot -- run "inspect this project"
```

Implementation may use `bun --filter pilot <script>` or `bun --cwd packages/pilot run <script>` depending on which form is more reliable in this repo and Bun version.

### 4. User-Facing Product Name Is `pilot`

The migration should remove `pi-code` from the live product surface:

- package name: `pilot`
- CLI binary and help examples: `pilot`
- root run script: `bun run pilot -- ...`
- package directory: `packages/pilot`
- workspace-local session state directory: `.pilot`

Pi Codex authentication terms and internal names such as `PiCodexAuthAdapter` remain valid because they describe the upstream Pi authentication boundary, not the product name.

### 5. Runtime Behavior Stays Conservative

The monorepo migration must not change the CLI safety semantics. In particular:

- default `pilot run` remains blocked while the real Pi adapter is disconnected,
- persisted transcripts remain redacted,
- local tool workspace and git/shell hardening remain intact,
- tests continue to cover the first-release tool surface.

### 6. Delivery Happens After Verification

After implementation and archive verification:

1. merge the development branch into `main`,
2. push `main` to `origin`,
3. delete remote branches other than `main`.

Rationale: these are repository delivery operations, not product behavior. They happen only after local validation and Comet verification pass.

## Risks

- Path migration can break test imports, build output, and transcript path expectations.
- Product rename can leave stale `pi-code` text in help, README, specs, or tests unless checked explicitly.
- Bun workspace command syntax can be subtle; the implementation should verify actual root commands, not only package-local commands.
- Remote branch deletion is destructive; only delete branches that are not `main`, and only after `main` has the merged result pushed.

## Sources Consulted

- Bun Workspaces documentation: root `package.json` `workspaces` and workspace script execution.
- Bun Filter documentation: `--filter` for selecting workspace packages and running scripts.
