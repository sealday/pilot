import { describe, expect, test } from "bun:test";
import { todoWrite } from "../src/tools/todo-write.js";

describe("todoWrite", () => {
  test("trims todo text and replaces the session list", () => {
    const result = todoWrite({
      todos: [
        { text: " inspect files ", status: "completed" },
        { text: " run tests", status: "in_progress" },
        { text: "report", status: "pending" },
      ],
    });

    expect(result.todos).toEqual([
      { text: "inspect files", status: "completed" },
      { text: "run tests", status: "in_progress" },
      { text: "report", status: "pending" },
    ]);
  });

  test("rejects more than one in-progress todo", () => {
    expect(() =>
      todoWrite({
        todos: [
          { text: "first", status: "in_progress" },
          { text: "second", status: "in_progress" },
        ],
      }),
    ).toThrow("at most one in_progress todo is allowed");
  });

  test("rejects arbitrary input shapes", () => {
    expect(() => todoWrite({ task: "anything" })).toThrow("todos must be an array");
    expect(() => todoWrite({ todos: [{ text: "ok", status: "active" }] })).toThrow("invalid todo status");
    expect(() => todoWrite({ todos: [{ text: "   ", status: "pending" }] })).toThrow("todo text is required");
  });
});
