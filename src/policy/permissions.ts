import type { ShellRisk } from "../tools/shell.js";

export type ToolDecision = "allow" | "ask" | "deny";

export function decisionForShellRisk(risk: ShellRisk, unattended = false): ToolDecision {
  if (risk === "safe") {
    return "allow";
  }

  return unattended ? "deny" : "ask";
}
