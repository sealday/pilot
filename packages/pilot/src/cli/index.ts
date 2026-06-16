#!/usr/bin/env bun

import { authCommand } from "./commands/auth.js";
import { memoryCommand } from "./commands/memory.js";
import { runCommand } from "./commands/run.js";
import { runPiInteractive, type PiInteractiveRunner } from "./pi-interactive.js";
import { redactSecrets } from "../auth/token-redaction.js";

export type CliResult = {
  exitCode: number;
  output: string;
};

export type CliDeps = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  piInteractive?: PiInteractiveRunner;
};

export function formatHelp(): string {
  return [
    "Usage:",
    "  pilot auth login",
    "  pilot auth status",
    "  pilot auth logout",
    "  pilot run [prompt]",
    "  pilot resume [session-id]",
    "  pilot memory list",
    "  pilot memory forget <id>",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2), deps: CliDeps = {}): Promise<CliResult> {
  if (argv.length === 0) {
    const piDeps = {
      cwd: deps.cwd ?? process.cwd(),
      ...(deps.env ? { env: deps.env } : {}),
      ...(deps.piInteractive ? { runner: deps.piInteractive } : {}),
    };
    await runPiInteractive([], piDeps);
    return { exitCode: 0, output: "" };
  }

  if (argv[0] === "--help" || argv[0] === "-h") {
    return { exitCode: 0, output: formatHelp() };
  }

  const [command, ...rest] = argv;

  if (command === "auth") {
    return authCommand(rest);
  }

  if (command === "run") {
    return runCommand(rest);
  }

  if (command === "memory") {
    return memoryCommand(rest);
  }

  return { exitCode: 1, output: `${redactSecrets(`Unknown command: ${argv.join(" ")}`)}\n\n${formatHelp()}` };
}

if (import.meta.main) {
  const result = await main();
  const stream = result.exitCode === 0 ? process.stdout : process.stderr;
  if (result.output.length > 0) {
    stream.write(`${result.output}\n`);
  }
  process.exit(result.exitCode);
}
