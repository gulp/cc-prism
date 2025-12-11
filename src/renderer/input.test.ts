import { describe, it, expect } from "vitest";
import {
  splitIntoWords,
  generateBurstTypingSegments,
  wrapInputText,
  renderInputFrame,
  generateInputAnimation,
  type InputUIConfig,
} from "./input.js";
import { TOKYO_NIGHT } from "./theme.js";

describe("splitIntoWords", () => {
  it("splits simple text into words", () => {
    const result = splitIntoWords("Hello world");
    expect(result).toEqual(["Hello", " ", "world"]);
  });

  it("handles multiple spaces", () => {
    const result = splitIntoWords("Hello  world");
    expect(result).toEqual(["Hello", " ", " ", "world"]);
  });

  it("handles newlines", () => {
    const result = splitIntoWords("Hello\nworld");
    expect(result).toEqual(["Hello", "\n", "world"]);
  });

  it("handles empty string", () => {
    const result = splitIntoWords("");
    expect(result).toEqual([]);
  });

  it("handles single word", () => {
    const result = splitIntoWords("Hello");
    expect(result).toEqual(["Hello"]);
  });
});

describe("generateBurstTypingSegments", () => {
  it("generates segments for words", () => {
    const segments = generateBurstTypingSegments("Hello world", 0);

    // Should have segments for: Hello, space, world
    expect(segments.length).toBe(3);
    expect(segments[0].text).toBe("Hello");
    expect(segments[1].text).toBe(" ");
    expect(segments[2].text).toBe("world");
  });

  it("starts at the specified time", () => {
    const segments = generateBurstTypingSegments("Hi", 5.0);

    expect(segments[0].time).toBe(5.0);
  });

  it("applies exponential decay between words", () => {
    const config = {
      initialGapMs: 200,
      minGapMs: 50,
      decayFactor: 0.5,
    };

    const segments = generateBurstTypingSegments("A B C D", 0, config);

    // Check that gaps decrease
    const gap1 = segments[2].time - segments[0].time; // After "A" to "B"
    const gap2 = segments[4].time - segments[2].time; // After "B" to "C"

    expect(gap2).toBeLessThan(gap1);
  });

  it("respects minimum gap", () => {
    const config = {
      initialGapMs: 100,
      minGapMs: 50,
      decayFactor: 0.1, // Very aggressive decay
    };

    // Generate many words to test floor
    const segments = generateBurstTypingSegments("A B C D E F G H I J", 0, config);

    // Check that later gaps don't go below minimum (with floating point tolerance)
    const lastGap = segments[segments.length - 1].time - segments[segments.length - 3].time;
    expect(lastGap).toBeGreaterThanOrEqual(0.049); // ~50ms minimum (allowing for float precision)
  });
});

describe("wrapInputText", () => {
  const config: InputUIConfig = {
    theme: TOKYO_NIGHT,
    width: 20,
    height: 40,
    textColumn: 2,
  };

  it("wraps long lines", () => {
    const result = wrapInputText("This is a very long line that needs wrapping", config);

    expect(result.length).toBeGreaterThan(1);
  });

  it("preserves explicit line breaks", () => {
    const result = wrapInputText("Line 1\nLine 2", config);

    expect(result.length).toBe(2);
    expect(result[0]).toBe("Line 1");
    expect(result[1]).toBe("Line 2");
  });

  it("handles empty input", () => {
    const result = wrapInputText("", config);

    expect(result).toEqual([""]);
  });
});

describe("renderInputFrame", () => {
  const config: InputUIConfig = {
    theme: TOKYO_NIGHT,
    width: 20,
    height: 40,
    textColumn: 2,
  };

  it("renders horizontal lines with correct width", () => {
    const frame = renderInputFrame(config);

    // Top and bottom lines should be 20 characters (before ANSI codes)
    expect(frame.topLine).toContain("─".repeat(20));
    expect(frame.bottomLine).toContain("─".repeat(20));
  });

  it("renders arrow prompt", () => {
    const frame = renderInputFrame(config);

    expect(frame.promptPrefix).toContain("→");
  });
});

describe("generateInputAnimation", () => {
  const config: InputUIConfig = {
    theme: TOKYO_NIGHT,
    width: 80,
    height: 40,
    textColumn: 2,
  };

  it("generates segments for input animation", () => {
    const result = generateInputAnimation("Hello", 0, config);

    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);
  });

  it("generates scrollOutput with arrow prompt", () => {
    const result = generateInputAnimation("Hi", 0, config);

    // scrollOutput should contain the user prompt with arrow
    expect(result.scrollOutput).toContain("→");
    expect(result.scrollOutput).toContain("Hi");
  });

  it("uses cursor positioning", () => {
    const result = generateInputAnimation("Test", 0, config);

    // Check that output contains cursor control sequences
    const allText = result.segments.map(s => s.text).join("");

    // Should have ESC[ sequences for cursor positioning
    expect(allText).toContain("\x1b[");
  });

  it("calculates correct duration", () => {
    const result = generateInputAnimation("A few words here", 0, config);

    // Duration should be positive and reasonable
    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThan(10); // Shouldn't take more than 10s for a short phrase
  });
});
