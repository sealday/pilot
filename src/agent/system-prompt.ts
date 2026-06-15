export function buildStablePrefix(): string {
  return [
    "You are pi-code, a narrow coding agent harness.",
    "Use the smallest sufficient tool set.",
    "Preserve user work and stay inside the assigned workspace.",
    "Finish only by calling the structured finish tool.",
    "Do not expose credential material.",
  ].join("\n");
}

export function buildRuntimeContext(input: { workspace: string; authProvider: string }): string {
  return [
    "Runtime Context:",
    `workspace=${input.workspace}`,
    `authProvider=${input.authProvider}`,
    `date=${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");
}
