import type { FinishPayload } from "../agent/finish-tool.js";
import type { TodoItem } from "../tools/todo-write.js";

export type TranscriptEventBase = {
  timestamp: string;
};

export type UserTranscriptEvent = TranscriptEventBase & {
  type: "user";
  prompt: string;
};

export type AssistantTranscriptEvent = TranscriptEventBase & {
  type: "assistant";
  message: string;
};

export type ToolTranscriptEvent = TranscriptEventBase & {
  type: "tool";
  toolName: string;
  callId: string;
  input: unknown;
  output: unknown;
};

export type FinishTranscriptEvent = TranscriptEventBase & {
  type: "finish";
  payload: FinishPayload;
};

export type TranscriptEvent =
  | UserTranscriptEvent
  | AssistantTranscriptEvent
  | ToolTranscriptEvent
  | FinishTranscriptEvent;

export type Transcript = {
  sessionId: string;
  workspace: string;
  todos: TodoItem[];
  events: TranscriptEvent[];
};

export function createTranscript(sessionId: string, workspace: string): Transcript {
  return {
    sessionId,
    workspace,
    todos: [],
    events: [],
  };
}

export function appendTranscriptEvent(transcript: Transcript, event: TranscriptEvent): Transcript {
  transcript.events.push(event);
  return transcript;
}
