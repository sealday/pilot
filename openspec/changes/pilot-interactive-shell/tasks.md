## 1. Spec And Dispatch Contract

- [ ] 1.1 Add delta specs for `repository-workspace`, `coding-harness-loop`, and `openai-auth`.
- [ ] 1.2 Update CLI help/run expectations so no-argument `pilot` is interactive and explicit `--help` remains help.

## 2. Pi Interactive Delegation

- [ ] 2.1 Add a thin Pi interactive runner around `@earendil-works/pi-coding-agent`'s exported `main(args)`.
- [ ] 2.2 Configure a default Pi session directory under `.pilot/pi-sessions` without overriding Pi's auth/config directory.
- [ ] 2.3 Split CLI dispatch from process-owned execution so tests can inject a fake interactive runner.
- [ ] 2.4 Route no-argument `pilot` / `bun run pilot` to the Pi interactive runner.

## 3. Compatibility

- [ ] 3.1 Preserve `pilot --help`, `pilot auth ...`, `pilot run ...`, and `pilot memory ...` behavior.
- [ ] 3.2 Keep redaction on pilot-owned command output and error paths.
- [ ] 3.3 Keep existing `pilot run` behavior unless the Pi runtime bridge can be safely shared in this change.

## 4. Tests And Documentation

- [ ] 4.1 Add unit tests for no-argument interactive dispatch and fake-runner injection.
- [ ] 4.2 Add tests for explicit help and explicit subcommand routing.
- [ ] 4.3 Update README with `bun run pilot` interactive usage and explicit command examples.
- [ ] 4.4 Run `bun run test`, `bun run typecheck`, `bun run build`, `openspec validate`, and a help-command smoke test.
