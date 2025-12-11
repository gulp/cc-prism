/**
 * Slash command parsing and rendering for Claude Code CLI commands
 * Handles XML-formatted command tags in user messages
 */

import { BOX, colorize, style } from "./ansi.js";
import type { RenderTheme } from "./theme.js";

// =============================================================================
// Types
// =============================================================================

/** Parsed slash command from XML tags */
export interface ParsedCommand {
  /** Command name (e.g., "/clear", "/status") */
  name: string;
  /** Human-readable message (e.g., "clear", "status") */
  message: string;
  /** Command arguments (often empty) */
  args: string;
  /** Command stdout output (may be empty) */
  stdout: string;
}

/** Parsed bash mode command from XML tags */
export interface ParsedBashCommand {
  /** The bash command that was executed */
  input: string;
  /** Standard output (may be empty) */
  stdout: string;
  /** Standard error (may be empty) */
  stderr: string;
}

// =============================================================================
// Command Tag Parsing
// =============================================================================

/**
 * Parse command XML tags from user message content.
 * Returns parsed command if found, null otherwise.
 *
 * Expected format:
 * <command-name>/clear</command-name>
 * <command-message>clear</command-message>
 * <command-args></command-args>
 *
 * And optionally in a following message:
 * <local-command-stdout>output text</local-command-stdout>
 */
export function parseCommandTags(content: string): ParsedCommand | null {
  // Check for command-name tag
  const nameMatch = content.match(/<command-name>([^<]*)<\/command-name>/);
  if (!nameMatch) {
    return null;
  }

  const name = nameMatch[1] || "";

  // Extract other tags
  const messageMatch = content.match(/<command-message>([^<]*)<\/command-message>/);
  const argsMatch = content.match(/<command-args>([^<]*)<\/command-args>/);
  const stdoutMatch = content.match(/<local-command-stdout>([^<]*)<\/local-command-stdout>/);

  return {
    name,
    message: messageMatch?.[1] || "",
    args: argsMatch?.[1] || "",
    stdout: stdoutMatch?.[1] || "",
  };
}

/**
 * Parse local-command-stdout tag from content.
 * Used for standalone stdout messages that follow command messages.
 */
export function parseLocalCommandStdout(content: string): string | null {
  const match = content.match(/<local-command-stdout>([^<]*)<\/local-command-stdout>/);
  return match ? (match[1] || "") : null;
}

/**
 * Check if content is a command message (starts with command tags, not just contains them)
 */
export function isCommandMessage(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith("<command-name>") || trimmed.startsWith("<local-command-stdout>");
}

// =============================================================================
// Bash Mode Tag Parsing
// =============================================================================

/**
 * Check if content is a bash mode message (starts with bash tags)
 */
export function isBashMessage(content: string): boolean {
  // Use includes to detect bash tags anywhere in content (may have "Caveat:" prefix)
  return (
    content.includes("<bash-input>") ||
    content.includes("<bash-stdout>") ||
    content.includes("<bash-stderr>")
  );
}

/**
 * Check if content is specifically a bash input message (command, not output)
 */
export function isBashInputMessage(content: string): boolean {
  return content.includes("<bash-input>");
}

/**
 * Parse bash-input tag from content.
 * Returns the command string if found, null otherwise.
 */
export function parseBashInput(content: string): string | null {
  const match = content.match(/<bash-input>([\s\S]*?)<\/bash-input>/);
  return match ? (match[1] ?? "").trim() : null;
}

/**
 * Parse bash-stdout and bash-stderr tags from content.
 * Returns parsed output if found, null otherwise.
 */
export function parseBashOutput(content: string): { stdout: string; stderr: string } | null {
  const stdoutMatch = content.match(/<bash-stdout>([\s\S]*?)<\/bash-stdout>/);
  const stderrMatch = content.match(/<bash-stderr>([\s\S]*?)<\/bash-stderr>/);

  if (!stdoutMatch && !stderrMatch) {
    return null;
  }

  return {
    stdout: (stdoutMatch?.[1] || "").trim(),
    stderr: (stderrMatch?.[1] || "").trim(),
  };
}

// =============================================================================
// Command Rendering
// =============================================================================

/** Configuration for command rendering */
export interface CommandRenderConfig {
  theme: RenderTheme;
  width: number;
  maxOutputLines?: number; // Max lines before truncation (default: 5)
}

