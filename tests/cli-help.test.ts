import { describe, expect, test } from "bun:test";
import { formatHelp, main } from "../src/cli/index.js";

describe("CLI help", () => {
  test("lists first-release commands", () => {
    const help = formatHelp();
    expect(help).toContain("pi-code auth login");
    expect(help).toContain("pi-code run [prompt]");
    expect(help).toContain("pi-code memory list");
  });

  test("returns help for empty and flag invocations", async () => {
    for (const argv of [[], ["--help"], ["-h"]]) {
      const result = await main(argv);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("pi-code auth status");
    }
  });

  test("reports unknown commands as failures", async () => {
    const result = await main(["bad"]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Unknown command: bad");
    expect(result.output).toContain("pi-code run [prompt]");
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
