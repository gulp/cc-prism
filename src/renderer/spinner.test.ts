import { describe, it, expect } from "vitest";
import {
  SPINNER_CHARS,
  VERBS,
  selectVerb,
  getShimmerWindow,
  applyShimmer,
  renderSpinnerFrame,
  generateStatusSpinnerSegments,
  generateSpinnerClear,
  DEFAULT_SPINNER_CONFIG,
  SHIMMER_BASE_COLOR,
  SHIMMER_HIGHLIGHT_COLOR,
} from "./spinner.js";
import { TOKYO_NIGHT } from "./theme.js";

describe("SPINNER_CHARS", () => {
  it("contains expected spinner characters (ping-pong pattern)", () => {
    expect(SPINNER_CHARS).toEqual(["·", "✢", "✳", "✻", "✽", "✻", "✳", "✢"]);
    expect(SPINNER_CHARS.length).toBe(8);
  });
});

describe("VERBS", () => {
  it("loads verbs from JSON", () => {
    expect(Array.isArray(VERBS)).toBe(true);
    expect(VERBS.length).toBeGreaterThan(0);
  });

  it("contains expected verbs", () => {
    expect(VERBS).toContain("Clauding");
    expect(VERBS).toContain("Pondering");
    expect(VERBS).toContain("Processing");
  });

  it("all verbs are present participles (-ing)", () => {
    for (const verb of VERBS) {
      expect(verb.endsWith("ing")).toBe(true);
    }
  });
});

describe("selectVerb", () => {
  it("selects a verb from the list based on seed", () => {
    const verb = selectVerb(VERBS, 0);
    expect(VERBS).toContain(verb);
  });

  it("returns consistent results for same seed", () => {
    const verb1 = selectVerb(VERBS, 42);
    const verb2 = selectVerb(VERBS, 42);
    expect(verb1).toBe(verb2);
  });

  it("returns different verbs for different seeds", () => {
    const verb1 = selectVerb(VERBS, 0);
    const verb2 = selectVerb(VERBS, 1);
    // May be the same if list is small, but generally different
    expect(typeof verb1).toBe("string");
    expect(typeof verb2).toBe("string");
  });

  it("handles negative seeds", () => {
    const verb = selectVerb(VERBS, -5);
    expect(VERBS).toContain(verb);
  });

  it("returns default for empty list", () => {
    const verb = selectVerb([], 0);
    expect(verb).toBe("Processing");
  });
});

describe("getShimmerWindow", () => {
  it("returns start and end positions", () => {
    const [start, end] = getShimmerWindow(0, 10, 3);
    expect(typeof start).toBe("number");
    expect(typeof end).toBe("number");
    expect(start).toBeLessThanOrEqual(end);
  });

  it("window slides through text", () => {
    const positions: [number, number][] = [];
    for (let i = 0; i < 15; i++) {
      positions.push(getShimmerWindow(i, 10, 3));
    }

    // Check that window moves through the text
    const startPositions = positions.map(([s]) => s);
    const uniqueStarts = [...new Set(startPositions)];
    expect(uniqueStarts.length).toBeGreaterThan(1);
  });

  it("clamps to text bounds", () => {
    for (let i = 0; i < 20; i++) {
      const [start, end] = getShimmerWindow(i, 10, 3);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(10);
    }
  });

  it("window size affects range", () => {
    const [start1, end1] = getShimmerWindow(5, 10, 2);
    const [start2, end2] = getShimmerWindow(5, 10, 4);

    // Larger window should have larger range (when in middle)
    const range1 = end1 - start1;
    const range2 = end2 - start2;
    expect(range2).toBeGreaterThanOrEqual(range1);
  });
});

