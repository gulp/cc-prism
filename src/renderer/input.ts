/**
 * User input UI renderer - emulates Claude Code's command line interface
 * Renders a fixed-position input area at the bottom of the terminal
 * with burst typing animation and proper cursor positioning
 */

import {
  BOX,
  colorize,
  horizontalRule,
  wordWrap,
  moveTo,
  eraseLine,
  setScrollRegion,
} from "./ansi.js";
import type { RenderTheme } from "./theme.js";

// =============================================================================
// Types
// =============================================================================

export interface InputUIConfig {
  /** Theme for colors */
  theme: RenderTheme;
  /** Terminal width */
  width: number;
  /** Terminal height (rows) */
  height: number;
  /** Text always starts at this column (0-indexed) */
  textColumn: number;
}

/** Row positions for fixed input area (1-indexed for ANSI) */
export interface InputAreaRows {
  /** Last row of scrolling content area */
  scrollEnd: number;
  /** Fixed spinner row (outside scroll region) */
  spinnerRow: number;
  /** Top horizontal line */
  topLine: number;
  /** Input row with arrow prompt */
  input: number;
  /** Bottom horizontal line */
  bottomLine: number;
}

/** Calculate input area row positions based on terminal height
 * Layout for height=40:
 *   rows 1-36: scroll region (content)
 *   row 37: spinner (fixed, outside scroll region)
 *   row 38: topLine (input frame border)
 *   row 39: input (prompt line)
 *   row 40: bottomLine (input frame border)
 */
export function getInputAreaRows(height: number): InputAreaRows {
  return {
    scrollEnd: height - 4,    // 36 for height=40
    spinnerRow: height - 3,   // 37 for height=40
    topLine: height - 2,      // 38 for height=40
    input: height - 1,        // 39 for height=40
    bottomLine: height,       // 40 for height=40
  };
}

export interface BurstTypingConfig {
  /** Initial delay between words (ms) */
  initialGapMs: number;
  /** Minimum delay between words (ms) */
  minGapMs: number;
  /** Decay factor per word (multiplied each time) */
  decayFactor: number;
}

export interface InputTypedSegment {
  /** Text to output */
  text: string;
  /** Time offset from start (seconds) */
  time: number;
}

// =============================================================================
// Default Configurations
// =============================================================================

export const DEFAULT_INPUT_UI_CONFIG: Omit<InputUIConfig, "theme"> = {
  width: 100,
  height: 40,
  textColumn: 2, // After "→ " (arrow + space)
};

/**
 * Get the 1-indexed cursor column for the input area.
 * ANSI cursor positioning is 1-indexed, so textColumn (0-indexed) + 1.
 */
export function getCursorColumn(config: InputUIConfig): number {
  return config.textColumn + 1;
}

export const DEFAULT_BURST_TYPING_CONFIG: BurstTypingConfig = {
  initialGapMs: 200,
  minGapMs: 30,
  decayFactor: 0.75,
};

// =============================================================================
// Input UI Rendering
// =============================================================================

/**
 * Render the input UI frame (horizontal lines + arrow prompt)
 * Returns: [topLine, promptLine, bottomLine]
 */
export function renderInputFrame(config: InputUIConfig): {
  topLine: string;
  promptPrefix: string;
  bottomLine: string;
} {
  const { theme, width } = config;
  const lineColor = theme.muted;

  return {
    topLine: horizontalRule(width, lineColor),
    promptPrefix: colorize(`${BOX.arrow} `, theme.userPrompt),
    bottomLine: horizontalRule(width, lineColor),
  };
}

/**
 * Wrap user text for input area, maintaining column 3 alignment
 * Returns lines with proper indentation for continuation lines
 */
export function wrapInputText(
  text: string,
  config: InputUIConfig
): string[] {
  const { width, textColumn } = config;
  // Available width for text: total width minus prompt indent minus right margin
  // The -1 right margin prevents text from reaching terminal edge (avoids wrap issues)
  const textWidth = width - textColumn - 1;

  // Handle explicit line breaks
  const paragraphs = text.split("\n");
  const allLines: string[] = [];

  for (const para of paragraphs) {
    const wrapped = wordWrap(para, textWidth);
    allLines.push(...(wrapped.length > 0 ? wrapped : [""]));
  }

  return allLines;
}

// =============================================================================
// Burst Typing Animation
// =============================================================================

/**
 * Split text into words for burst typing
 * Preserves spaces as separate tokens for accurate replay
 */
