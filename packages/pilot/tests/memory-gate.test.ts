import { describe, expect, test } from "bun:test";
import { main } from "../src/cli/index.js";
import { hasConflict } from "../src/memory/conflict.js";
import { isDuplicate, similarity } from "../src/memory/dedupe.js";
import { shouldAcceptMemory } from "../src/memory/gate.js";

describe("shouldAcceptMemory", () => {
  test("rejects low confidence auto memory", () => {
    expect(shouldAcceptMemory({ confidence: "low", explicit: false }, "medium")).toBe(false);
  });

  test("accepts explicit memory despite low confidence", () => {
    expect(shouldAcceptMemory({ confidence: "low", explicit: true }, "high")).toBe(true);
  });

  test("uses ranked confidence floors for automatic memory", () => {
    expect(shouldAcceptMemory({ confidence: "medium", explicit: false }, "medium")).toBe(true);
    expect(shouldAcceptMemory({ confidence: "medium", explicit: false }, "high")).toBe(false);
    expect(shouldAcceptMemory({ confidence: "high", explicit: false }, "high")).toBe(true);
  });
});

describe("memory dedupe and conflict checks", () => {
  test("computes deterministic word-set similarity", () => {
    expect(similarity("Use Bun tests", "use bun tests")).toBe(1);
    expect(similarity("Use Bun tests", "ship docs")).toBe(0);
    expect(similarity("", "")).toBe(0);
  });

  test("detects duplicate text above the threshold", () => {
    expect(isDuplicate("Use Bun tests", ["use bun tests"], 0.8)).toBe(true);
    expect(isDuplicate("Use Bun tests", ["ship docs"], 0.8)).toBe(false);
  });

  test("catches simple not contradictions conservatively", () => {
    expect(hasConflict("The project does not persist memory", ["The project does persist memory"])).toBe(true);
    expect(hasConflict("The project does persist memory", ["The project does not persist memory"])).toBe(true);
    expect(hasConflict("The project avoids memory persistence", ["The project persists memory"])).toBe(false);
  });
});

describe("memoryCommand", () => {
  test("lists an empty non-persistent memory set", async () => {
    expect(await main(["memory", "list"])).toEqual({ exitCode: 0, output: "[]" });
  });

  test("validates forget ids", async () => {
    expect(await main(["memory", "forget"])).toEqual({
      exitCode: 1,
      output: "Usage: pilot memory forget <id>",
    });
    expect(await main(["memory", "forget", "../secret"])).toEqual({
      exitCode: 1,
      output: "Invalid memory id",
    });
    expect(await main(["memory", "forget", "mem_123"])).toEqual({
      exitCode: 0,
      output: "Forgot memory",
    });
  });

  test("fails unknown memory subcommands", async () => {
    expect(await main(["memory", "export"])).toEqual({
      exitCode: 1,
      output: "Unknown memory command: export",
    });
  });

  test("does not echo secret-like memory arguments", async () => {
    expect(await main(["memory", "forget", "sk-test123456789"])).toEqual({
      exitCode: 1,
      output: "Invalid memory id",
    });
    const result = await main(["memory", "sk-test123456789"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[REDACTED]");
    expect(result.output).not.toContain("sk-test123456789");
  });
});
