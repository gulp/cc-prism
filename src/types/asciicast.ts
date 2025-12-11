/**
 * asciicast v3 format types
 * Spec: https://docs.asciinema.org/manual/asciicast/v3/
 */

// =============================================================================
// Theme Configuration
// =============================================================================

export interface AsciicastTheme {
  fg: string;
  bg: string;
  palette: string; // Colon-separated 16 colors (ANSI 0-15)
}

/** Built-in theme presets */
export const THEMES: Record<string, AsciicastTheme> = {
  "tokyo-night": {
    fg: "#a9b1d6",
    bg: "#1a1b26",
    palette:
      "#15161e:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#a9b1d6:#414868:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#c0caf5",
  },
  "tokyo-storm": {
    fg: "#a9b1d6",
    bg: "#24283b",
    palette:
      "#1d202f:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#a9b1d6:#414868:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#c0caf5",
  },
  dracula: {
    fg: "#f8f8f2",
    bg: "#282a36",
    palette:
      "#21222c:#ff5555:#50fa7b:#f1fa8c:#bd93f9:#ff79c6:#8be9fd:#f8f8f2:#6272a4:#ff6e6e:#69ff94:#ffffa5:#d6acff:#ff92df:#a4ffff:#ffffff",
  },
  nord: {
    fg: "#d8dee9",
    bg: "#2e3440",
    palette:
      "#3b4252:#bf616a:#a3be8c:#ebcb8b:#81a1c1:#b48ead:#88c0d0:#e5e9f0:#4c566a:#bf616a:#a3be8c:#ebcb8b:#81a1c1:#b48ead:#8fbcbb:#eceff4",
  },
  "catppuccin-mocha": {
    fg: "#cdd6f4",
    bg: "#1e1e2e",
    palette:
      "#45475a:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#bac2de:#585b70:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#a6adc8",
  },
};

// =============================================================================
// Semantic Colors (for rendering)
// =============================================================================

export interface SemanticColors {
  userPrompt: string;
  assistantText: string;
  toolName: string;
  toolBulletSuccess: string;
  toolBulletError: string;
  thinking: string;
  boxDrawing: string;
  filePath: string;
}

export const TOKYO_NIGHT_SEMANTIC: SemanticColors = {
  userPrompt: "#7aa2f7", // Blue
  assistantText: "#a9b1d6", // Foreground
  toolName: "#e0af68", // Yellow
  toolBulletSuccess: "#9ece6a", // Green
  toolBulletError: "#f7768e", // Red
  thinking: "#565f89", // Comment
  boxDrawing: "#414868", // Bright black
  filePath: "#7dcfff", // Cyan
};

// =============================================================================
// asciicast v3 Header
// =============================================================================

export interface AsciicastHeader {
  version: 3;
  term: {
    cols: number;
    rows: number;
    type?: string;
    theme?: AsciicastTheme;
  };
  timestamp?: number;
  title?: string;
  env?: Record<string, string>;
}

// =============================================================================
// asciicast v3 Events
// =============================================================================

/** Output event - ANSI-encoded text */
export type OutputEvent = [number, "o", string];

/** Marker event - navigation point */
export type MarkerEvent = [number, "m", string];

/** Resize event - terminal dimension change */
export type ResizeEvent = [number, "r", string]; // "cols x rows"

export type AsciicastEvent = OutputEvent | MarkerEvent | ResizeEvent;

// =============================================================================
// Complete asciicast Document
// =============================================================================

export interface AsciicastDocument {
  header: AsciicastHeader;
  events: AsciicastEvent[];
}

// =============================================================================
// Timing Presets
// =============================================================================

export interface TimingConfig {
  /** Maximum pause between events (seconds) */
  maxWait: number;
  /** Pause before assistant response (seconds) */
  thinkingPause: number;
  /** Enable character-by-character typing effect */
  typingEffect: boolean;
  /** Characters per second when typing effect is enabled */
  typingSpeed: number;
}

export const TIMING_PRESETS: Record<string, TimingConfig> = {
  speedrun: {
    maxWait: 2,
    thinkingPause: 0.3,
    typingEffect: false,
    typingSpeed: 80,
  },
  default: {
    maxWait: 3,
    thinkingPause: 0.8,
    typingEffect: true,
    typingSpeed: 60,
  },
  realtime: {
    maxWait: Infinity,
    thinkingPause: 0,
    typingEffect: false,
    typingSpeed: 0,
  },
};

// =============================================================================
// Marker Configuration
// =============================================================================

export type MarkerMode = "all" | "user" | "tools" | "none";

export interface MarkerConfig {
  mode: MarkerMode;
  labelLength: number;
  pauseOnMarkers: boolean;
}

export const DEFAULT_MARKER_CONFIG: MarkerConfig = {
  mode: "all",
  labelLength: 30,
  pauseOnMarkers: false,
};
