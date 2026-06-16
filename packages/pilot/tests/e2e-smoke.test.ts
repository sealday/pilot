import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli/index.js";
import { SessionRunner } from "../src/agent/session-runner.js";
import type { PiAgentAdapter } from "../src/agent/pi-agent-adapter.js";

async function tempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pi-code-e2e-"));
}

describe("e2e smoke", () => {
  test("help returns first-release command usage", async () => {
    const result = await main(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("pi-code run [prompt]");
    expect(result.output).toContain("pi-code auth login");
  });

  test("default run blocks instead of faking completion", async () => {
    const result = await main(["run", "inspect"]);

    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(result.output);
    expect(payload.status).toBe("blocked");
    expect(payload.summary).toContain("Real Pi adapter is not connected");
    expect(payload).not.toHaveProperty("transcript");
  });

  test("fixture workspace executes first-release local tool calls", async () => {
    const cwd = await tempWorkspace();
    await writeFile(join(cwd, "sample.txt"), "alpha\nbeta\n", "utf8");
    const runner = new SessionRunner({
      cwd,
      now: () => new Date("2026-06-15T00:00:00.000Z"),
      sessionId: () => "e2e-session",
      adapter: firstReleaseAdapter(),
    });

    const result = await runner.run("update sample");

    expect(await readFile(join(cwd, "sample.txt"), "utf8")).toBe("alpha\ngamma\n");
    expect(result.status).toBe("complete");
    expect(result.todos).toEqual([{ text: "Patch and verify sample", status: "completed" }]);

    const toolEvents = result.transcript.events.filter((event) => event.type === "tool");
    expect(toolEvents.map((event) => event.toolName)).toEqual([
      "file_read",
      "patch_edit",
      "shell",
      "todo_write",
    ]);
    expect(toolEvents.at(0)?.input).toEqual({ path: "sample.txt" });
    expect(toolEvents.at(1)?.output).toEqual({ changedPath: "sample.txt", replacements: 1 });
  });

  test("persisted transcripts redact secret-like tool inputs and outputs", async () => {
    const cwd = await tempWorkspace();
    const secret = "sk-test123456789";
    const runner = new SessionRunner({
      cwd,
      now: () => new Date("2026-06-15T00:00:00.000Z"),
      sessionId: () => "redacted-session",
      tools: {
        fetch: (async () => new Response(`body ${secret}`, { status: 200 })) as unknown as typeof fetch,
      },
      adapter: secretAdapter(secret),
    });

    await runner.run(`fetch ${secret}`);

    const persisted = await readFile(join(cwd, ".pi-code", "sessions", "redacted-session", "transcript.json"), "utf8");
    expect(persisted).not.toContain(secret);
    expect(persisted).toContain("[REDACTED]");
  });
});

function firstReleaseAdapter(): PiAgentAdapter {
  return {
    async runTurn() {
      return {
        assistantMessage: "Applying local tool smoke",
        toolCalls: [
          {
            id: "read-1",
            name: "file_read",
            input: { path: "sample.txt" },
          },
          {
            id: "patch-1",
            name: "patch_edit",
            input: { path: "sample.txt", search: "beta", replace: "gamma" },
          },
          {
            id: "shell-1",
            name: "shell",
            input: { command: "grep -q gamma sample.txt" },
          },
          {
            id: "todo-1",
            name: "todo_write",
            input: { todos: [{ text: "Patch and verify sample", status: "completed" }] },
          },
          {
            id: "finish-1",
            name: "finish",
            input: {
              status: "complete",
              summary: "Fixture workspace smoke completed.",
              changedFiles: ["sample.txt"],
              verification: ["shell test command exited 0"],
              risks: [],
            },
          },
        ],
      };
    },
  };
}

function secretAdapter(secret: string): PiAgentAdapter {
  return {
    async runTurn() {
      return {
        assistantMessage: `Fetching ${secret}`,
        toolCalls: [
          {
            id: "web-1",
            name: "web_fetch",
            input: { url: `https://example.test/data?key=${secret}`, nested: { [secret]: "secret key name" } },
          },
          {
            id: "finish-1",
            name: "finish",
            input: {
              status: "complete",
              summary: `Fetched ${secret}`,
              changedFiles: [],
              verification: [`saw ${secret}`],
              risks: [],
            },
          },
        ],
      };
    },
  };
}
