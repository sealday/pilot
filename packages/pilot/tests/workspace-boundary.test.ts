import { describe, expect, test } from "bun:test";
import { isInsideWorkspace } from "../src/policy/workspace-boundary.js";

describe("isInsideWorkspace", () => {
  test("accepts the workspace root", () => {
    expect(isInsideWorkspace("/repo", "/repo")).toBe(true);
  });

  test("accepts child paths", () => {
    expect(isInsideWorkspace("/repo", "/repo/src/file.ts")).toBe(true);
    expect(isInsideWorkspace("/repo", "/repo/src/../package.json")).toBe(true);
  });

  test("rejects sibling prefixes", () => {
    expect(isInsideWorkspace("/repo", "/repo-other/file.ts")).toBe(false);
  });

  test("rejects parent traversal", () => {
    expect(isInsideWorkspace("/repo", "/repo/../outside/file.ts")).toBe(false);
  });

  test("rejects mixed POSIX workspace and backslash target paths", () => {
    expect(isInsideWorkspace("/repo", "/repo-other\\..\\repo\\file")).toBe(false);
  });

  test("handles Windows-style paths in Node tests", () => {
    expect(isInsideWorkspace("C:\\repo", "C:\\repo\\src\\file.ts")).toBe(true);
    expect(isInsideWorkspace("C:\\repo", "C:\\repo-other\\file.ts")).toBe(false);
    expect(isInsideWorkspace("C:\\repo", "C:\\repo\\..\\outside\\file.ts")).toBe(false);
  });
});
