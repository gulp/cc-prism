/**
 * ANSI escape code utilities for terminal rendering
 * Provides 24-bit color support, text styling, and word wrapping with hard-breaking
 */

// =============================================================================
// ANSI Escape Sequences
// =============================================================================

const ESC = "\x1b";
const CSI = `${ESC}[`;

/** Reset all styling */
export const RESET = `${CSI}0m`;

// =============================================================================
// Text Styles
// =============================================================================

export const BOLD = `${CSI}1m`;
export const DIM = `${CSI}2m`;
export const ITALIC = `${CSI}3m`;
export const UNDERLINE = `${CSI}4m`;

export const STRIKETHROUGH = `${CSI}9m`;

export const RESET_BOLD = `${CSI}22m`;
export const RESET_DIM = `${CSI}22m`;
export const RESET_ITALIC = `${CSI}23m`;
export const RESET_UNDERLINE = `${CSI}24m`;
export const RESET_STRIKETHROUGH = `${CSI}29m`;

// =============================================================================
// 24-bit Color Functions
// =============================================================================

/** Parse hex color to RGB tuple */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

/** Set foreground color using 24-bit RGB */
export function fg(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${CSI}38;2;${r};${g};${b}m`;
}

/** Set background color using 24-bit RGB */
export function bg(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${CSI}48;2;${r};${g};${b}m`;
}

/** Apply foreground color to text and reset */
export function colorize(text: string, hex: string): string {
  return `${fg(hex)}${text}${RESET}`;
}

/** Apply foreground color and style to text */
export function style(
  text: string,
  options: {
    fg?: string;
    bg?: string;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
  }
): string {
  let prefix = "";
  const suffix = RESET;

  if (options.bold) prefix += BOLD;
  if (options.dim) prefix += DIM;
  if (options.italic) prefix += ITALIC;
  if (options.fg) prefix += fg(options.fg);
  if (options.bg) prefix += bg(options.bg);

  return `${prefix}${text}${suffix}`;
}

// =============================================================================
// Box Drawing Characters
// =============================================================================

export const BOX = {
  // Single line
  horizontal: "─",
  vertical: "│",
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  teeRight: "├",
  teeLeft: "┤",
  teeDown: "┬",
  teeUp: "┴",
  cross: "┼",

  // Rounded corners
  roundTopLeft: "╭",
  roundTopRight: "╮",
  roundBottomLeft: "╰",
  roundBottomRight: "╯",

  // Double line
  doubleHorizontal: "═",
  doubleVertical: "║",

  // Bullets and markers
  bullet: "●",
  bulletHollow: "○",
  check: "✓",
  crossMark: "✗",
  arrow: "→",
  arrowDown: "↓",
  arrowSubagent: "⤵",
  indent: "⎿",
} as const;

// =============================================================================
// Text Manipulation
// =============================================================================

/** Wrap text to specified width, preserving words when possible, hard-breaking when necessary */
export function wordWrap(text: string, width: number): string[] {
  if (width <= 0) return [text];

  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length <= width) {
      lines.push(paragraph);
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      // Handle words longer than width - hard break them
      if (word.length > width) {
        // First, flush current line if any
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = "";
        }
        // Break long word into chunks
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
        continue;
      }

      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= width) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + "…";
}

/** Indent each line of text */
export function indent(text: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

/** Remove ANSI escape codes for length calculation */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Get visible length of text (excluding ANSI codes) */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

// =============================================================================
// Line Building Helpers
// =============================================================================

/** Create a horizontal rule */
export function horizontalRule(width: number, color?: string): string {
  const line = BOX.horizontal.repeat(width);
  return color ? colorize(line, color) : line;
}

// =============================================================================
// Cursor Control
// =============================================================================

/** Save cursor position */
export function saveCursor(): string {
  return `${CSI}s`;
}

/** Restore cursor position */
export function restoreCursor(): string {
  return `${CSI}u`;
}

/** Move cursor to row, col (1-indexed) */
export function moveTo(row: number, col: number = 1): string {
  return `${CSI}${row};${col}H`;
}

/** Move cursor to column (1-indexed) */
export function moveToCol(col: number): string {
  return `${CSI}${col}G`;
}

/** Erase from cursor to end of line */
export function eraseToEndOfLine(): string {
  return `${CSI}K`;
}

/** Erase entire line */
export function eraseLine(): string {
  return `${CSI}2K`;
}

/** Set scroll region (top and bottom rows, 1-indexed) */
export function setScrollRegion(top: number, bottom: number): string {
  return `${CSI}${top};${bottom}r`;
}

/** Reset scroll region to full terminal */
export function resetScrollRegion(): string {
  return `${CSI}r`;
}

// =============================================================================
// Box Drawing
// =============================================================================

/** Create a box around text */
export function box(
  content: string,
  options: {
    width?: number;
    borderColor?: string;
    rounded?: boolean;
  } = {}
): string {
  const { width = 80, borderColor, rounded = false } = options;
  const lines = content.split("\n");
  const innerWidth = width - 4; // 2 for borders, 2 for padding

  const tl = rounded ? BOX.roundTopLeft : BOX.topLeft;
  const tr = rounded ? BOX.roundTopRight : BOX.topRight;
  const bl = rounded ? BOX.roundBottomLeft : BOX.bottomLeft;
  const br = rounded ? BOX.roundBottomRight : BOX.bottomRight;

  const colorFn = borderColor ? (s: string) => colorize(s, borderColor) : (s: string) => s;

  const top = colorFn(tl + BOX.horizontal.repeat(width - 2) + tr);
  const bottom = colorFn(bl + BOX.horizontal.repeat(width - 2) + br);

  const wrappedLines: string[] = [];
  for (const line of lines) {
    const wrapped = wordWrap(line, innerWidth);
    wrappedLines.push(...wrapped);
  }

  const middle = wrappedLines.map((line) => {
    const padding = " ".repeat(Math.max(0, innerWidth - visibleLength(line)));
    return colorFn(BOX.vertical) + " " + line + padding + " " + colorFn(BOX.vertical);
  });

  return [top, ...middle, bottom].join("\n");
}
