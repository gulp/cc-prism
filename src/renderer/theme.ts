/**
 * Theme configuration for rendering
 * Provides semantic colors for different message types
 */

import { THEMES, type AsciicastTheme } from "../types/asciicast.js";

/** Semantic colors for message rendering */
export interface RenderTheme {
  /** Terminal foreground */
  fg: string;
  /** Terminal background */
  bg: string;
  /** User prompt prefix and text */
  userPrompt: string;
  /** User prompt background color */
  userPromptBg: string;
  /** Assistant response text */
  assistantText: string;
  /** Tool name in tool calls */
  toolName: string;
  /** Success bullet for tool calls */
  toolBulletSuccess: string;
  /** Error bullet for failed tool calls */
  toolBulletError: string;
  /** Thinking block text (dimmed) */
  thinking: string;
  /** Box drawing characters */
  boxDrawing: string;
  /** File paths in tool calls */
  filePath: string;
  /** Muted/secondary text */
  muted: string;
  /** Agent/sidechain indicator */
  agent: string;
  /** Diff: line background for additions */
  diffAddLineBg: string;
  /** Diff: character background for changed chars in additions */
  diffAddCharBg: string;
  /** Diff: line background for removals */
  diffRemoveLineBg: string;
  /** Diff: character background for changed chars in removals */
  diffRemoveCharBg: string;
}

/** Tokyo Night theme (default) */
export const TOKYO_NIGHT: RenderTheme = {
  fg: "#a9b1d6",
  bg: "#1a1b26",
  userPrompt: "#7aa2f7",
  userPromptBg: "#373737",
  assistantText: "#a9b1d6",
  toolName: "#e0af68",
  toolBulletSuccess: "#9ece6a",
  toolBulletError: "#f7768e",
  thinking: "#565f89",
  boxDrawing: "#414868",
  filePath: "#7dcfff",
  muted: "#565f89",
  agent: "#bb9af7",
  diffAddLineBg: "#225c2b",
  diffAddCharBg: "#38a660",
  diffRemoveLineBg: "#5c2b2b",
  diffRemoveCharBg: "#a63838",
};

/** Tokyo Storm theme */
export const TOKYO_STORM: RenderTheme = {
  ...TOKYO_NIGHT,
  bg: "#24283b",
};

/** Dracula theme */
export const DRACULA: RenderTheme = {
  fg: "#f8f8f2",
  bg: "#282a36",
  userPrompt: "#8be9fd",
  userPromptBg: "#373737",
  assistantText: "#f8f8f2",
  toolName: "#f1fa8c",
  toolBulletSuccess: "#50fa7b",
  toolBulletError: "#ff5555",
  thinking: "#6272a4",
  boxDrawing: "#44475a",
  filePath: "#ff79c6",
  muted: "#6272a4",
  agent: "#bd93f9",
  diffAddLineBg: "#1e4620",
  diffAddCharBg: "#2e7d32",
  diffRemoveLineBg: "#4a1e1e",
  diffRemoveCharBg: "#8b2e2e",
};

/** Nord theme */
export const NORD: RenderTheme = {
  fg: "#d8dee9",
  bg: "#2e3440",
  userPrompt: "#81a1c1",
  userPromptBg: "#373737",
  assistantText: "#d8dee9",
  toolName: "#ebcb8b",
  toolBulletSuccess: "#a3be8c",
  toolBulletError: "#bf616a",
  thinking: "#4c566a",
  boxDrawing: "#3b4252",
  filePath: "#88c0d0",
  muted: "#4c566a",
  agent: "#b48ead",
  diffAddLineBg: "#2e4a3a",
  diffAddCharBg: "#4a7a5c",
  diffRemoveLineBg: "#4a2e2e",
  diffRemoveCharBg: "#7a4a4a",
};

/** Catppuccin Mocha theme */
export const CATPPUCCIN_MOCHA: RenderTheme = {
  fg: "#cdd6f4",
  bg: "#1e1e2e",
  userPrompt: "#89b4fa",
  userPromptBg: "#373737",
  assistantText: "#cdd6f4",
  toolName: "#f9e2af",
  toolBulletSuccess: "#a6e3a1",
  toolBulletError: "#f38ba8",
  thinking: "#585b70",
  boxDrawing: "#45475a",
  filePath: "#94e2d5",
  muted: "#585b70",
  agent: "#f5c2e7",
  diffAddLineBg: "#264a35",
  diffAddCharBg: "#40a060",
  diffRemoveLineBg: "#4a2635",
  diffRemoveCharBg: "#a04050",
};

/** All available render themes */
export const RENDER_THEMES: Record<string, RenderTheme> = {
  "tokyo-night": TOKYO_NIGHT,
  "tokyo-storm": TOKYO_STORM,
  dracula: DRACULA,
  nord: NORD,
  "catppuccin-mocha": CATPPUCCIN_MOCHA,
};

/** Get render theme by name, defaulting to tokyo-night */
export function getTheme(name: string): RenderTheme {
  return RENDER_THEMES[name] ?? TOKYO_NIGHT;
}

/** Convert render theme to asciicast theme for embedding */
export function toAsciicastTheme(theme: RenderTheme): AsciicastTheme {
  const name = Object.entries(RENDER_THEMES).find(
    ([, t]) => t === theme
  )?.[0];

  if (name && THEMES[name]) {
    return THEMES[name];
  }

  // Generate palette from theme colors
  // ANSI colors 0-7: black, red, green, yellow, blue, magenta, cyan, white
  // ANSI colors 8-15: bright variants
  const palette = [
    theme.bg, // black (background)
    theme.toolBulletError, // red
    theme.toolBulletSuccess, // green
    theme.toolName, // yellow
    theme.userPrompt, // blue
    theme.agent, // magenta
    theme.filePath, // cyan
    theme.fg, // white (foreground)
    theme.muted, // bright black
    theme.toolBulletError, // bright red
    theme.toolBulletSuccess, // bright green
    theme.toolName, // bright yellow
    theme.userPrompt, // bright blue
    theme.agent, // bright magenta
    theme.filePath, // bright cyan
    theme.assistantText, // bright white
  ].join(":");

  return {
    fg: theme.fg,
    bg: theme.bg,
    palette,
  };
}
