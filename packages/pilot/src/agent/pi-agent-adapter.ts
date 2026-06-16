import type { Transcript } from "../context/transcript.js";
import type { TodoItem } from "../tools/todo-write.js";

export type PiToolCall = {
  id: string;
  name:
    | "file_read"
    | "patch_edit"
    | "shell"
    | "grep"
    | "glob"
    | "git"
    | "web_fetch"
    | "todo_write"
    | "finish";
  input: unknown;
};

export type PiAgentTurnInput = {
  prompt: string;
  transcript: Transcript;
  todos: TodoItem[];
  workspace: string;
};

export type PiAgentTurn = {
  assistantMessage: string;
  toolCalls: PiToolCall[];
};

export interface PiAgentAdapter {
  runTurn(input: PiAgentTurnInput): Promise<PiAgentTurn>;
}

export class StubPiAgentAdapter implements PiAgentAdapter {
  async runTurn(input: PiAgentTurnInput): Promise<PiAgentTurn> {
    const promptSummary = input.prompt.length > 0 ? input.prompt : "empty prompt";

    return {
      assistantMessage: `Stub Pi agent cannot run real work for: ${promptSummary}`,
      toolCalls: [
        {
          id: "todo-1",
          name: "todo_write",
          input: {
            todos: [{ text: "Connect a real Pi adapter", status: "pending" }],
          },
        },
        {
          id: "finish-1",
          name: "finish",
          input: {
            status: "blocked",
            summary: "Real Pi adapter is not connected.",
            changedFiles: [],
            verification: [],
            risks: ["Real Pi adapter is not connected yet."],
          },
        },
      ],
    };
  }
}
