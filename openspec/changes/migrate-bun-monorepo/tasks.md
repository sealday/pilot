## 1. Workspace Layout

- [x] 1.1 Convert root `package.json` into a private Bun workspace root with `workspaces` configured.
- [x] 1.2 Move the existing CLI package files into `packages/pilot`.
- [x] 1.3 Update package-local `tsconfig`, scripts, bin metadata, and build output paths for the new package location.
- [x] 1.4 Rename the user-facing package, binary, help text, README examples, and local state path from `pi-code` / `.pi-code` to `pilot` / `.pilot`.

## 2. Root Run Surface

- [x] 2.1 Add root scripts for test, typecheck, build, lint, and direct CLI execution.
- [x] 2.2 Update README with root-level Bun install, validation, and run commands.
- [x] 2.3 Ensure generated build artifacts and package-local runtime state remain ignored.

## 3. Validation

- [x] 3.1 Run and fix root-level `bun run test`.
- [x] 3.2 Run and fix root-level `bun run typecheck`.
- [x] 3.3 Run and fix root-level `bun run build`.
- [x] 3.4 Smoke-test direct CLI execution from the repository root with Bun.
