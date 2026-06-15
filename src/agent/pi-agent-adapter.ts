import type { Transcript } from "../context/transcript.js";
import type { TodoItem } from "../tools/todo-write.js";

export type PiToolCall = {
  id: string;
  name: "todo_write" | "finish";
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
      assistantMessage: `Stub Pi agent handled: ${promptSummary}`,
      toolCalls: [
        {
          id: "todo-1",
          name: "todo_write",
          input: {
            todos: [{ text: "Return a structured finish payload", status: "completed" }],
          },
        },
        {
          id: "finish-1",
          name: "finish",
          input: {
            status: "complete",
            summary: `Stub session completed for prompt: ${promptSummary}`,
            changedFiles: [],
            verification: ["Stub adapter returned deterministic finish payload."],
            risks: ["Real Pi adapter is not connected yet."],
          },
        },
      ],
    };
  }
}
