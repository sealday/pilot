export type ShellRisk = "safe" | "mutating" | "dangerous";

const DANGEROUS_PATTERNS = [
  /\bchmod\s+-R\b/i,
  /\bchown\s+-R\b/i,
  /\bdd\s+[^;&|]*\bif=/,
  /\bmkfs(?:\.\w+)?\b/,
  /\bshutdown\b/,
  /\breboot\b/,
] as const;

const MUTATING_PATTERNS = [
  /\bbun\s+install\b/,
  /\bnpm\s+install\b/,
  /\bpnpm\s+install\b/,
  /\byarn\s+add\b/,
  /\bgit\s+commit\b/,
  /\bgit\s+checkout\b/,
  /\bgit\s+reset\b/,
  /\bmv\b/,
  /\bcp\b/,
  /\btouch\b/,
  /\bmkdir\b/,
] as const;

export function classifyShellCommand(command: string): ShellRisk {
  const normalized = command.trim().toLowerCase();

  if (isDangerousRmCommand(normalized)) {
    return "dangerous";
  }

  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "dangerous";
  }

  if (MUTATING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "mutating";
  }

  return "safe";
}

function isDangerousRmCommand(command: string): boolean {
  const segments = command.split(/[;&|]+/);

  for (const segment of segments) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    const rmIndex = findRmTokenIndex(tokens);

    if (rmIndex === -1) {
      continue;
    }

    const flags = tokens.slice(rmIndex + 1).filter((arg) => arg.startsWith("-"));
    const hasRecursive = flags.some((flag) => flag === "--recursive" || flag.includes("r"));
    const hasForce = flags.some((flag) => flag === "--force" || flag.includes("f"));

    if (hasRecursive && hasForce) {
      return true;
    }
  }

  return false;
}

function findRmTokenIndex(tokens: string[]): number {
  for (const [index, token] of tokens.entries()) {
    if (isCommandWrapper(token) || isEnvironmentAssignment(token)) {
      continue;
    }

    return commandBasename(token) === "rm" ? index : -1;
  }

  return -1;
}

function isCommandWrapper(token: string): boolean {
  return token === "sudo" || token === "command" || token === "env";
}

function isEnvironmentAssignment(token: string): boolean {
  return /^[A-Z_][A-Z0-9_]*=.*/i.test(token);
}

function commandBasename(token: string): string {
  return token.split("/").at(-1) ?? token;
}
