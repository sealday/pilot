import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { main } from "../src/cli/index.js";
import { runCommand } from "../src/cli/commands/run.js";
import { SessionRunner } from "../src/agent/session-runner.js";

async function tempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pi-code-runner-"));
}

describe("SessionRunner", () => {
  test("runs the stub adapter through todo_write and finish", async () => {
    const cwd = await tempWorkspace();
    const now = new Date("2026-06-15T00:00:00.000Z");
    const runner = new SessionRunner({ cwd, now: () => now, sessionId: () => "session-test" });

    const result = await runner.run("inspect this project");

    expect(result.status).toBe("complete");
    expect(result.summary).toContain("Stub session completed");
    expect(result.risks).toContain("Real Pi adapter is not connected yet.");
    expect(result.todos).toEqual([{ text: "Return a structured finish payload", status: "completed" }]);

    const eventTypes = result.transcript.events.map((event) => event.type);
    expect(eventTypes).toEqual(["user", "assistant", "tool", "finish"]);
    expect(result.transcript.events.every((event) => event.timestamp === "2026-06-15T00:00:00.000Z")).toBe(true);

    const persisted = JSON.parse(await readFile(join(cwd, ".pi-code", "sessions", "session-test", "transcript.json"), "utf8"));
    expect(persisted.events.map((event: { type: string }) => event.type)).toEqual(eventTypes);
  });

  test("returns blocked finish payloads without treating them as complete", async () => {
    const cwd = await tempWorkspace();
    const runner = new SessionRunner({
      cwd,
      sessionId: () => "blocked-session",
      adapter: {
        async runTurn() {
          return {
            assistantMessage: "blocked",
            toolCalls: [
              {
                id: "finish-1",
                name: "finish",
                input: {
                  status: "blocked",
                  summary: "Need a real Pi adapter.",
                  changedFiles: [],
                  verification: [],
                  risks: ["Real Pi integration is outside this task."],
                },
              },
            ],
          };
        },
      },
    });

    const result = await runner.run("do it");

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe("Need a real Pi adapter.");
  });
});

describe("runCommand", () => {
  test("returns JSON from the session runner", async () => {
    const cwd = await tempWorkspace();
    const result = await runCommand(["inspect", "this"], {
      cwd,
      now: () => new Date("2026-06-15T00:00:00.000Z"),
      sessionId: () => "cli-session",
    });

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.output);
    expect(payload.status).toBe("complete");
    expect(payload.sessionId).toBe("cli-session");
    expect(payload.risks).toContain("Real Pi adapter is not connected yet.");
  });

  test("dispatches pi-code run through the main CLI", async () => {
    const result = await main(["run", "inspect"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output).status).toBe("complete");
  });

  test("requires a prompt", async () => {
    const result = await runCommand([]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Usage: pi-code run [prompt]");
  });
});
