/**
 * Status spinner with shimmering verb text
 * Emulates Claude CLI's animated status line during processing
 */

import { fg, RESET, moveTo, eraseLine } from "./ansi.js";
import type { RenderTheme } from "./theme.js";
import verbsData from "./verbs.json" with { type: "json" };

// =============================================================================
// Constants
// =============================================================================

/** Spinner rotation characters (ping-pong: expands then contracts) */
export const SPINNER_CHARS = ["·", "✢", "✳", "✻", "✽", "✻", "✳", "✢"] as const;

/** Default shimmer colors */
export const SHIMMER_BASE_COLOR = "#d77757";
export const SHIMMER_HIGHLIGHT_COLOR = "#eb9f7f";

/** Default frame interval in milliseconds */
export const DEFAULT_FRAME_INTERVAL_MS = 200;

/** Default shimmer window size (characters) */
export const DEFAULT_SHIMMER_WINDOW_SIZE = 3;

/** Pre-loaded verbs for status spinner */
export const VERBS: string[] = verbsData.verbs;

// =============================================================================
// Types
// =============================================================================

export interface SpinnerConfig {
  /** Theme for fallback colors */
  theme: RenderTheme;
  /** Frame interval in milliseconds */
  frameIntervalMs: number;
  /** Shimmer highlight window size in characters */
  shimmerWindowSize: number;
  /** Base color for verb text */
  baseColor: string;
  /** Highlight color for shimmer window */
  highlightColor: string;
}

export interface SpinnerSegment {
  /** ANSI escape codes + spinner + verb */
  text: string;
  /** Absolute timestamp in seconds */
  time: number;
}

export const DEFAULT_SPINNER_CONFIG: Omit<SpinnerConfig, "theme"> = {
  frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
  shimmerWindowSize: DEFAULT_SHIMMER_WINDOW_SIZE,
  baseColor: SHIMMER_BASE_COLOR,
  highlightColor: SHIMMER_HIGHLIGHT_COLOR,
};

/**
 * Spinner display mode
 * - OFF: No spinner displayed
 * - INLINE: Spinner renders in content flow, scrolls away naturally
 * - FIXED: Spinner at fixed row outside scroll region, stays visible until cleared
 */
export enum SpinnerMode {
  OFF = "off",
  INLINE = "inline",
  FIXED = "fixed",
}

/**
 * Spinner state for clean lifecycle management
 * Replaces scattered boolean flags with explicit state machine
 */
export interface SpinnerState {
  /** Current display mode */
  mode: SpinnerMode;
  /** Current verb being displayed (null when OFF) */
  verb: string | null;
  /** Fixed row position (only used in FIXED mode) */
  row: number | null;
}

/** Create initial spinner state (off) */
export function createSpinnerState(): SpinnerState {
  return {
    mode: SpinnerMode.OFF,
    verb: null,
    row: null,
  };
}

// =============================================================================
// Verb Selection
// =============================================================================

/**
 * Select a pseudo-random verb from the list
 * Uses Knuth multiplicative hash for better distribution while staying deterministic
 */
export function selectVerb(verbs: string[], seed: number): string {
  if (verbs.length === 0) {
    return "Processing";
  }
  // Knuth multiplicative hash for pseudo-random distribution
  // Add 1 to avoid seed=0 always giving index 0
  const hash = Math.abs(((seed + 1) * 2654435761) | 0);
  const index = hash % verbs.length;
  return verbs[index];
}

// =============================================================================
// Shimmer Effect
// =============================================================================

/**
 * Calculate shimmer window position for a given frame
 * Window slides from left to right across the text
 */
export function getShimmerWindow(
  frameIndex: number,
  textLength: number,
  windowSize: number
): [start: number, end: number] {
  // The window position cycles through the text
  // We extend past the text length so the window fully exits
  const totalPositions = textLength + windowSize;
  const position = frameIndex % totalPositions;

  const start = Math.max(0, position - windowSize + 1);
  const end = Math.min(textLength, position + 1);

  return [start, end];
}

/**
 * Apply shimmer effect to text at a given frame
 * Returns text with character-level ANSI coloring
 */
export function applyShimmer(
  text: string,
  frameIndex: number,
  config: Pick<SpinnerConfig, "shimmerWindowSize" | "baseColor" | "highlightColor">
): string {
  const [windowStart, windowEnd] = getShimmerWindow(
    frameIndex,
    text.length,
    config.shimmerWindowSize
  );

  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isHighlighted = i >= windowStart && i < windowEnd;
    const color = isHighlighted ? config.highlightColor : config.baseColor;
    result += fg(color) + char;
  }

  return result + RESET;
}

// =============================================================================
// Spinner Animation Generation
// =============================================================================

/**
 * Generate a single spinner frame
 * Combines spinner character with shimmered verb text
 */
export function renderSpinnerFrame(
  verb: string,
  frameIndex: number,
  config: SpinnerConfig
): string {
  const spinnerChar = SPINNER_CHARS[frameIndex % SPINNER_CHARS.length];
  const shimmeredVerb = applyShimmer(verb + "…", frameIndex, config);

  // Spinner char in base color, space, then shimmered verb
  return fg(config.baseColor) + spinnerChar + RESET + " " + shimmeredVerb;
}

/**
 * Generate status spinner animation segments
 * Creates timed segments for the thinking pause period
 *
 * @param verb - The action verb to display (e.g., "Clauding", "Pondering")
 * @param startTime - Start time in seconds
 * @param duration - Total duration in seconds
 * @param config - Spinner configuration
 * @param row - Optional row for fixed positioning (1-indexed)
 * @returns Array of timed segments for the animation
 */
export function generateStatusSpinnerSegments(
  verb: string,
  startTime: number,
  duration: number,
  config: SpinnerConfig,
  row?: number
): SpinnerSegment[] {
  const segments: SpinnerSegment[] = [];
  const frameIntervalSec = config.frameIntervalMs / 1000;
  const totalFrames = Math.max(1, Math.floor(duration / frameIntervalSec));

  for (let i = 0; i < totalFrames; i++) {
    const time = startTime + i * frameIntervalSec;
    const frameContent = renderSpinnerFrame(verb, i, config);

    // Build the frame output with optional positioning
    let text = "";
    if (row !== undefined) {
      // Fixed position mode: move to row, erase line, render frame
      text = moveTo(row, 1) + eraseLine() + frameContent;
    } else {
      // Inline mode: just erase current line and render
      // Use carriage return to go to start of line
      text = "\r" + eraseLine() + frameContent;
    }

    segments.push({ text, time });
  }

  return segments;
}

/**
 * Generate the clear sequence to remove spinner before content
 */
export function generateSpinnerClear(row?: number): string {
  if (row !== undefined) {
    return moveTo(row, 1) + eraseLine();
  }
  return "\r" + eraseLine();
}