/**
 * Render a parsed slash command for terminal display.
 * Format: [/command] args (if any)
 *         stdout (if non-empty)
 */
export function renderSlashCommand(
  command: ParsedCommand,
  cfg: CommandRenderConfig
): string {
  const { theme } = cfg;

  // Format: "> /command " with arrow prefix, trailing space, white text on dark gray
  // Note: command.name already includes the slash (e.g., "/status")
  let line = `${BOX.arrow} ${command.name}`;

  if (command.args.trim()) {
    line += ` (${command.args})`;
  }

  // Add trailing space (matches Claude Code UI)
  line += " ";

  // White text on dark gray background (matching Claude Code UI)
  // fg: #ffffff (255;255;255), bg: #373737 (55;55;55)
  const result = style(line, { fg: "#ffffff", bg: "#373737" });

  // Include stdout if present (indented on next line)
  if (command.stdout.trim()) {
    const stdoutLine = colorize(`  ${command.stdout}`, theme.muted);
    return `${result}\n${stdoutLine}`;
  }

  return result;
}

/**
 * Render standalone local-command-stdout for terminal display.
 * Used when stdout appears in a separate message from the command.
 */
export function renderLocalStdout(
  stdout: string,
  cfg: CommandRenderConfig
): string {
  const { theme } = cfg;

  // Skip empty or placeholder output
  if (!stdout.trim() || stdout === "...") {
    return "";
  }

  return colorize(`  ${stdout}`, theme.muted);
}

// =============================================================================
// Bash Mode Rendering
// =============================================================================

// Bash mode colors (from authentic Claude Code rendering)
const BASH_MODE_PINK = "#fd5db1"; // rgb(253,93,177) - for ! prefix
const BASH_COMMAND_BG = "#413c41"; // rgb(65,60,65) - command box background
const BASH_COMMAND_TEXT = "#ffffff"; // rgb(255,255,255) - command text
const BASH_STDERR_COLOR = "#ff6b80"; // rgb(255,107,128) - error text

/**
 * Render a bash mode command input for terminal display.
 * Format: [pink !][white command] on dark background
 */
export function renderBashInput(
  command: string,
  cfg: CommandRenderConfig
): string {
  // Format: "! command " with pink !, white text, dark bg, trailing space
  const prefix = style("!", { fg: BASH_MODE_PINK, bg: BASH_COMMAND_BG });
  const cmdText = style(` ${command} `, { fg: BASH_COMMAND_TEXT, bg: BASH_COMMAND_BG });

  return prefix + cmdText;
}

/**
 * Render bash mode output (stdout/stderr) for terminal display.
 * Format:   ⎿  output text (with tree connector)
 * Stderr is rendered in red, stdout in default/muted color.
 */
export function renderBashOutput(
  output: { stdout: string; stderr: string },
  cfg: CommandRenderConfig
): string {
  const { theme, maxOutputLines = 5 } = cfg;
  const lines: string[] = [];

  // Helper to render output lines with truncation
  const renderLines = (
    rawLines: string[],
    color: string | null,
    useConnector: boolean
  ): number => {
    const truncated = rawLines.length > maxOutputLines;
    const displayLines = truncated ? rawLines.slice(0, maxOutputLines) : rawLines;

    for (let i = 0; i < displayLines.length; i++) {
      const line = displayLines[i];
      const prefix = i === 0 && useConnector ? `  ${BOX.indent}  ` : "     ";
      const formatted = `${prefix}${line}`;
      lines.push(color ? colorize(formatted, color) : formatted);
    }

    if (truncated) {
      const hiddenCount = rawLines.length - maxOutputLines;
      lines.push(
        colorize(`     … +${hiddenCount} lines (ctrl+o to expand)`, theme.muted)
      );
    }

    return displayLines.length;
  };

  // Render stderr first (if present) - in red
  if (output.stderr.trim()) {
    const stderrLines = output.stderr.split("\n");
    renderLines(stderrLines, BASH_STDERR_COLOR, true);
  }

  // Render stdout (if present) - in muted/default color
  if (output.stdout.trim()) {
    const stdoutLines = output.stdout.split("\n");
    const startWithConnector = lines.length === 0; // Only use connector if no stderr
    renderLines(stdoutLines, null, startWithConnector);
  }

  return lines.join("\n");
}
