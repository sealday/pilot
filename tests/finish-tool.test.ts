import { describe, expect, test } from "bun:test";
import { parseFinishPayload } from "../src/agent/finish-tool.js";

describe("parseFinishPayload", () => {
  test("accepts and trims a complete finish payload", () => {
    const payload = parseFinishPayload({
      status: "complete",
      summary: " done ",
      changedFiles: [" src/a.ts ", "src/b.ts"],
      verification: [" bun test "],
      risks: [" real Pi adapter not connected yet "],
    });

    expect(payload).toEqual({
      status: "complete",
      summary: "done",
      changedFiles: ["src/a.ts", "src/b.ts"],
      verification: ["bun test"],
      risks: ["real Pi adapter not connected yet"],
    });
  });

  test("accepts blocked status", () => {
    const payload = parseFinishPayload({
      status: "blocked",
      summary: "needs credentials",
      changedFiles: [],
      verification: [],
      risks: ["cannot validate provider"],
    });

    expect(payload.status).toBe("blocked");
  });

  test("requires the structured finish fields", () => {
    expect(() => parseFinishPayload({ status: "done" })).toThrow("invalid finish status");
    expect(() =>
      parseFinishPayload({
        status: "complete",
        summary: "",
        changedFiles: [],
        verification: [],
        risks: [],
      }),
    ).toThrow("finish summary is required");
    expect(() =>
      parseFinishPayload({
        status: "complete",
        summary: "done",
        changedFiles: ["src/a.ts"],
        verification: "bun test",
        risks: [],
      }),
    ).toThrow("finish verification must be an array");
  });
});
