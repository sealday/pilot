import type { CliResult } from "../index.js";

const MEMORY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export async function memoryCommand(args: string[]): Promise<CliResult> {
  const subcommand = args[0] ?? "list";

  if (subcommand === "list") {
    return { exitCode: 0, output: "[]" };
  }

  if (subcommand === "forget") {
    const id = args[1];

    if (id === undefined) {
      return { exitCode: 1, output: "Usage: pi-code memory forget <id>" };
    }

    if (!MEMORY_ID_PATTERN.test(id)) {
      return { exitCode: 1, output: "Invalid memory id" };
    }

    return { exitCode: 0, output: `Forgot memory ${id}` };
  }

  return { exitCode: 1, output: `Unknown memory command: ${subcommand}` };
}
