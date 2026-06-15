import { join } from "node:path";
import { parseFinishPayload, type FinishPayload } from "./finish-tool.js";
import { StubPiAgentAdapter, type PiAgentAdapter, type PiToolCall } from "./pi-agent-adapter.js";
import { appendTranscriptEvent, createTranscript, type Transcript } from "../context/transcript.js";
import { writeJson } from "../storage/json-db.js";
import { todoWrite, type TodoItem } from "../tools/todo-write.js";

export type SessionRunnerDeps = {
  adapter?: PiAgentAdapter;
  cwd?: string;
  now?: () => Date;
  sessionId?: () => string;
};

export type SessionResult = FinishPayload & {
  sessionId: string;
  todos: TodoItem[];
  transcript: Transcript;
};

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class SessionRunner {
  private readonly adapter: PiAgentAdapter;
  private readonly cwd: string;
  private readonly now: () => Date;
  private readonly sessionIdFactory: () => string;

  constructor(deps: SessionRunnerDeps = {}) {
    this.adapter = deps.adapter ?? new StubPiAgentAdapter();
    this.cwd = deps.cwd ?? process.cwd();
    this.now = deps.now ?? (() => new Date());
    this.sessionIdFactory = deps.sessionId ?? (() => `session-${Date.now().toString(36)}`);
  }

  async run(prompt: string): Promise<SessionResult> {
    const sessionId = this.sessionIdFactory();
    validateSessionId(sessionId);
    const transcript = createTranscript(sessionId, this.cwd);
    const timestamp = () => this.now().toISOString();
    let todos: TodoItem[] = [];

    appendTranscriptEvent(transcript, {
      type: "user",
      timestamp: timestamp(),
      prompt,
    });

    const turn = await this.adapter.runTurn({
      prompt,
      transcript,
      todos,
      workspace: this.cwd,
    });

    appendTranscriptEvent(transcript, {
      type: "assistant",
      timestamp: timestamp(),
      message: turn.assistantMessage,
    });

    let finishPayload: FinishPayload | null = null;

    for (const toolCall of turn.toolCalls) {
      const output = this.executeToolCall(toolCall);

      if (toolCall.name === "todo_write") {
        todos = output as TodoItem[];
        transcript.todos = todos;
      }

      if (toolCall.name === "finish") {
        finishPayload = output as FinishPayload;
        appendTranscriptEvent(transcript, {
          type: "finish",
          timestamp: timestamp(),
          payload: finishPayload,
        });
      } else {
        appendTranscriptEvent(transcript, {
          type: "tool",
          timestamp: timestamp(),
          toolName: toolCall.name,
          callId: toolCall.id,
          input: toolCall.input,
          output,
        });
      }
    }

    if (finishPayload === null) {
      throw new Error("session ended without a finish tool call");
    }

    await this.persistTranscript(transcript);

    return {
      ...finishPayload,
      sessionId,
      todos,
      transcript,
    };
  }

  private executeToolCall(toolCall: PiToolCall): unknown {
    if (toolCall.name === "todo_write") {
      return todoWrite(toolCall.input).todos;
    }

    if (toolCall.name === "finish") {
      return parseFinishPayload(toolCall.input);
    }

    throw new Error(`unsupported tool call: ${toolCall.name satisfies never}`);
  }

  private async persistTranscript(transcript: Transcript): Promise<void> {
    await writeJson(join(this.cwd, ".pi-code", "sessions", transcript.sessionId, "transcript.json"), transcript);
  }
}

export function validateSessionId(sessionId: string): void {
  if (sessionId.length === 0 || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("invalid session id");
  }
}
