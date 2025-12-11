/**
 * Todo list visualization for TodoWrite tool results
 * Renders todo items with status indicators, tree connectors, and styling
 */

import {
  indent,
  fg,
  RESET,
  BOLD,
  RESET_BOLD,
  STRIKETHROUGH,
  RESET_STRIKETHROUGH,
  wordWrap,
} from "./ansi.js";
import type { RenderTheme } from "./theme.js";
import type { TodoItem } from "../types/messages.js";

// =============================================================================
// Types
// =============================================================================

/** TodoWrite tool result with old and new state */
export interface TodoWriteToolResult {
  oldTodos?: TodoItem[];
  newTodos: TodoItem[];
}

/** Configuration for todo list rendering */
export interface TodoRenderConfig {
  theme: RenderTheme;
  indentSize: number;
  width: number;
}

// =============================================================================
// Unicode Characters
// =============================================================================

const TODO_CHARS = {
  /** Unchecked ballot box (pending/in_progress) */
  unchecked: "\u2610", // ☐
  /** Checked ballot box with X (completed) */
  checked: "\u2612", // ☒
  /** Tree connector for first item */
  treeConnector: "\u23BF", // ⎿
} as const;

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Check if a tool result is a TodoWrite result with todo items
 */
export function isTodoWriteToolResult(result: unknown): result is TodoWriteToolResult {
  if (typeof result !== "object" || result === null) return false;
  const r = result as Record<string, unknown>;
  return Array.isArray(r.newTodos) && r.newTodos.length > 0;
}

// =============================================================================
// Main Renderer
// =============================================================================

/**
 * Render a TodoWrite tool result as a styled todo list
 */
export function renderTodoList(result: TodoWriteToolResult, cfg: TodoRenderConfig): string {
  return renderTodos(result.newTodos, cfg);
}

/**
 * Render todos from tool call input (input.todos array)
 */
export function renderTodosFromInput(
  input: Record<string, unknown>,
  cfg: TodoRenderConfig
): string | null {
  if (!Array.isArray(input.todos) || input.todos.length === 0) {
    return null;
  }
  return renderTodos(input.todos as TodoItem[], cfg);
}

/**
 * Core renderer for a list of todo items
 */
function renderTodos(todos: TodoItem[], cfg: TodoRenderConfig): string {
  const { theme, indentSize, width } = cfg;
  const output: string[] = [];

  // Prefix chars: "⎿  " or "   " = 3 chars, plus checkbox "☐ " = 2 chars = 5 total
  // Available width for content = width - indentSize - 5
  const prefixLen = 3; // tree connector/spaces
  const checkboxLen = 2; // "☐ " or "☒ "
  const contentWidth = width - indentSize - prefixLen - checkboxLen;

  for (let i = 0; i < todos.length; i++) {
    const todo = todos[i];
    const isFirst = i === 0;

    // Build the prefix: tree connector for first, spaces for rest
    // Format: "⎿  " for first, "   " for rest (indentSize handles base indent)
    const prefix = isFirst
      ? `${TODO_CHARS.treeConnector}  `
      : "   ";

    // Render the todo item based on status, with word wrapping
    const itemLines = renderTodoItem(todo, theme, contentWidth);

    // First line gets the prefix, continuation lines get spaces
    for (let j = 0; j < itemLines.length; j++) {
      const linePrefix = j === 0 ? prefix : "   ";
      output.push(indent(linePrefix + itemLines[j], indentSize));
    }
  }

  return output.join("\n");
}

// =============================================================================
// Item Rendering
// =============================================================================

/**
 * Render a single todo item with appropriate styling, returning wrapped lines
 */
function renderTodoItem(todo: TodoItem, theme: RenderTheme, contentWidth: number): string[] {
  switch (todo.status) {
    case "completed":
      return renderCompletedTodo(todo, theme, contentWidth);
    case "in_progress":
      return renderInProgressTodo(todo, theme, contentWidth);
    case "pending":
    default:
      return renderPendingTodo(todo, theme, contentWidth);
  }
}

/**
 * Render a pending todo: ☐ content (no special styling)
 */
function renderPendingTodo(todo: TodoItem, _theme: RenderTheme, contentWidth: number): string[] {
  const lines = wordWrap(todo.content, contentWidth);
  return lines.map((line, i) =>
    i === 0 ? `${TODO_CHARS.unchecked} ${line}` : `  ${line}`
  );
}

/**
 * Render an in-progress todo: ☐ **content** (bold text)
 */
function renderInProgressTodo(todo: TodoItem, _theme: RenderTheme, contentWidth: number): string[] {
  const lines = wordWrap(todo.content, contentWidth);
  return lines.map((line, i) =>
    i === 0
      ? `${TODO_CHARS.unchecked} ${BOLD}${line}${RESET_BOLD}`
      : `  ${BOLD}${line}${RESET_BOLD}`
  );
}

/**
 * Render a completed todo: ☒ ~~content~~ (gray + strikethrough)
 */
function renderCompletedTodo(todo: TodoItem, theme: RenderTheme, contentWidth: number): string[] {
  const grayFg = fg(theme.muted);
  const lines = wordWrap(todo.content, contentWidth);
  return lines.map((line, i) =>
    i === 0
      ? `${grayFg}${TODO_CHARS.checked} ${STRIKETHROUGH}${line}${RESET_STRIKETHROUGH}${RESET}`
      : `${grayFg}  ${STRIKETHROUGH}${line}${RESET_STRIKETHROUGH}${RESET}`
  );
}
