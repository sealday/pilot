#!/usr/bin/env bun

import { authCommand } from "./commands/auth.js";
import { memoryCommand } from "./commands/memory.js";
import { runCommand } from "./commands/run.js";
import { redactSecrets } from "../auth/token-redaction.js";

export type CliResult = {
  exitCode: number;
  output: string;
};

export function formatHelp(): string {
  return [
    "Usage:",
    "  pi-code auth login",
    "  pi-code auth status",
    "  pi-code auth logout",
    "  pi-code run [prompt]",
    "  pi-code resume [session-id]",
    "  pi-code memory list",
    "  pi-code memory forget <id>",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)): Promise<CliResult> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
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
  stream.write(`${result.output}\n`);
  process.exit(result.exitCode);
}
