/**
 * Message renderers - convert transcript entries to ANSI output
 */

import type {
  TranscriptEntry,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ContentItem,
  ToolUseContent,
} from "../types/messages.js";
import { BOX, colorize, style, wordWrap } from "./ansi.js";
import { renderTodosFromInput } from "./todos.js";
import { renderMarkdown } from "./markdown.js";
import type { RenderTheme } from "./theme.js";
import { TOKYO_NIGHT } from "./theme.js";
import { renderToolResult } from "./tool-results.js";
import { formatToolName, formatToolArgs } from "./tool-formatting.js";
import {
  isCommandMessage,
  parseCommandTags,
  parseLocalCommandStdout,
  renderSlashCommand,
  renderLocalStdout,
  isBashMessage,
  parseBashInput,
  parseBashOutput,
  renderBashInput,
  renderBashOutput,
} from "./commands.js";

// =============================================================================
// Render Configuration
// =============================================================================

export interface RenderConfig {
  /** Theme to use for colors */
  theme: RenderTheme;
  /** Terminal width for word wrapping */
  width: number;
  /** Maximum lines for tool output */
  maxToolOutputLines: number;
  /** Show thinking blocks */
  showThinking: boolean;
  /** Indent for nested content */
  indentSize: number;
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  theme: TOKYO_NIGHT,
  width: 100,
  maxToolOutputLines: 5, // Matches Claude Code's compact display (wrapped lines counted)
  showThinking: true,
  indentSize: 2,
};

// =============================================================================
// Main Renderer
// =============================================================================

/** Render a transcript entry to ANSI string */
export function renderMessage(
  entry: TranscriptEntry,
  config: Partial<RenderConfig> = {}
): string {
  const cfg = { ...DEFAULT_RENDER_CONFIG, ...config };

  switch (entry.type) {
    case "user":
      // Skip meta messages (e.g., "Caveat:" system info)
      if (entry.isMeta) {
        return "";
      }
      return renderUserMessage(entry, cfg);
    case "assistant":
      return renderAssistantMessage(entry, cfg);
    case "system":
      return renderSystemMessage(entry, cfg);
    case "summary":
      return ""; // Skip rendering
    case "queue-operation":
      if (entry.operation === "remove") {
        return renderQueueRemove(entry.content, cfg);
      }
      return "";
    case "file-history-snapshot":
      return ""; // Skip rendering
    default:
      return "";
  }
}

// =============================================================================
// User Message Renderer
// =============================================================================

function renderUserMessage(msg: UserMessage, cfg: RenderConfig): string {
  const { theme } = cfg;

  // Tool result
  if (msg.toolUseResult) {
    // Handle string error results (e.g., hook errors)
    if (typeof msg.toolUseResult === "string") {
      return renderToolResult({ content: msg.toolUseResult, is_error: true }, cfg);
    }
    // Handle MCP array-format results: [{type:'text', text:'...'}, {type:'image', ...}]
    if (Array.isArray(msg.toolUseResult)) {
      return renderToolResult({ content: msg.toolUseResult }, cfg);
    }
    return renderToolResult(msg.toolUseResult, cfg);
  }

  // Regular user prompt
  const content = extractTextContent(msg.message.content);
  if (!content.trim()) return "";

  // Check for interrupt message
  if (content.includes("[Request interrupted by user]")) {
    return renderInterruptMessage(content, { theme, width: cfg.width });
  }

  // Check for slash command tags (e.g., <command-name>/clear</command-name>)
  if (isCommandMessage(content)) {
    // Full command with name, message, args
    const command = parseCommandTags(content);
    if (command) {
      return renderSlashCommand(command, { theme, width: cfg.width });
    }

    // Standalone local-command-stdout
    const stdout = parseLocalCommandStdout(content);
    if (stdout !== null) {
      return renderLocalStdout(stdout, { theme, width: cfg.width });
    }
  }

  // Check for bash mode tags (e.g., <bash-input>pwd</bash-input>)
  if (isBashMessage(content)) {
    const bashInput = parseBashInput(content);
    const bashOutput = parseBashOutput(content);
    const cmdCfg = { theme, width: cfg.width };

    // Render both input and output together when both present
    if (bashInput !== null && bashOutput) {
      return (
        renderBashInput(bashInput, cmdCfg) +
        "\n" +
        renderBashOutput(bashOutput, cmdCfg)
      );
    }

    // Bash command input only
    if (bashInput !== null) {
      return renderBashInput(bashInput, cmdCfg);
    }

    // Bash output only (stdout/stderr)
    if (bashOutput) {
      return renderBashOutput(bashOutput, cmdCfg);
    }
  }

  const lines = wordWrap(content, cfg.width - 4); // Account for "> " prefix

  return lines
    .map((line, i) => {
      const text = i === 0 ? `${BOX.arrow} ${line}` : `  ${line}`;
      return style(text, { fg: theme.userPrompt, bg: theme.userPromptBg });
    })
    .join("\n");
}

