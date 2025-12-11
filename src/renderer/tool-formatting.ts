/**
 * Tool name and argument formatting utilities
 * Converts tool metadata into display-friendly strings for terminal rendering
 */

import type { ToolUseContent } from "../types/messages.js";
import { colorize, truncate } from "./ansi.js";
import type { RenderTheme } from "./theme.js";

// =============================================================================
// Types
// =============================================================================

/** Result of parsing and formatting a tool name */
export interface FormattedToolName {
  displayName: string;
  isMcp: boolean;
}

// =============================================================================
// Tool Name Formatting
// =============================================================================

/**
 * Parse MCP tool name into display format.
 * "mcp__chrome-devtools__click" -> { displayName: "chrome-devtools - click", isMcp: true }
 */
export function formatToolName(name: string): FormattedToolName {
  if (name.startsWith("mcp__")) {
    const parts = name.slice(5).split("__"); // Remove "mcp__" prefix, split on "__"
    if (parts.length >= 2) {
      const server = parts[0];
      const tool = parts.slice(1).join("__"); // Handle tools with __ in name
      return { displayName: `${server} - ${tool}`, isMcp: true };
    }
  }
  return { displayName: name, isMcp: false };
}

// =============================================================================
// Tool Arguments Formatting
// =============================================================================

/**
 * Format tool arguments for display in tool call headers
 * Handles tool-specific argument extraction and truncation
 */
export function formatToolArgs(
  tool: ToolUseContent,
  theme: RenderTheme,
  isMcp = false
): string {
  const input = tool.input;

  // MCP tools: show first param as (key: "value")
  if (isMcp && input && typeof input === "object") {
    const keys = Object.keys(input);
    if (keys.length > 0) {
      const key = keys[0]!;
      const value = input[key];
      if (typeof value === "string") {
        const truncated = truncate(value, 40);
        return `(${key}: "${colorize(truncated, theme.muted)}")`;
      }
    }
    return "";
  }

  // Format based on tool type
  switch (tool.name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      if (typeof input["file_path"] === "string") {
        return `(${colorize(input["file_path"], theme.filePath)})`;
      }
      break;

    case "Bash":
      if (typeof input["command"] === "string") {
        const cmd = truncate(input["command"], 60);
        return `(${colorize(cmd, theme.muted)})`;
      }
      break;

    case "Glob":
      if (typeof input["pattern"] === "string") {
        return `(${colorize(input["pattern"], theme.filePath)})`;
      }
      break;

    case "Grep":
      if (typeof input["pattern"] === "string") {
        const pattern = truncate(input["pattern"], 40);
        return `(${colorize(pattern, theme.muted)})`;
      }
      break;

    case "Task":
      if (typeof input["description"] === "string") {
        const desc = truncate(input["description"], 50);
        return `(${colorize(desc, theme.agent)})`;
      }
      if (typeof input["prompt"] === "string") {
        const prompt = truncate(input["prompt"], 50);
        return `(${colorize(prompt, theme.agent)})`;
      }
      break;

    case "TodoWrite":
      return colorize(" (updating todos)", theme.muted);

    case "WebFetch":
    case "WebSearch":
      if (typeof input["url"] === "string") {
        const url = truncate(input["url"], 50);
        return `(${colorize(url, theme.filePath)})`;
      }
      if (typeof input["query"] === "string") {
        const query = truncate(input["query"], 50);
        return `(${colorize(query, theme.muted)})`;
      }
      break;
  }

  // Fallback: show nothing or simple indicator
  return "";
}
