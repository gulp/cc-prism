/**
 * Content normalization utilities for rendering
 * Handles extraction and formatting of message content
 */

import type {
  ContentItem,
  TextContent,
  ThinkingContent,
  ToolUseContent,
  AssistantMessage,
  UserMessage,
} from "../types/messages.js";

// =============================================================================
// Content Extraction
// =============================================================================

/** Extract all text content from a ContentItem array */
export function extractText(content: string | ContentItem[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((item): item is TextContent => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

/** Extract thinking content from a ContentItem array */
export function extractThinking(content: ContentItem[]): string[] {
  return content
    .filter((item): item is ThinkingContent => item.type === "thinking")
    .map((item) => item.thinking);
}

/** Extract tool use items from a ContentItem array */
export function extractToolUse(content: ContentItem[]): ToolUseContent[] {
  return content.filter(
    (item): item is ToolUseContent => item.type === "tool_use"
  );
}

/** Check if content contains any tool use */
export function hasToolUse(content: ContentItem[]): boolean {
  return content.some((item) => item.type === "tool_use");
}

/** Check if content contains thinking */
export function hasThinking(content: ContentItem[]): boolean {
  return content.some((item) => item.type === "thinking");
}

// =============================================================================
// Content Classification
// =============================================================================

export type ContentCategory = "text" | "tool-call" | "tool-result" | "thinking" | "mixed";

/** Classify what type of content a message contains */
export function classifyContent(content: ContentItem[]): ContentCategory {
  const types = new Set(content.map((item) => item.type));

  if (types.size === 0) return "text";
  if (types.size === 1) {
    if (types.has("text")) return "text";
    if (types.has("thinking")) return "thinking";
    if (types.has("tool_use")) return "tool-call";
  }

  return "mixed";
}

// =============================================================================
// Message Analysis
// =============================================================================

/** Get a summary label for a user message */
export function getUserMessageLabel(msg: UserMessage, maxLength = 30): string {
  if (msg.toolUseResult) {
    // String results are errors, object results check is_error flag
    if (typeof msg.toolUseResult === "string") {
      return "Tool error";
    }
    return msg.toolUseResult.is_error ? "Tool error" : "Tool result";
  }

  const text = extractText(msg.message.content);
  if (text.length <= maxLength) {
    return text.replace(/\n/g, " ");
  }

  return text.substring(0, maxLength - 1).replace(/\n/g, " ") + "…";
}

/** Get a summary label for an assistant message */
export function getAssistantMessageLabel(
  msg: AssistantMessage,
  maxLength = 30
): string {
  const content = msg.message.content;

  // If it's primarily a tool call, describe the tool
  const tools = extractToolUse(content);
  if (tools.length > 0) {
    const firstTool = tools[0]!;
    if (tools.length === 1) {
      return `${firstTool.name}`;
    }
    return `${firstTool.name} (+${tools.length - 1} more)`;
  }

  // Otherwise, use the text content
  const text = extractText(content);
  if (text.length <= maxLength) {
    return text.replace(/\n/g, " ");
  }

  return text.substring(0, maxLength - 1).replace(/\n/g, " ") + "…";
}

// =============================================================================
// Tool Input Formatting
// =============================================================================

/** Get a short description of tool input for display */
export function formatToolInputSummary(tool: ToolUseContent): string {
  const { name, input } = tool;

  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      if (typeof input["file_path"] === "string") {
        return input["file_path"];
      }
      break;

    case "Bash":
      if (typeof input["command"] === "string") {
        const cmd = input["command"];
        return cmd.length > 50 ? cmd.substring(0, 49) + "…" : cmd;
      }
      break;

    case "Glob":
      if (typeof input["pattern"] === "string") {
        return input["pattern"];
      }
      break;

    case "Grep":
      if (typeof input["pattern"] === "string") {
        return `/${input["pattern"]}/`;
      }
      break;

    case "Task":
      if (typeof input["description"] === "string") {
        return input["description"];
      }
      if (typeof input["prompt"] === "string") {
        const prompt = input["prompt"];
        return prompt.length > 50 ? prompt.substring(0, 49) + "…" : prompt;
      }
      break;

    case "WebFetch":
      if (typeof input["url"] === "string") {
        return input["url"];
      }
      break;

    case "WebSearch":
      if (typeof input["query"] === "string") {
        return input["query"];
      }
      break;

    case "TodoWrite":
      if (Array.isArray(input["todos"])) {
        return `${input["todos"].length} items`;
      }
      break;
  }

  return "";
}

// =============================================================================
// Output Truncation
// =============================================================================

/** Truncate multi-line output with line count indicator */
export function truncateOutput(
  text: string,
  maxLines: number,
  maxLineLength = 200
): { text: string; truncated: boolean; hiddenLines: number } {
  const lines = text.split("\n");

  // Truncate individual lines that are too long
  const truncatedLines = lines.map((line) =>
    line.length > maxLineLength
      ? line.substring(0, maxLineLength - 1) + "…"
      : line
  );

  if (truncatedLines.length <= maxLines) {
    return {
      text: truncatedLines.join("\n"),
      truncated: false,
      hiddenLines: 0,
    };
  }

  return {
    text: truncatedLines.slice(0, maxLines).join("\n"),
    truncated: true,
    hiddenLines: truncatedLines.length - maxLines,
  };
}
