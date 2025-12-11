/**
 * asciicast document builder
 * Creates asciicast v3 format documents from rendered messages
 */

import type {
  AsciicastHeader,
  AsciicastEvent,
  AsciicastDocument,
  AsciicastTheme,
  OutputEvent,
  MarkerEvent,
} from "../types/asciicast.js";
import { THEMES } from "../types/asciicast.js";

// =============================================================================
// Builder Configuration
// =============================================================================

export interface BuilderConfig {
  /** Terminal width */
  cols: number;
  /** Terminal height */
  rows: number;
  /** Terminal type */
  termType: string;
  /** Theme to embed */
  theme: AsciicastTheme;
  /** Recording title */
  title?: string;
  /** Recording timestamp (Unix seconds) */
  timestamp?: number;
}

export const DEFAULT_BUILDER_CONFIG: BuilderConfig = {
  cols: 100,
  rows: 40,
  termType: "xterm-256color",
  theme: THEMES["tokyo-night"]!,
  title: "Claude Code Session",
};

// =============================================================================
// Document Builder
// =============================================================================

export class AsciicastBuilder {
  private config: BuilderConfig;
  private events: AsciicastEvent[] = [];
  private currentTime = 0;
  private lastEventTime = 0;

  constructor(config: Partial<BuilderConfig> = {}) {
    this.config = { ...DEFAULT_BUILDER_CONFIG, ...config };
  }

  /** Get the current timestamp */
  get time(): number {
    return this.currentTime;
  }

  /** Set the current timestamp */
  set time(t: number) {
    this.currentTime = t;
  }

  /** Add time to current timestamp */
  addTime(seconds: number): this {
    this.currentTime += seconds;
    return this;
  }

  /** Add an output event (ANSI text) */
  output(text: string): this {
    if (text.length > 0) {
      // asciicast v3 uses relative time (interval since previous event)
      // Math.max(0, ...) prevents negative intervals if time goes backward
      const interval = Math.max(0, this.currentTime - this.lastEventTime);
      const event: OutputEvent = [interval, "o", text];
      this.events.push(event);
      this.lastEventTime = this.currentTime;
    }
    return this;
  }

  /** Add output with a newline */
  outputLine(text: string): this {
    return this.output(text + "\n");
  }

  /** Add multiple lines of output */
  outputLines(lines: string[]): this {
    for (const line of lines) {
      this.outputLine(line);
    }
    return this;
  }

  /** Add a marker event for navigation */
  marker(label: string): this {
    // asciicast v3 uses relative time (interval since previous event)
    // Markers are instant navigation points - don't update lastEventTime
    // so subsequent output at same currentTime gets the proper interval
    // Math.max(0, ...) prevents negative intervals if time goes backward
    const interval = Math.max(0, this.currentTime - this.lastEventTime);
    const event: MarkerEvent = [interval, "m", label];
    this.events.push(event);
    return this;
  }

  /** Add output and marker at the same time */
  outputWithMarker(text: string, markerLabel: string): this {
    this.marker(markerLabel);
    this.output(text);
    return this;
  }

  /** Add a blank line */
  blank(): this {
    return this.output("\n");
  }

  /** Add multiple blank lines */
  blanks(count: number): this {
    for (let i = 0; i < count; i++) {
      this.blank();
    }
    return this;
  }

  /** Clear the screen (ANSI escape sequence) */
  clear(): this {
    return this.output("\x1b[2J\x1b[H");
  }

  /** Build the header */
  buildHeader(): AsciicastHeader {
    return {
      version: 3,
      term: {
        cols: this.config.cols,
        rows: this.config.rows,
        type: this.config.termType,
        theme: this.config.theme,
      },
      timestamp: this.config.timestamp ?? Math.floor(Date.now() / 1000),
      title: this.config.title,
    };
  }

  /** Build the complete document */
  build(): AsciicastDocument {
    return {
      header: this.buildHeader(),
      events: [...this.events],
    };
  }

  /** Get current event count */
  get eventCount(): number {
    return this.events.length;
  }

  /** Reset builder state (keeps config) */
  reset(): this {
    this.events = [];
    this.currentTime = 0;
    this.lastEventTime = 0;
    return this;
  }
}

// =============================================================================
// Serialization
// =============================================================================

/** Serialize asciicast document to .cast file format (NDJSON) */
export function serializeCast(doc: AsciicastDocument): string {
  const lines: string[] = [];

  // Header as first line
  lines.push(JSON.stringify(doc.header));

  // Events as subsequent lines
  for (const event of doc.events) {
    lines.push(JSON.stringify(event));
  }

  return lines.join("\n") + "\n";
}

/** Parse .cast file content back to document */
export function parseCast(content: string): AsciicastDocument {
  const lines = content.trim().split("\n");

  if (lines.length === 0) {
    throw new Error("Empty cast file");
  }

  const header = JSON.parse(lines[0]!) as AsciicastHeader;
  const events: AsciicastEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line) {
      events.push(JSON.parse(line) as AsciicastEvent);
    }
  }

  return { header, events };
}
