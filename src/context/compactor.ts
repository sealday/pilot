export type CompactInput = {
  currentTask: string;
  todos: string[];
  changedFiles: string[];
  recentObservations: string[];
};

export function compactContext(input: CompactInput): string {
  return [
    `Current task: ${input.currentTask}`,
    section("Todos", input.todos),
    section("Changed files", input.changedFiles),
    section("Recent observations", input.recentObservations),
  ].join("\n");
}

function section(title: string, items: string[]): string {
  if (items.length === 0) {
    return `${title}:`;
  }

  return [`${title}:`, ...items.map((item) => `- ${item}`)].join("\n");
}