export function splitIntoWords(text: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (const char of text) {
    if (char === " " || char === "\n") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(char);
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Generate burst typing segments for user input
 * Words appear as chunks, gaps between words shrink exponentially
 */
export function generateBurstTypingSegments(
  text: string,
  startTime: number,
  config: BurstTypingConfig = DEFAULT_BURST_TYPING_CONFIG
): InputTypedSegment[] {
  const words = splitIntoWords(text);
  if (words.length === 0) {
    return [];
  }

  const segments: InputTypedSegment[] = [];
  let currentTime = startTime;
  let currentGap = config.initialGapMs / 1000; // Convert to seconds

  for (const word of words) {
    segments.push({ text: word, time: currentTime });

    // Only add gap after non-whitespace words
    if (word.trim()) {
      currentTime += currentGap;
      // Decay the gap, but don't go below minimum
      currentGap = Math.max(
        config.minGapMs / 1000,
        currentGap * config.decayFactor
      );
    }
  }

  return segments;
}

// =============================================================================
// Fixed-Position Input Area
// =============================================================================

export interface InputAnimationResult {
  /** Segments for typing animation */
  segments: InputTypedSegment[];
  /** User prompt text formatted for scrolling area (→ text with wrapping) */
  scrollOutput: string;
  /** Total duration of animation (seconds) */
  duration: number;
}

/**
 * Generate the initial input area setup at the bottom of the terminal
 * This sets up the scroll region and renders the 3-line input frame
 *
 * Layout for height=40:
 *   rows 1-36: scroll region (content)
 *   row 37: spinner row (outside scroll region, fixed position)
 *   rows 38-40: input frame (topLine, input, bottomLine)
 */
export function generateInputAreaSetup(config: InputUIConfig): string {
  const rows = getInputAreaRows(config.height);
  const frame = renderInputFrame(config);

  // Set scroll region to exclude spinner row and input area
  return (
    setScrollRegion(1, rows.scrollEnd) +
    moveTo(rows.topLine) +
    frame.topLine +
    moveTo(rows.input) +
    frame.promptPrefix +
    moveTo(rows.bottomLine) +
    frame.bottomLine +
    moveTo(rows.input, config.textColumn + 1) // Position cursor after "→ "
  );
}

/**
 * Redraw the input frame (use after content output to restore corrupted frame)
 * This clears and redraws all 3 lines of the input area
 */
export function redrawInputFrame(config: InputUIConfig): string {
  const rows = getInputAreaRows(config.height);
  const frame = renderInputFrame(config);

  return (
    // Clear and redraw top line
    moveTo(rows.topLine) +
    eraseLine() +
    frame.topLine +
    // Clear and redraw input line with prompt
    moveTo(rows.input) +
    eraseLine() +
    frame.promptPrefix +
    // Clear and redraw bottom line
    moveTo(rows.bottomLine) +
    eraseLine() +
    frame.bottomLine +
    // Position cursor after "→ "
    moveTo(rows.input, config.textColumn + 1)
  );
}

/**
 * Generate complete input animation with fixed-position typing
 *
 * The animation:
 * 1. Types text in the input row with burst animation
 * 2. On "submit": clears input row, outputs user text to scrolling area
 * 3. Input area remains with empty prompt ready for next input
 */
export function generateInputAnimation(
  text: string,
  startTime: number,
  uiConfig: InputUIConfig,
  typingConfig: BurstTypingConfig = DEFAULT_BURST_TYPING_CONFIG
): InputAnimationResult {
  const { theme, width, textColumn } = uiConfig;
  const rows = getInputAreaRows(uiConfig.height);
  const frame = renderInputFrame(uiConfig);

  const segments: InputTypedSegment[] = [];
  let currentTime = startTime;

  // Position cursor at input row after arrow prompt
  const cursorCol = textColumn + 1; // After "→ "
  segments.push({
    text: moveTo(rows.input, cursorCol),
    time: currentTime,
  });
  currentTime += 0.05;

  // Truncate display text if it exceeds available width on input row
  // Available space: width - textColumn (for "→ ") - 1 (for ellipsis if needed)
  const maxDisplayLength = width - textColumn - 1;
  let displayText = text.replace(/\n/g, " "); // Flatten newlines for single-line display
  let extraDelay = 0;

  if (displayText.length > maxDisplayLength) {
    displayText = displayText.slice(0, maxDisplayLength - 1) + "…";
    extraDelay = 0.4; // Simulate user typing longer before submit
  }

  // Generate burst typing segments for the truncated display text
  const typingSegments = generateBurstTypingSegments(displayText, currentTime, typingConfig);
  segments.push(...typingSegments);

  // Update time to after typing
  if (typingSegments.length > 0) {
    const lastSegment = typingSegments[typingSegments.length - 1]!;
    currentTime = lastSegment.time + 0.2 + extraDelay; // Pause before "submit"
  }

  // "Submit" - clear input row and prepare for output
  // 1. Clear the input row back to just the arrow prompt
  segments.push({
    text:
      moveTo(rows.input) +
      eraseLine() +
      frame.promptPrefix +
      moveTo(rows.input, cursorCol), // Cursor back to input position
    time: currentTime,
  });
  currentTime += 0.1;

  // 2. Move to scrolling area and output user prompt
  // The scrollOutput will be appended separately by the converter
  segments.push({
    text: moveTo(rows.scrollEnd) + "\r\n", // Move to scroll area, newline to scroll
    time: currentTime,
  });

  // Generate formatted user prompt for scrolling area (→ text with wrapping)
  const wrappedLines = wrapInputText(text, uiConfig);
  const indent = " ".repeat(textColumn + 1);
  const scrollLines = wrappedLines.map((line, i) => {
    const styledLine = colorize(line, theme.userPrompt);
    return i === 0 ? frame.promptPrefix + styledLine : indent + styledLine;
  });
  const scrollOutput = scrollLines.join("\r\n") + "\r\n";

  return {
    segments,
    scrollOutput,
    duration: currentTime - startTime,
  };
}
