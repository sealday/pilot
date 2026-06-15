#!/usr/bin/env bun

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

  return { exitCode: 1, output: `Unknown command: ${argv.join(" ")}\n\n${formatHelp()}` };
}

if (import.meta.main) {
  const result = await main();
  console.log(result.output);
  process.exit(result.exitCode);
}
