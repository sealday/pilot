export const TODO_STATUSES = ["pending", "in_progress", "completed"] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];

export type TodoItem = {
  text: string;
  status: TodoStatus;
};

export type TodoWriteInput = {
  todos: TodoItem[];
};

export type TodoWriteResult = {
  todos: TodoItem[];
};

export function todoWrite(input: unknown): TodoWriteResult {
  if (!isRecord(input) || !Array.isArray(input.todos)) {
    throw new Error("todos must be an array");
  }

  const todos = input.todos.map((todo) => parseTodoItem(todo));
  const activeCount = todos.filter((todo) => todo.status === "in_progress").length;

  if (activeCount > 1) {
    throw new Error("at most one in_progress todo is allowed");
  }

  return { todos };
}

function parseTodoItem(value: unknown): TodoItem {
  if (!isRecord(value)) {
    throw new Error("todo must be an object");
  }

  if (typeof value.text !== "string") {
    throw new Error("todo text is required");
  }

  const text = value.text.trim();
  if (text.length === 0) {
    throw new Error("todo text is required");
  }

  if (!isTodoStatus(value.status)) {
    throw new Error("invalid todo status");
  }

  return {
    text,
    status: value.status,
  };
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === "string" && TODO_STATUSES.includes(value as TodoStatus);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
