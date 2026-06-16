import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { main } from "../src/cli/index.js";
import { runCommand } from "../src/cli/commands/run.js";
import { SessionRunner } from "../src/agent/session-runner.js";
import type { PiAgentAdapter } from "../src/agent/pi-agent-adapter.js";

async function tempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pilot-runner-"));
}

describe("SessionRunner", () => {
  test("runs an injected adapter through todo_write and finish", async () => {
    const cwd = await tempWorkspace();
    const now = new Date("2026-06-15T00:00:00.000Z");
    const runner = new SessionRunner({
      cwd,
      now: () => now,
      sessionId: () => "session-test",
      adapter: completeAdapter(),
    });

    const result = await runner.run("inspect this project");

    expect(result.status).toBe("complete");
    expect(result.summary).toContain("Injected adapter completed");
    expect(result.risks).toContain("Real Pi adapter is not connected in this test.");
    expect(result.todos).toEqual([{ text: "Return a structured finish payload", status: "completed" }]);

    const eventTypes = result.transcript.events.map((event) => event.type);
    expect(eventTypes).toEqual(["user", "assistant", "tool", "finish"]);
    expect(result.transcript.events.every((event) => event.timestamp === "2026-06-15T00:00:00.000Z")).toBe(true);

    const persisted = JSON.parse(await readFile(join(cwd, ".pilot", "sessions", "session-test", "transcript.json"), "utf8"));
    expect(persisted.events.map((event: { type: string }) => event.type)).toEqual(eventTypes);
  });

  test("default stub blocks rather than masking missing real Pi integration", async () => {
    const cwd = await tempWorkspace();
    const runner = new SessionRunner({ cwd, sessionId: () => "stub-blocked" });

    const result = await runner.run("inspect this project");

    expect(result.status).toBe("blocked");
    expect(result.summary).toBe("Real Pi adapter is not connected.");
    expect(result.risks).toContain("Real Pi adapter is not connected yet.");
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

  test("rejects unsafe session ids before writing transcripts", async () => {
    for (const unsafeSessionId of ["", "../escape", "nested/session", "nested\\session", ".", "..", "/absolute"]) {
      const runner = new SessionRunner({
        cwd: await tempWorkspace(),
        sessionId: () => unsafeSessionId,
        adapter: completeAdapter(),
      });

      await expect(runner.run("inspect")).rejects.toThrow("invalid session id");
    }
  });
});

describe("runCommand", () => {
  test("returns JSON from the session runner", async () => {
    const cwd = await tempWorkspace();
    const result = await runCommand(["inspect", "this"], {
      cwd,
      now: () => new Date("2026-06-15T00:00:00.000Z"),
      sessionId: () => "cli-session",
      adapter: completeAdapter(),
    });

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.output);
    expect(payload.status).toBe("complete");
    expect(payload.sessionId).toBe("cli-session");
    expect(payload.risks).toContain("Real Pi adapter is not connected in this test.");
    expect(payload).not.toHaveProperty("transcript");
  });

  test("pilot run defaults to blocked when no real adapter is connected", async () => {
    const result = await main(["run", "inspect"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output).status).toBe("blocked");
  });

  test("redacts secret-like prompt text from default JSON output", async () => {
    const cwd = await tempWorkspace();
    const result = await runCommand(["inspect", "sk-test123456789"], {
      cwd,
      sessionId: () => "redacted-session",
      adapter: completeAdapter("sk-test123456789"),
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("[REDACTED]");
    expect(result.output).not.toContain("sk-test123456789");
    expect(JSON.parse(result.output)).not.toHaveProperty("transcript");
  });

  test("requires a prompt", async () => {
    const result = await runCommand([]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Usage: pilot run [prompt]");
  });
});

function completeAdapter(secretLikeSummary = "safe prompt"): PiAgentAdapter {
  return {
    async runTurn() {
      return {
        assistantMessage: "complete",
        toolCalls: [
          {
            id: "todo-1",
            name: "todo_write",
            input: {
              todos: [{ text: "Return a structured finish payload", status: "completed" }],
            },
          },
          {
            id: "finish-1",
            name: "finish",
            input: {
              status: "complete",
              summary: `Injected adapter completed for ${secretLikeSummary}`,
              changedFiles: [],
              verification: ["Injected adapter returned deterministic finish payload."],
              risks: ["Real Pi adapter is not connected in this test."],
            },
          },
        ],
      };
    },
  };
}
