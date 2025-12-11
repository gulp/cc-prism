import { describe, it, expect } from "vitest";
import { isTodoWriteToolResult, renderTodoList } from "./todos.js";
import { stripAnsi } from "./ansi.js";
import { TOKYO_NIGHT } from "./theme.js";

describe("isTodoWriteToolResult", () => {
  it("returns true for valid TodoWrite result", () => {
    const result = {
      newTodos: [
        { content: "Test task", status: "pending" as const },
      ],
    };
    expect(isTodoWriteToolResult(result)).toBe(true);
  });

  it("returns true for result with oldTodos and newTodos", () => {
    const result = {
      oldTodos: [{ content: "Old task", status: "completed" as const }],
      newTodos: [{ content: "New task", status: "in_progress" as const }],
    };
    expect(isTodoWriteToolResult(result)).toBe(true);
  });

  it("returns false for empty newTodos array", () => {
    const result = { newTodos: [] };
    expect(isTodoWriteToolResult(result)).toBe(false);
  });

  it("returns false for missing newTodos", () => {
    const result = { oldTodos: [] };
    expect(isTodoWriteToolResult(result)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isTodoWriteToolResult(null)).toBe(false);
    expect(isTodoWriteToolResult(undefined)).toBe(false);
    expect(isTodoWriteToolResult("string")).toBe(false);
    expect(isTodoWriteToolResult(123)).toBe(false);
  });
});

describe("renderTodoList", () => {
  const config = {
    theme: TOKYO_NIGHT,
    indentSize: 2,
    width: 100,
  };

  it("renders pending todo with unchecked box", () => {
    const result = {
      newTodos: [{ content: "Pending task", status: "pending" as const }],
    };
    const output = renderTodoList(result, config);
    const stripped = stripAnsi(output);

    expect(stripped).toContain("☐");
    expect(stripped).toContain("Pending task");
  });

  it("renders in_progress todo with unchecked box and bold content", () => {
    const result = {
      newTodos: [{ content: "Active task", status: "in_progress" as const }],
    };
    const output = renderTodoList(result, config);
    const stripped = stripAnsi(output);

    expect(stripped).toContain("☐");
    expect(stripped).toContain("Active task");
    // Bold is applied via ANSI codes
    expect(output).toContain("\x1b[1m"); // BOLD
    expect(output).toContain("\x1b[22m"); // RESET_BOLD
  });

  it("renders completed todo with checked box and strikethrough", () => {
    const result = {
      newTodos: [{ content: "Done task", status: "completed" as const }],
    };
    const output = renderTodoList(result, config);
    const stripped = stripAnsi(output);

    expect(stripped).toContain("☒");
    expect(stripped).toContain("Done task");
    // Strikethrough is applied via ANSI codes
    expect(output).toContain("\x1b[9m"); // STRIKETHROUGH
    expect(output).toContain("\x1b[29m"); // RESET_STRIKETHROUGH
  });

  it("renders tree connector for first item only", () => {
    const result = {
      newTodos: [
        { content: "First task", status: "pending" as const },
        { content: "Second task", status: "pending" as const },
        { content: "Third task", status: "pending" as const },
      ],
    };
    const output = renderTodoList(result, config);
    const stripped = stripAnsi(output);

    // Tree connector (⎿) should appear exactly once for first item
    const treeConnectorCount = (stripped.match(/⎿/g) || []).length;
    expect(treeConnectorCount).toBe(1);

    // All three tasks should be present
    expect(stripped).toContain("First task");
    expect(stripped).toContain("Second task");
    expect(stripped).toContain("Third task");
  });

  it("renders mixed status todos correctly", () => {
    const result = {
      newTodos: [
        { content: "Completed task", status: "completed" as const },
        { content: "Active task", status: "in_progress" as const },
        { content: "Pending task", status: "pending" as const },
      ],
    };
    const output = renderTodoList(result, config);
    const stripped = stripAnsi(output);

    // Check for checkbox characters
    expect(stripped).toContain("☒"); // completed
    expect((stripped.match(/☐/g) || []).length).toBe(2); // pending + in_progress

    // All content should be present
    expect(stripped).toContain("Completed task");
    expect(stripped).toContain("Active task");
    expect(stripped).toContain("Pending task");
  });

  it("applies indentation correctly", () => {
    const result = {
      newTodos: [{ content: "Task", status: "pending" as const }],
    };
    const output = renderTodoList(result, { ...config, indentSize: 4 });

    // Output should start with indentation
    expect(output).toMatch(/^ {4}/);
  });

  it("handles single todo item", () => {
    const result = {
      newTodos: [{ content: "Only task", status: "in_progress" as const }],
    };
    const output = renderTodoList(result, config);
    const stripped = stripAnsi(output);

    expect(stripped).toContain("⎿");
    expect(stripped).toContain("☐");
    expect(stripped).toContain("Only task");
  });
});
