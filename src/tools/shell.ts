export type ShellRisk = "safe" | "mutating" | "dangerous";

const DANGEROUS_PATTERNS = [
  /\brm\s+-\S*r\S*f\b/,
  /\brm\s+-\S*f\S*r\b/,
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

  if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "dangerous";
  }

  if (MUTATING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "mutating";
  }

  return "safe";
}
