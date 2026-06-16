import { describe, expect, test } from "bun:test";
import { formatHelp, main } from "../src/cli/index.js";

describe("CLI help", () => {
  test("lists first-release commands", () => {
    const help = formatHelp();
    expect(help).toContain("pilot auth login");
    expect(help).toContain("pilot run [prompt]");
    expect(help).toContain("pilot memory list");
  });

  test("delegates empty invocations to the Pi interactive runner", async () => {
    const calls: string[][] = [];
    const env: NodeJS.ProcessEnv = {};

    const result = await main([], {
      cwd: "/tmp/pilot-workspace",
      env,
      piInteractive: async (args) => {
        calls.push(args);
      },
    });

    expect(result).toEqual({ exitCode: 0, output: "" });
    expect(calls).toEqual([[]]);
    expect(env.PI_CODING_AGENT_SESSION_DIR).toBe("/tmp/pilot-workspace/.pilot/pi-sessions");
    expect(env.PI_CODING_AGENT_DIR).toBeUndefined();
  });

  test("returns help for explicit help flags", async () => {
    for (const argv of [["--help"], ["-h"]]) {
      const result = await main(argv);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("pilot auth status");
    }
  });

  test("does not delegate explicit pilot commands to the Pi interactive runner", async () => {
    const calls: string[][] = [];

    const help = await main(["--help"], {
      piInteractive: async (args) => {
        calls.push(args);
      },
    });
    const runUsage = await main(["run"], {
      piInteractive: async (args) => {
        calls.push(args);
      },
    });
    const memoryUsage = await main(["memory", "forget"], {
      piInteractive: async (args) => {
        calls.push(args);
      },
    });

    expect(help.exitCode).toBe(0);
    expect(runUsage.output).toContain("Usage: pilot run [prompt]");
    expect(memoryUsage.output).toContain("Usage: pilot memory forget <id>");
    expect(calls).toEqual([]);
  });

  test("reports unknown commands as failures", async () => {
    const result = await main(["bad"]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Unknown command: bad");
    expect(result.output).toContain("pilot run [prompt]");
  });

  test("redacts secret-like unknown command arguments", async () => {
    const result = await main(["bad", "sk-test123456789"]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("[REDACTED]");
    expect(result.output).not.toContain("sk-test123456789");
  });

  test("entrypoint writes failures to stderr", async () => {
    const proc = Bun.spawn([process.execPath, "src/cli/index.ts", "bad"], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("Unknown command: bad");
  });
});
