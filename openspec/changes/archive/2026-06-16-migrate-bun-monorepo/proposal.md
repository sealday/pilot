## Why

The current coding harness is a single root package named `pi-code`. That works for the first CLI slice, but it makes future packages hard to add without mixing product code, repository tooling, and OpenSpec artifacts at the root. The product name should also become `pilot`, not `pi-code`.

This change migrates the repository to a Bun-managed monorepo so the `pilot` CLI can live in a dedicated workspace package while the root remains the orchestration surface for install, test, build, and run commands.

The user also requested that the result can be run directly with Bun commands, then merged into `main`, pushed to the remote, and cleaned up so remote branches other than `main` are removed.

## What Changes

- Convert the root `package.json` into a private Bun workspace root.
- Rename the product-facing CLI/package from `pi-code` to `pilot`.
- Move the current CLI package source, tests, package metadata, and TypeScript config into a workspace package under `packages/pilot`.
- Keep root-level scripts for common workflows:
  - install dependencies,
  - run tests,
  - typecheck,
  - build,
  - run the CLI directly with Bun.
- Update README instructions so a fresh checkout can run the CLI from the root with Bun.
- Preserve the current conservative default runtime behavior: `pilot run` blocks until a real `PiAgentAdapter` is connected.
- Preserve all existing tests and security hardening.
- Complete repository delivery after verification by merging the development branch into `main`, pushing `main`, and deleting remote branches other than `main`.

## Scope

In scope:

- Bun workspace configuration.
- Product-facing rename from `pi-code` to `pilot`.
- Package relocation to `packages/pilot`.
- Script and path updates required by the new package layout.
- README run instructions.
- Validation that root-level Bun commands work from a clean monorepo checkout.
- Git delivery actions requested by the user.

Out of scope:

- Adding a real Pi streaming adapter.
- Adding new model-provider behavior.
- Publishing the package to npm.
- Adding additional workspace packages beyond the CLI workspace unless needed for the migration.
- Changing the OpenAI auth or local tool semantics except where naming/path updates require it.

## Impact

- Repository layout changes from single-package to monorepo.
- `bun.lock` may change due workspace metadata.
- CLI package paths and test imports may move under `packages/pilot`.
- User-facing command examples and local product state paths change from `pi-code` / `.pi-code` to `pilot` / `.pilot`.
- Root commands become the documented public development surface.
- Remote branch cleanup is destructive for non-main branches but explicitly requested as part of delivery.
