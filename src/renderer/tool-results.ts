/**
 * Tool result extraction and rendering
 * Handles all Claude Code tool output formats (Read, Bash, Glob, TodoWrite, WebFetch, WebSearch, Task/Agent)
 */

import type { RenderConfig } from "./messages.js";
import { BOX, colorize, indent, wordWrap } from "./ansi.js";
import { isEditToolResult, renderEditDiff } from "./diff.js";
import { isTodoWriteToolResult } from "./todos.js";

// =============================================================================
// Types
// =============================================================================

/** Tool result object - flexible to accommodate all tool formats */
export interface ToolResultContent {
  content?: string | Array<{ type?: string; text?: string }>;
  stdout?: string;
  stderr?: string;
  is_error?: boolean;
  type?: string;
  file?: { content?: string; filePath?: string };
  filenames?: string[];
  oldTodos?: unknown[];
  newTodos?: unknown[];
  // WebFetch result fields
  result?: string;
  url?: string;
  // WebSearch result fields
  query?: string;
  results?: Array<{ title?: string; url?: string; snippet?: string } | string>;
}

// =============================================================================
// Main Renderer
// =============================================================================

/**
 * Renders tool execution result with proper formatting.
 *
 * Supports multiple Claude Code tool result formats:
 * - Standard: `{ content: string }`
 * - Read tool: `{ type: "text", file: { content: string, filePath: string } }`
 * - Bash tool: `{ stdout: string, stderr: string }`
 * - Glob tool: `{ filenames: string[] }`
 * - TodoWrite: `{ oldTodos: [], newTodos: [] }`
 * - Empty results: `{}` (renders as bullet only)
 *
 * Priority: content > file.content > stdout/stderr > filenames > TodoWrite
 */
export function renderToolResult(
  result: ToolResultContent,
  cfg: RenderConfig
): string {
  const { theme, maxToolOutputLines } = cfg;

  // Special handling for Edit tool results with diff visualization
  if (isEditToolResult(result)) {
    return renderEditDiff(result, {
      theme,
      indentSize: cfg.indentSize,
      width: cfg.width,
    });
  }

  // TodoWrite: suppress result rendering (todos shown with tool call)
  if (isTodoWriteToolResult(result)) {
    return "";
  }

  // Extract content from various formats
  let contentText = "";
  if (Array.isArray(result.content)) {
    // Task/Agent/MCP result with content array: [{type: "text", text: "..."}, {type: "image", ...}]
    const parts: string[] = [];
    let hasImage = false;
    for (const item of result.content) {
      if (item && typeof item.text === "string") {
        parts.push(item.text);
      } else if (item && item.type === "image") {
        hasImage = true;
      }
    }
    if (hasImage) {
      parts.push("[Screenshot captured]");
    }
    contentText = parts.join("\n");
  } else if (typeof result.content === "string") {
    // Standard content field
    contentText = result.content;
  } else if (typeof result.result === "string") {
    // WebFetch result with fetched content
    contentText = result.result;
  } else if (Array.isArray(result.results)) {
    // WebSearch result with results array
    const parts: string[] = [];
    if (result.query) {
      parts.push(`Query: ${result.query}`);
    }
    for (const item of result.results) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (item && typeof item.title === "string") {
        // Format: title + url + snippet
        parts.push(`• ${item.title}`);
        if (item.url) parts.push(`  ${item.url}`);
        if (item.snippet) parts.push(`  ${item.snippet}`);
      }
    }
    contentText = parts.join("\n");
  } else if (result.file && typeof result.file.content === "string") {
    // Read tool result with nested file.content
    contentText = result.file.content;
  } else if (result.stdout || result.stderr) {
    // Bash-style result with stdout/stderr
    const parts: string[] = [];
    if (typeof result.stdout === "string") parts.push(result.stdout);
    if (typeof result.stderr === "string") parts.push(result.stderr);
    contentText = parts.join("\n");
  } else if (Array.isArray(result.filenames)) {
    // Glob result with filenames array
    if (result.filenames.length === 0) {
      contentText = "(no matches)";
    } else {
      contentText = result.filenames.join("\n");
    }
  } else if (result.oldTodos || result.newTodos) {
    // TodoWrite result - minimal display
    const count = Array.isArray(result.newTodos) ? result.newTodos.length : 0;
    contentText = `Updated ${count} todos`;
  }

  // Handle empty content - return early with muted connector + bullet
  if (!contentText) {
    const bullet = result.is_error ? BOX.crossMark : BOX.check;
    const bulletColor = result.is_error ? theme.toolBulletError : theme.toolBulletSuccess;
    return colorize(`  ${BOX.indent} `, theme.muted) + colorize(bullet, bulletColor);
  }

  // Alignment constants: "  ⎿  " prefix = 5 chars
  const treePrefix = "  "; // Align under tool bullet
  const contentIndent = 5; // "  ⎿  " = 5 chars to align continuation lines

  // Wrap each line to terminal width (accounting for content indent)
  const wrapWidth = cfg.width - contentIndent;
  const rawLines = contentText.split("\n");
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const wrapped = wordWrap(rawLine, wrapWidth);
    lines.push(...wrapped);
  }

  const truncated = lines.length > maxToolOutputLines;
  const displayLines = truncated ? lines.slice(0, maxToolOutputLines) : lines;

  const bulletColor = result.is_error ? theme.toolBulletError : theme.toolBulletSuccess;
  const bullet = result.is_error ? BOX.crossMark : BOX.check;
  const treeConnector = "\u23BF"; // ⎿

  const output: string[] = [];

  for (let i = 0; i < displayLines.length; i++) {
    const line = displayLines[i] ?? "";
    if (i === 0) {
      // First line: indented tree connector with bullet color
      output.push(treePrefix + colorize(treeConnector, theme.muted) + "  " + line);
    } else {
      // Continuation lines: aligned with first line content
      output.push(indent(line, contentIndent));
    }
  }

  if (truncated) {
    output.push(
      indent(
        colorize(`… +${lines.length - maxToolOutputLines} lines (ctrl+o to expand)`, theme.muted),
        contentIndent
      )
    );
  }

  if (output.length === 0) {
    return treePrefix + colorize(bullet, bulletColor);
  }

  return output.join("\n");
}
