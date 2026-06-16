---
comet_change: migrate-bun-monorepo
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-16-migrate-bun-monorepo
status: final
---

# Pilot Bun Monorepo Design

## Summary

Migrate the current single-package harness into a Bun-managed monorepo and rename the user-facing product from `pi-code` to `pilot`. The repository root becomes the stable contributor surface for install, validation, build, and direct CLI execution. The product package moves to `packages/pilot` and owns source, tests, TypeScript config, dependencies, and bin metadata.

This change is structural and naming-focused. It must not alter the agent runtime contract, OpenAI auth behavior, blocked default adapter behavior, redaction behavior, local tool policy, or memory/context semantics except where user-visible product names and local state paths change.

## Source Of Truth

OpenSpec remains canonical for product requirements. This design implements and patches:

- `openspec/changes/migrate-bun-monorepo/specs/repository-workspace/spec.md`
- `openspec/changes/migrate-bun-monorepo/specs/coding-harness-loop/spec.md`
- `openspec/changes/migrate-bun-monorepo/specs/openai-auth/spec.md`

## Naming Boundary

The live product surface becomes `pilot`:

- package directory: `packages/pilot`
- package name: `pilot`
- binary name: `pilot`
- root run script: `bun run pilot -- ...`
- help text and README examples: `pilot ...`
- workspace-local session state: `.pilot/sessions/...`

Do not keep a `pi-code` compatibility alias in this change. A mixed command surface would make the rename ambiguous and would keep obsolete product language in tests and docs.

Internal terms that describe Pi's upstream auth boundary remain unchanged. `PiCodexAuthAdapter`, `PiAgentAdapter`, and `openai-codex` are still accurate because they describe integration with Pi and Codex authentication rather than the product name.

## Package Layout

Target layout:

```text
package.json
bun.lock
README.md
packages/
  pilot/
    package.json
    tsconfig.json
    src/
    tests/
openspec/
docs/
```

The root `package.json` is private and contains:

- `workspaces: ["packages/*"]`
- repository scripts that delegate to `packages/pilot`
- no product bin metadata
- no product runtime dependencies unless a future shared root tool actually needs them

The `packages/pilot/package.json` contains:

- `name: "pilot"`
- `private: true`
- `type: "module"`
- `bin: { "pilot": "./src/cli/index.ts" }`
- product dependencies on `@earendil-works/pi-agent-core` and `@earendil-works/pi-coding-agent`
- package-local scripts for `test`, `typecheck`, `build`, `lint`, and `cli`

## Root Command Surface

The root commands are the documented public development surface:

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run pilot -- --help
bun run pilot -- run "inspect this project"
```

Implementation should prefer the form that is simplest and verifiably forwards CLI arguments in the installed Bun version. `bun --cwd packages/pilot run <script>` is acceptable for root scripts because it is explicit, stable, and easy to validate from the repository root. Bun workspace metadata still owns package installation and lockfile resolution.

## Runtime State

Session transcripts move from `.pi-code/sessions/<session-id>/transcript.json` to `.pilot/sessions/<session-id>/transcript.json`. The local tool search skip list should skip `.pilot` so agent grep/glob results do not include product-owned runtime state. The old `.pi-code` path does not need migration in this change because the product has not shipped as a stable public release.

## Tests

The migration should update tests rather than weakening assertions:

- CLI help tests assert `pilot` commands.
- E2E smoke tests read persisted transcripts from `.pilot`.
- Session runner tests assert `.pilot` persistence and blocked default `pilot run`.
- Memory command tests assert `pilot memory forget <id>` usage.
- A root CLI smoke check runs `bun run pilot -- --help`.
- A root blocked-run smoke check runs `bun run pilot -- run "inspect this project"` and expects the current intentional blocked JSON.

## Validation

Run validation from the repository root:

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run pilot -- --help
bun run pilot -- run "inspect this project"
git diff --check
openspec validate --all --strict
```

The blocked-run smoke should return exit code 1 with a redacted JSON payload whose `status` is `blocked`. That is the expected behavior until a real `PiAgentAdapter` is connected.

## Delivery

After implementation, Comet verification, and archive complete:

1. Merge the development branch into `main`.
2. Push `main` to `origin`.
3. Delete remote branches other than `main`.

The remote cleanup is intentionally destructive and is allowed here because the user explicitly requested it. Only delete remote refs after `main` has the verified and archived result.