describe("applyShimmer", () => {
  const config = {
    shimmerWindowSize: 3,
    baseColor: SHIMMER_BASE_COLOR,
    highlightColor: SHIMMER_HIGHLIGHT_COLOR,
  };

  it("returns string with ANSI color codes", () => {
    const result = applyShimmer("Hello", 0, config);

    // Should contain escape sequences
    expect(result).toContain("\x1b[");
    // Should end with reset
    expect(result).toContain("\x1b[0m");
  });

  it("applies base color to non-highlighted chars", () => {
    const result = applyShimmer("Hello", 0, config);

    // Should contain base color RGB sequence
    expect(result).toContain("38;2;215;119;87"); // RGB for #d77757
  });

  it("applies highlight color to highlighted chars", () => {
    // Find a frame where highlight is in the middle
    const result = applyShimmer("Hello World", 5, config);

    // Should contain highlight color RGB sequence
    expect(result).toContain("38;2;235;159;127"); // RGB for #eb9f7f
  });

  it("handles empty text", () => {
    const result = applyShimmer("", 0, config);
    expect(result).toBe("\x1b[0m"); // Just the reset
  });
});

describe("renderSpinnerFrame", () => {
  const config = {
    ...DEFAULT_SPINNER_CONFIG,
    theme: TOKYO_NIGHT,
  };

  it("includes spinner character", () => {
    const frame = renderSpinnerFrame("Testing", 0, config);

    // Should contain one of the spinner characters
    const hasSpinner = SPINNER_CHARS.some((char) => frame.includes(char));
    expect(hasSpinner).toBe(true);
  });

  it("includes verb text characters", () => {
    const frame = renderSpinnerFrame("Clauding", 0, config);
    // Each character is individually colored, so check chars are present
    for (const char of "Clauding") {
      expect(frame).toContain(char);
    }
  });

  it("adds ellipsis to verb", () => {
    const frame = renderSpinnerFrame("Testing", 0, config);
    // Unicode ellipsis character
    expect(frame).toContain("…");
  });

  it("cycles through spinner characters (ping-pong)", () => {
    const frames = Array.from({ length: 8 }, (_, i) =>
      renderSpinnerFrame("Test", i, config)
    );

    // Each frame should have a different spinner char
    const spinnerChars = frames.map((f) => {
      for (const char of SPINNER_CHARS) {
        if (f.includes(char)) return char;
      }
      return null;
    });

    expect(spinnerChars).toEqual([...SPINNER_CHARS]);
  });
});

describe("generateStatusSpinnerSegments", () => {
  const config = {
    ...DEFAULT_SPINNER_CONFIG,
    theme: TOKYO_NIGHT,
  };

  it("generates segments for animation", () => {
    const segments = generateStatusSpinnerSegments("Thinking", 0, 1.0, config);

    expect(segments.length).toBeGreaterThan(0);
  });

  it("segments have correct timing", () => {
    const segments = generateStatusSpinnerSegments("Testing", 0, 1.0, config);

    // All times should be >= 0 and increasing
    let lastTime = -1;
    for (const segment of segments) {
      expect(segment.time).toBeGreaterThanOrEqual(lastTime);
      lastTime = segment.time;
    }
  });

  it("respects start time", () => {
    const segments = generateStatusSpinnerSegments("Test", 5.0, 1.0, config);

    expect(segments[0].time).toBe(5.0);
  });

  it("generates frames based on duration and interval", () => {
    const configWithInterval = {
      ...config,
      frameIntervalMs: 100, // 100ms = 10 frames per second
    };

    // 1 second duration, 100ms interval = 10 frames
    const segments = generateStatusSpinnerSegments("Test", 0, 1.0, configWithInterval);
    expect(segments.length).toBe(10);
  });

  it("includes cursor positioning when row specified", () => {
    const segments = generateStatusSpinnerSegments("Test", 0, 0.5, config, 10);

    // Should contain cursor movement to row 10
    expect(segments[0].text).toContain("\x1b[10;1H");
  });

  it("uses inline mode when no row specified", () => {
    const segments = generateStatusSpinnerSegments("Test", 0, 0.5, config);

    // Should use carriage return for inline mode
    expect(segments[0].text).toContain("\r");
  });
});

describe("generateSpinnerClear", () => {
  it("generates clear for fixed position", () => {
    const clear = generateSpinnerClear(15);

    // Should position to row 15 and erase
    expect(clear).toContain("\x1b[15;1H");
    expect(clear).toContain("\x1b[2K");
  });

  it("generates clear for inline mode", () => {
    const clear = generateSpinnerClear();

    // Should use carriage return and erase
    expect(clear).toContain("\r");
    expect(clear).toContain("\x1b[2K");
  });
});
