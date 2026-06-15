import { describe, expect, test } from "bun:test";
import { buildRuntimeContext, buildStablePrefix } from "../src/agent/system-prompt.js";
import { compactContext } from "../src/context/compactor.js";
import { normalizeUsage } from "../src/context/cost-meter.js";

describe("context and cost", () => {
  test("keeps dynamic values out of stable prefix", () => {
    const stablePrefix = buildStablePrefix();

    expect(stablePrefix).not.toContain("/tmp/repo");
    expect(stablePrefix).not.toContain("openai-codex");
    expect(stablePrefix).not.toContain("2026-06-15");

    const runtimeContext = buildRuntimeContext({ workspace: "/tmp/repo", authProvider: "openai-codex" });
    expect(runtimeContext).toContain("/tmp/repo");
    expect(runtimeContext).toContain("openai-codex");
  });

  test("normalizes cached token usage when present", () => {
    expect(normalizeUsage({ input: 10, output: 2, cacheRead: 5 })).toEqual({
      input: 10,
      output: 2,
      cacheRead: 5,
      total: 12,
    });
  });

  test("defaults missing usage values to zero", () => {
    expect(normalizeUsage({})).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      total: 0,
    });
  });

  test("compacts task state deterministically", () => {
    expect(
      compactContext({
        currentTask: "Implement memory governance",
        todos: ["write tests", "run verification"],
        changedFiles: ["src/memory/gate.ts", "tests/memory-gate.test.ts"],
        recentObservations: ["No persistence in this slice", "Use NodeNext imports"],
      }),
    ).toBe(
      [
        "Current task: Implement memory governance",
        "Todos:",
        "- write tests",
        "- run verification",
        "Changed files:",
        "- src/memory/gate.ts",
        "- tests/memory-gate.test.ts",
        "Recent observations:",
        "- No persistence in this slice",
        "- Use NodeNext imports",
      ].join("\n"),
    );
  });
});