/**
 * Render interrupt message with semantic color styling
 * Format: ⎿ Interrupted · What should Claude do instead?
 * Colors: tree (text), "Interrupted" (error/red), separator and text (dim)
 */
function renderInterruptMessage(
  content: string,
  cfg: { theme: RenderTheme; width: number }
): string {
  const { theme } = cfg;

  // Tree connector character (same as todos)
  const TREE_CONNECTOR = "\u23BF"; // ⎿

  // Build parts with semantic colors
  const parts: string[] = [];

  // Tree connector - text color
  parts.push(colorize(TREE_CONNECTOR, theme.muted));

  // "Interrupted" label - error/red color
  parts.push(colorize("Interrupted", theme.toolBulletError));

  // Separator and follow-up text - dim color
  parts.push(colorize("· What should Claude do instead?", theme.muted));

  return parts.join(" ");
}

// =============================================================================
// Assistant Message Renderer
// =============================================================================

function renderAssistantMessage(msg: AssistantMessage, cfg: RenderConfig): string {
  const output: string[] = [];

  for (const item of msg.message.content) {
    const rendered = renderContentItem(item, cfg);
    if (rendered) {
      output.push(rendered);
    }
  }

  return output.join("\n\n");
}

function renderContentItem(item: ContentItem, cfg: RenderConfig): string {
  const { theme } = cfg;

  switch (item.type) {
    case "text":
      return renderTextContent(item.text, cfg);

    case "thinking":
      if (!cfg.showThinking) return "";
      return renderThinkingContent(item.thinking, cfg);

    case "tool_use":
      return renderToolUse(item, cfg);

    case "image":
      return colorize("[Image]", theme.muted);

    default:
      return "";
  }
}

function renderTextContent(text: string, cfg: RenderConfig): string {
  // Parse markdown and render with ANSI styling
  return renderMarkdown(text, cfg);
}

function renderThinkingContent(thinking: string, cfg: RenderConfig): string {
  const { theme, width } = cfg;
  const lines = wordWrap(thinking, width - 2);
  const header = colorize("∴ Thinking…", theme.thinking);

  const content = lines
    .map((line) => "  " + style(line, { fg: theme.thinking, italic: true }))
    .join("\n");

  return header + "\n\n" + content;
}

function renderToolUse(tool: ToolUseContent, cfg: RenderConfig): string {
  const { theme } = cfg;

  const bullet = colorize(BOX.bullet, theme.toolBulletSuccess);
  const { displayName, isMcp } = formatToolName(tool.name);
  const name = style(displayName, { bold: true });
  const mcpSuffix = isMcp ? colorize(" (MCP)", theme.muted) : "";
  const args = formatToolArgs(tool, theme, isMcp);

  const header = `${bullet} ${name}${mcpSuffix}${args}`;

  // For TodoWrite, render todos inline with the tool call
  if (tool.name === "TodoWrite") {
    const todosOutput = renderTodosFromInput(tool.input, {
      theme,
      indentSize: cfg.indentSize,
      width: cfg.width,
    });
    if (todosOutput) {
      return header + "\n" + todosOutput;
    }
  }

  return header;
}

// =============================================================================
// System Message Renderer
// =============================================================================

function renderSystemMessage(msg: SystemMessage, cfg: RenderConfig): string {
  const { theme } = cfg;

  if (!msg.content) return "";

  const levelColors: Record<string, string> = {
    info: theme.muted,
    warning: theme.toolName,
    error: theme.toolBulletError,
  };

  const color = levelColors[msg.level ?? "info"] ?? theme.muted;
  return colorize(`[${msg.level ?? "system"}] ${msg.content}`, color);
}

// =============================================================================
// Queue Operation Renderer
// =============================================================================

function renderQueueRemove(
  content: string | ContentItem[] | undefined,
  cfg: RenderConfig
): string {
  const { theme } = cfg;
  const text = typeof content === "string" ? content : extractTextContent(content ?? []);

  if (!text.trim()) return "";

  return style(`${BOX.arrow} ${text}`, { fg: theme.userPrompt, bg: theme.userPromptBg });
}

// =============================================================================
// Content Extraction
// =============================================================================

/** Extract plain text from content (string or ContentItem array) */
export function extractTextContent(content: string | ContentItem[]): string {
  if (typeof content === "string") {
    return content;
  }

  const texts: string[] = [];
  for (const item of content) {
    if (item.type === "text") {
      texts.push(item.text);
    }
  }

  return texts.join("\n");
}
