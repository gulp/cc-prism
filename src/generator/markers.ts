/**
 * Marker generation for asciicast navigation
 */

import type { TranscriptEntry, UserMessage, AssistantMessage } from "../types/messages.js";
import type { MarkerMode } from "../types/asciicast.js";
import { extractText, extractToolUse } from "../renderer/content.js";
import { isCommandMessage, parseCommandTags, parseLocalCommandStdout } from "../renderer/commands.js";

// =============================================================================
// Marker Configuration
// =============================================================================

export interface MarkerOptions {
  /** Which messages to create markers for */
  mode: MarkerMode;
  /** Maximum length for marker labels */
  labelLength: number;
}

export const DEFAULT_MARKER_OPTIONS: MarkerOptions = {
  mode: "all",
  labelLength: 30,
};

// =============================================================================
// Marker Generation
// =============================================================================

/** Check if a message should have a marker based on mode */
export function shouldHaveMarker(
  entry: TranscriptEntry,
  mode: MarkerMode
): boolean {
  if (mode === "none") return false;

  switch (entry.type) {
    case "user":
      // User prompts (not tool results)
      if (entry.toolUseResult) {
        return mode === "all" || mode === "tools";
      }
      return mode === "all" || mode === "user";

    case "assistant":
      // Assistant messages with tool calls
      if (hasToolCalls(entry)) {
        return mode === "all" || mode === "tools";
      }
      // Regular assistant messages
      return mode === "all";

    default:
      return false;
  }
}

/** Generate marker label for an entry */
export function generateMarkerLabel(
  entry: TranscriptEntry,
  maxLength: number = 30
): string | null {
  switch (entry.type) {
    case "user":
      return generateUserMarkerLabel(entry, maxLength);

    case "assistant":
      return generateAssistantMarkerLabel(entry, maxLength);

    default:
      return null;
  }
}

// =============================================================================
// User Message Markers
// =============================================================================

function generateUserMarkerLabel(msg: UserMessage, maxLength: number): string {
  // Tool result
  if (msg.toolUseResult) {
    // String results are errors, object results check is_error flag
    const isError = typeof msg.toolUseResult === "string" || msg.toolUseResult.is_error;
    if (isError) {
      return "✗ Tool error";
    }
    return "✓ Tool result";
  }

  // Regular user prompt
  const text = extractText(msg.message.content).trim();
  if (!text) return "> (empty prompt)";

  // Check for slash command tags (e.g., <command-name>/clear</command-name>)
  if (isCommandMessage(text)) {
    const command = parseCommandTags(text);
    if (command) {
      // Preserve original Claude Code aesthetic: "> /command (args)"
      // Note: command.name already includes the slash (e.g., "/status")
      let marker = `> ${command.name}`;
      if (command.args.trim()) {
        marker += ` (${command.args})`;
      }
      return marker;
    }
    // Standalone local-command-stdout (empty output)
    const stdout = parseLocalCommandStdout(text);
    if (stdout !== null) {
      return stdout ? "> (command output)" : "> (command)";
    }
  }

  const firstLine = text.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength - 2) {
    return `> ${cleaned}`;
  }

  return `> ${cleaned.substring(0, maxLength - 3)}…`;
}

// =============================================================================
// Assistant Message Markers
// =============================================================================

function generateAssistantMarkerLabel(
  msg: AssistantMessage,
  maxLength: number
): string {
  const tools = extractToolUse(msg.message.content);

  // If has tool calls, show tool info
  if (tools.length > 0) {
    const firstTool = tools[0]!;
    const toolInfo = formatToolForMarker(firstTool.name, firstTool.input);

    if (tools.length === 1) {
      return truncateMarker(`● ${toolInfo}`, maxLength);
    }
    return truncateMarker(`● ${toolInfo} (+${tools.length - 1})`, maxLength);
  }

  // Regular text response
  const text = extractText(msg.message.content).trim();
  if (!text) return "Claude: (empty)";

  const firstLine = text.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength - 8) {
    return `Claude: ${cleaned}`;
  }

  return `Claude: ${cleaned.substring(0, maxLength - 9)}…`;
}

// =============================================================================
// Tool Formatting for Markers
// =============================================================================

function formatToolForMarker(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      if (typeof input["file_path"] === "string") {
        const path = input["file_path"];
        const filename = path.split("/").pop() ?? path;
        return `${name}(${filename})`;
      }
      return name;

    case "Bash":
      if (typeof input["command"] === "string") {
        const cmd = input["command"];
        const short = cmd.length > 20 ? cmd.substring(0, 19) + "…" : cmd;
        return `Bash(${short})`;
      }
      return "Bash";

    case "Glob":
      if (typeof input["pattern"] === "string") {
        return `Glob(${input["pattern"]})`;
      }
      return "Glob";

    case "Grep":
      if (typeof input["pattern"] === "string") {
        const pattern = input["pattern"];
        const short = pattern.length > 15 ? pattern.substring(0, 14) + "…" : pattern;
        return `Grep(${short})`;
      }
      return "Grep";

    case "Task":
      if (typeof input["description"] === "string") {
        return `⤵ Task(${input["description"]})`;
      }
      return "⤵ Task";

    case "TodoWrite":
      return "TodoWrite";

    case "WebFetch":
    case "WebSearch":
      return name;

    default:
      return name;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function hasToolCalls(msg: AssistantMessage): boolean {
  return msg.message.content.some((item) => item.type === "tool_use");
}

function truncateMarker(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 1) + "…";
}
