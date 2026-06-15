import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileRead, gitRead, globSearch, grepSearch, shellExecute, webFetch } from "../src/tools/local-execution.js";

async function tempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pi-code-tools-"));
}

describe("local tool execution", () => {
  test("enforces workspace paths for file reads", async () => {
    const workspace = await tempWorkspace();

    await expect(fileRead({ path: "../outside.txt" }, { workspace })).rejects.toThrow("path escapes workspace");
  });

  test("rejects mutating shell commands in unattended mode", async () => {
    const workspace = await tempWorkspace();

    await expect(shellExecute({ command: "touch created.txt" }, { workspace })).rejects.toThrow(
      "shell command rejected by policy: mutating",
    );
  });

  test("grep and glob return workspace-relative text matches", async () => {
    const workspace = await tempWorkspace();
    await mkdir(join(workspace, "src"));
    await writeFile(join(workspace, "src", "sample.txt"), "alpha\nneedle\n", "utf8");

    await expect(grepSearch({ pattern: "needle", path: "src" }, { workspace })).resolves.toEqual({
      matches: [{ path: "src/sample.txt", line: 2, text: "needle" }],
    });
    await expect(globSearch({ pattern: "src/*.txt" }, { workspace })).resolves.toEqual({
      paths: ["src/sample.txt"],
    });
  });

  test("git supports read-only status operations", async () => {
    const workspace = await tempWorkspace();
    await Bun.spawn(["git", "init"], { cwd: workspace }).exited;
    await writeFile(join(workspace, "sample.txt"), "alpha\n", "utf8");

    const result = await gitRead({ args: ["status", "--short"] }, { workspace });

    expect(result.args).toEqual(["status", "--short"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("?? sample.txt");
  });

  test("web_fetch uses injected fetch and returns a text snippet", async () => {
    const workspace = await tempWorkspace();
    const fetchImpl = (async () => new Response("hello from fixture", { status: 202 })) as unknown as typeof fetch;

    const result = await webFetch({ url: "https://example.test/data" }, { workspace, deps: { fetch: fetchImpl } });

    expect(result).toEqual({
      url: "https://example.test/data",
      status: 202,
      text: "hello from fixture",
    });
  });
});
