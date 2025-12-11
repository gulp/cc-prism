/**
 * Timing logic for asciicast generation
 * Handles timing presets and calculations
 */

import type { TranscriptEntry } from "../types/messages.js";
import type { TimingConfig } from "../types/asciicast.js";
import { TIMING_PRESETS } from "../types/asciicast.js";
import { getTimestamp } from "../parser/loader.js";

// =============================================================================
// Timing Configuration
// =============================================================================

export interface TimingOptions extends TimingConfig {
  /** Preset name (overrides individual settings) */
  preset?: "speedrun" | "default" | "realtime";
}

export function resolveTimingConfig(options: Partial<TimingOptions>): TimingConfig {
  // If preset specified, use it as base
  const presetName = options.preset;
  if (presetName) {
    const presetConfig = TIMING_PRESETS[presetName];
    if (presetConfig) {
      return {
        ...presetConfig,
        // Allow overrides
        maxWait: options.maxWait ?? presetConfig.maxWait,
        thinkingPause: options.thinkingPause ?? presetConfig.thinkingPause,
        typingEffect: options.typingEffect ?? presetConfig.typingEffect,
        typingSpeed: options.typingSpeed ?? presetConfig.typingSpeed,
      };
    }
  }

  // Use default preset as fallback
  return {
    ...TIMING_PRESETS["default"]!,
    ...options,
  };
}

// =============================================================================
// Timing Calculator
// =============================================================================

export class TimingCalculator {
  private config: TimingConfig;
  private lastTimestamp: Date | null = null;
  private currentTime = 0;

  constructor(config: TimingConfig) {
    this.config = config;
  }

  /** Get the current playback time */
  get time(): number {
    return this.currentTime;
  }

  /** Set the current playback time (for syncing with external animation) */
  set time(value: number) {
    this.currentTime = value;
  }

  /** Reset the calculator */
  reset(): void {
    this.lastTimestamp = null;
    this.currentTime = 0;
  }

  /** Calculate time for next entry */
  nextEntry(entry: TranscriptEntry): number {
    const timestamp = getTimestamp(entry);

    // Real timing mode - use actual timestamps
    if (this.config.maxWait === Infinity && timestamp && this.lastTimestamp) {
      const realDelta = (timestamp.getTime() - this.lastTimestamp.getTime()) / 1000;
      this.lastTimestamp = timestamp;
      this.currentTime += Math.max(0, realDelta);
      return this.currentTime;
    }

    // Calculate normalized timing
    let delta = 0;

    if (timestamp && this.lastTimestamp) {
      // Use real delta but cap it
      const realDelta = (timestamp.getTime() - this.lastTimestamp.getTime()) / 1000;
      delta = Math.min(realDelta, this.config.maxWait);
    } else {
      // Default pause between messages
      delta = this.getDefaultPause(entry);
    }

    if (timestamp) {
      this.lastTimestamp = timestamp;
    }

    this.currentTime += delta;
    return this.currentTime;
  }

  /** Add pause for assistant response (thinking time) */
  addThinkingPause(): void {
    this.currentTime += this.config.thinkingPause;
  }

  /** Add a fixed pause */
  addPause(seconds: number): void {
    this.currentTime += Math.min(seconds, this.config.maxWait);
  }

  /** Calculate typing duration for text */
  getTypingDuration(text: string): number {
    if (!this.config.typingEffect || this.config.typingSpeed <= 0) {
      return 0;
    }
    return text.length / this.config.typingSpeed;
  }

  /** Check if typing effect is enabled */
  get hasTypingEffect(): boolean {
    return this.config.typingEffect && this.config.typingSpeed > 0;
  }

  /** Get the timing config */
  getConfig(): TimingConfig {
    return { ...this.config };
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  private getDefaultPause(entry: TranscriptEntry): number {
    switch (entry.type) {
      case "user":
        // Brief pause before user message
        if ("toolUseResult" in entry && entry.toolUseResult) {
          return 0.1; // Tool results appear quickly
        }
        return 0.3; // User typing

      case "assistant":
        // Thinking pause before assistant response
        return this.config.thinkingPause;

      case "system":
        return 0.2;

      default:
        return 0.1;
    }
  }
}

// =============================================================================
// Typing Effect Generator
// =============================================================================

export interface TypedSegment {
  text: string;
  time: number;
}

/** Generate typing effect segments for text */
export function generateTypingSegments(
  text: string,
  startTime: number,
  charsPerSecond: number,
  chunkSize: number = 3
): TypedSegment[] {
  if (charsPerSecond <= 0) {
    return [{ text, time: startTime }];
  }

  const segments: TypedSegment[] = [];
  const timePerChar = 1 / charsPerSecond;
  let currentTime = startTime;

  // Split into chunks for more natural typing
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.substring(i, Math.min(i + chunkSize, text.length));
    segments.push({ text: chunk, time: currentTime });
    currentTime += chunk.length * timePerChar;
  }

  return segments;
}

/** Generate line-by-line output with timing */
export function generateLineSegments(
  text: string,
  startTime: number,
  lineDelay: number
): TypedSegment[] {
  const lines = text.split("\n");
  const segments: TypedSegment[] = [];
  let currentTime = startTime;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Add newline for all but last line
    const output = i < lines.length - 1 ? line + "\n" : line;
    segments.push({ text: output, time: currentTime });
    currentTime += lineDelay;
  }

  return segments;
}
