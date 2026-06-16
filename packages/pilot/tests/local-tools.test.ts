import { describe, expect, test } from "bun:test";
import { access, chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileRead, gitRead, globSearch, grepSearch, patchEdit, shellExecute, webFetch } from "../src/tools/local-execution.js";

async function tempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pi-code-tools-"));
}

async function pathExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

describe("local tool execution", () => {
  test("enforces workspace paths for file reads", async () => {
    const workspace = await tempWorkspace();

    await expect(fileRead({ path: "../outside.txt" }, { workspace })).rejects.toThrow("path escapes workspace");
  });

  test("rejects file reads through workspace symlinks", async () => {
    const workspace = await tempWorkspace();
    const outside = await mkdtemp(join(tmpdir(), "pi-code-outside-"));
    await writeFile(join(outside, "secret.txt"), "secret\n", "utf8");
    await symlink(join(outside, "secret.txt"), join(workspace, "link.txt"));

    await expect(fileRead({ path: "link.txt" }, { workspace })).rejects.toThrow("path cannot be a symlink");
  });

  test("rejects patch edits through workspace symlinks", async () => {
    const workspace = await tempWorkspace();
    const outside = await mkdtemp(join(tmpdir(), "pi-code-outside-"));
    const outsideFile = join(outside, "secret.txt");
    await writeFile(outsideFile, "alpha\n", "utf8");
    await symlink(outsideFile, join(workspace, "link.txt"));

    await expect(
      patchEdit({ path: "link.txt", search: "alpha", replace: "owned" }, { workspace }),
    ).rejects.toThrow("path cannot be a symlink");
    await expect(readFile(outsideFile, "utf8")).resolves.toBe("alpha\n");
  });

  test("rejects grep roots that are symlinked directories", async () => {
    const workspace = await tempWorkspace();
    const outside = await mkdtemp(join(tmpdir(), "pi-code-outside-"));
    await writeFile(join(outside, "secret.txt"), "needle outside\n", "utf8");
    await symlink(outside, join(workspace, "linked"));

    await expect(grepSearch({ pattern: "needle", path: "linked" }, { workspace })).rejects.toThrow(
      "path cannot be a symlink",
    );
    await expect(grepSearch({ pattern: "needle", path: "." }, { workspace })).resolves.toEqual({ matches: [] });
  });

  test("rejects mutating shell commands in unattended mode", async () => {
    const workspace = await tempWorkspace();

    await expect(shellExecute({ command: "touch created.txt" }, { workspace })).rejects.toThrow(
      "shell command rejected by policy: mutating",
    );
  });

  test("rejects shell redirection and write-oriented safe-classified commands", async () => {
    const workspace = await tempWorkspace();
    await writeFile(join(workspace, "sample.txt"), "alpha\n", "utf8");

    await expect(shellExecute({ command: "printf owned > created.txt" }, { workspace })).rejects.toThrow(
      "shell command rejected by policy: safe",
    );
    await expect(shellExecute({ command: "sed -i s/alpha/beta/ sample.txt" }, { workspace })).rejects.toThrow(
      "shell command rejected by policy: safe",
    );
    await expect(shellExecute({ command: "rm sample.txt" }, { workspace })).rejects.toThrow(
      "shell command rejected by policy: safe",
    );
    await expect(pathExists(join(workspace, "created.txt"))).resolves.toBe(false);
    await expect(readFile(join(workspace, "sample.txt"), "utf8")).resolves.toBe("alpha\n");
  });

  test("allows narrow read-only shell checks", async () => {
    const workspace = await tempWorkspace();
    await writeFile(join(workspace, "sample.txt"), "alpha\nneedle\n", "utf8");

    const result = await shellExecute({ command: "grep -q needle sample.txt" }, { workspace });

    expect(result.exitCode).toBe(0);
    expect(result.risk).toBe("safe");
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

  test("git rejects mutating commands and write-capable diff options", async () => {
    const workspace = await tempWorkspace();
    const outside = join(await mkdtemp(join(tmpdir(), "pi-code-git-outside-")), "diff.txt");

    await expect(gitRead({ args: ["branch", "new-branch"] }, { workspace })).rejects.toThrow(
      "git tool only supports safe read-only status/diff style operations",
    );
    await expect(gitRead({ args: ["diff", "--no-index", "a.txt", "b.txt"] }, { workspace })).rejects.toThrow(
      "unsupported git diff option: --no-index",
    );
    await expect(gitRead({ args: ["diff", `--output=${outside}`] }, { workspace })).rejects.toThrow(
      `unsupported git diff option: --output=${outside}`,
    );
    await expect(pathExists(outside)).resolves.toBe(false);
  });

  test("git diff ignores configured external diff helpers", async () => {
    const workspace = await tempWorkspace();
    await Bun.spawn(["git", "init"], { cwd: workspace }).exited;
    await writeFile(join(workspace, "sample.txt"), "alpha\n", "utf8");
    await Bun.spawn(["git", "add", "sample.txt"], { cwd: workspace }).exited;
    await Bun.spawn(
      ["git", "-c", "user.email=test@example.test", "-c", "user.name=Test", "commit", "-m", "init"],
      { cwd: workspace },
    ).exited;
    await writeFile(join(workspace, "sample.txt"), "beta\n", "utf8");

    const marker = join(workspace, "external-diff-ran");
    const helper = join(workspace, "external-diff.sh");
    await writeFile(helper, `#!/bin/sh\nprintf ran > ${JSON.stringify(marker)}\nexit 0\n`, "utf8");
    await chmod(helper, 0o755);
    await Bun.spawn(["git", "config", "diff.external", helper], { cwd: workspace }).exited;

    const result = await gitRead({ args: ["diff"] }, { workspace });

    expect(result.stdout).toContain("sample.txt");
    await expect(pathExists(marker)).resolves.toBe(false);
  });

  test("git status ignores configured fsmonitor helpers", async () => {
    const workspace = await tempWorkspace();
    await Bun.spawn(["git", "init"], { cwd: workspace }).exited;
    await writeFile(join(workspace, "sample.txt"), "alpha\n", "utf8");

    const marker = join(workspace, "fsmonitor-ran");
    const helper = join(workspace, "fsmonitor.sh");
    await writeFile(helper, `#!/bin/sh\nprintf ran > ${JSON.stringify(marker)}\nexit 0\n`, "utf8");
    await chmod(helper, 0o755);
    await Bun.spawn(["git", "config", "core.fsmonitor", helper], { cwd: workspace }).exited;

    const result = await gitRead({ args: ["status", "--short"] }, { workspace });

    expect(result.stdout).toContain("?? sample.txt");
    await expect(pathExists(marker)).resolves.toBe(false);
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
