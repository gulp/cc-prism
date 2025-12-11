import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTranscript } from "../parser/loader.js";
import { AsciicastBuilder, serializeCast, parseCast } from "./builder.js";
import { TimingCalculator, resolveTimingConfig, generateTypingSegments } from "./timing.js";
import { shouldHaveMarker, generateMarkerLabel } from "./markers.js";
import { convertToAsciicast, convertWithPreset, getSessionInfo } from "./convert.js";
import { THEMES } from "../types/asciicast.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "../parser/__fixtures__");

describe("AsciicastBuilder", () => {
  it("creates header with correct version", () => {
    const builder = new AsciicastBuilder();
    const doc = builder.build();

    expect(doc.header.version).toBe(3);
    expect(doc.header.term.cols).toBe(100);
    expect(doc.header.term.rows).toBe(40);
  });

  it("respects custom configuration", () => {
    const builder = new AsciicastBuilder({
      cols: 120,
      rows: 50,
      title: "Test Recording",
      theme: THEMES["dracula"]!,
    });
    const doc = builder.build();

    expect(doc.header.term.cols).toBe(120);
    expect(doc.header.term.rows).toBe(50);
    expect(doc.header.title).toBe("Test Recording");
    expect(doc.header.term.theme?.bg).toBe("#282a36");
  });

  it("adds output events", () => {
    const builder = new AsciicastBuilder();
    builder.output("Hello");
    builder.outputLine("World");

    const doc = builder.build();
    expect(doc.events).toHaveLength(2);
    expect(doc.events[0]).toEqual([0, "o", "Hello"]);
    expect(doc.events[1]).toEqual([0, "o", "World\n"]);
  });

  it("tracks time correctly with intervals", () => {
    const builder = new AsciicastBuilder();
    builder.output("First");
    builder.addTime(1.5);
    builder.output("Second");
    builder.addTime(0.5);
    builder.output("Third");

    const doc = builder.build();
    // asciicast v3 uses relative time (intervals since previous event)
    expect(doc.events[0]![0]).toBe(0);   // First event: 0s since start
    expect(doc.events[1]![0]).toBe(1.5); // Second: 1.5s interval
    expect(doc.events[2]![0]).toBe(0.5); // Third: 0.5s interval
  });

  it("adds markers", () => {
    const builder = new AsciicastBuilder();
    builder.marker("Start");
    builder.addTime(1);
    builder.outputWithMarker("Content", "Middle");

    const doc = builder.build();
    const markers = doc.events.filter((e) => e[1] === "m");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toEqual([0, "m", "Start"]);
    expect(markers[1]).toEqual([1, "m", "Middle"]);
  });
});

describe("serializeCast / parseCast", () => {
  it("serializes and parses roundtrip", () => {
    const builder = new AsciicastBuilder({ title: "Test" });
    builder.output("Line 1\n");
    builder.addTime(0.5);
    builder.marker("Point A");
    builder.output("Line 2\n");

    const original = builder.build();
    const serialized = serializeCast(original);
    const parsed = parseCast(serialized);

    expect(parsed.header.version).toBe(original.header.version);
    expect(parsed.header.title).toBe(original.header.title);
    expect(parsed.events).toEqual(original.events);
  });

  it("produces valid NDJSON format", () => {
    const builder = new AsciicastBuilder();
    builder.output("Test\n");
    const serialized = serializeCast(builder.build());

    const lines = serialized.trim().split("\n");
    expect(lines.length).toBe(2); // header + 1 event

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe("TimingCalculator", () => {
  it("uses default preset by default", () => {
    const config = resolveTimingConfig({});
    expect(config.maxWait).toBe(3);
    expect(config.thinkingPause).toBe(0.8);
    expect(config.typingEffect).toBe(true);
  });

  it("uses speedrun preset settings", () => {
    const config = resolveTimingConfig({ preset: "speedrun" });
    expect(config.maxWait).toBe(2);
    expect(config.thinkingPause).toBe(0.3);
    expect(config.typingEffect).toBe(false);
    expect(config.typingSpeed).toBe(80);
  });

  it("allows preset overrides", () => {
    const config = resolveTimingConfig({
      preset: "speedrun",
      maxWait: 5,
    });
    expect(config.maxWait).toBe(5);
    expect(config.thinkingPause).toBe(0.3); // from preset
  });

  it("caps wait time at maxWait", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const config = resolveTimingConfig({ preset: "speedrun" });
    const calc = new TimingCalculator(config);

    let maxDelta = 0;
    let prevTime = 0;

    for (const entry of entries) {
      const time = calc.nextEntry(entry);
      const delta = time - prevTime;
      if (delta > maxDelta) maxDelta = delta;
      prevTime = time;
    }

    expect(maxDelta).toBeLessThanOrEqual(config.maxWait + config.thinkingPause);
  });
});

describe("generateTypingSegments", () => {
  it("splits text into typed chunks", () => {
    const segments = generateTypingSegments("Hello", 0, 10, 2);

    expect(segments.length).toBe(3); // "He", "ll", "o"
    expect(segments[0]?.text).toBe("He");
    expect(segments[1]?.text).toBe("ll");
    expect(segments[2]?.text).toBe("o");
  });

  it("calculates timing based on speed", () => {
    const segments = generateTypingSegments("Test", 1.0, 10, 1);

    // 10 chars/sec = 0.1s per char
    expect(segments[0]?.time).toBe(1.0);
    expect(segments[1]?.time).toBeCloseTo(1.1);
    expect(segments[2]?.time).toBeCloseTo(1.2);
    expect(segments[3]?.time).toBeCloseTo(1.3);
  });
});

describe("markers", () => {
  it("generates marker for user prompts", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const userMsg = entries.find(
      (e) => e.type === "user" && !("toolUseResult" in e && e.toolUseResult)
    );

    expect(userMsg).toBeDefined();
    expect(shouldHaveMarker(userMsg!, "all")).toBe(true);
    expect(shouldHaveMarker(userMsg!, "user")).toBe(true);
    expect(shouldHaveMarker(userMsg!, "tools")).toBe(false);
    expect(shouldHaveMarker(userMsg!, "none")).toBe(false);

    const label = generateMarkerLabel(userMsg!);
    expect(label).toContain(">");
    expect(label).toContain("Hello");
  });

  it("generates marker for tool calls", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const toolMsg = entries.find(
      (e) =>
        e.type === "assistant" &&
        e.message.content.some((c) => c.type === "tool_use")
    );

    expect(toolMsg).toBeDefined();
    expect(shouldHaveMarker(toolMsg!, "all")).toBe(true);
    expect(shouldHaveMarker(toolMsg!, "tools")).toBe(true);

    const label = generateMarkerLabel(toolMsg!);
    expect(label).toContain("●");
    expect(label).toContain("Read");
  });
});

describe("convertToAsciicast", () => {
  it("converts session to asciicast document", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const result = convertToAsciicast(entries);

    expect(result.document.header.version).toBe(3);
    expect(result.document.events.length).toBeGreaterThan(0);
    expect(result.stats.entriesProcessed).toBe(entries.length);
    expect(result.stats.entriesRendered).toBeGreaterThan(0);
  });

  it("includes markers in output", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const result = convertToAsciicast(entries, {
      markers: { mode: "all" },
    });

    const markers = result.document.events.filter((e) => e[1] === "m");
    expect(markers.length).toBeGreaterThan(0);
    expect(result.stats.markersGenerated).toBe(markers.length);
  });

  it("respects marker mode none", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const result = convertToAsciicast(entries, {
      markers: { mode: "none" },
    });

    const markers = result.document.events.filter((e) => e[1] === "m");
    expect(markers.length).toBe(0);
  });

  it("embeds theme in header", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const result = convertToAsciicast(entries);

    expect(result.document.header.term.theme).toBeDefined();
    expect(result.document.header.term.theme?.fg).toBe("#a9b1d6");
    expect(result.document.header.term.theme?.bg).toBe("#1a1b26");
  });
});

describe("convertWithPreset", () => {
  it("uses specified preset", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));

    const speedrunResult = convertWithPreset(entries, "speedrun");
    const defaultResult = convertWithPreset(entries, "default");

    // Default should have longer duration due to slower timing
    expect(defaultResult.stats.duration).toBeGreaterThan(
      speedrunResult.stats.duration
    );
  });
});

describe("getSessionInfo", () => {
  it("extracts session information", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const info = getSessionInfo(entries);

    expect(info.userMessages).toBeGreaterThan(0);
    expect(info.assistantMessages).toBeGreaterThan(0);
    expect(info.toolCalls).toBeGreaterThan(0);
    expect(info.startTime).toBeInstanceOf(Date);
    expect(info.endTime).toBeInstanceOf(Date);
  });
});

describe("verb throttling", () => {
  it("enables spinner and renders with throttled verbs", async () => {
    // Use real fixture which has multiple prompts
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));

    const result = convertToAsciicast(entries, {
      statusSpinner: true,
    });

    // Should have rendered entries with spinner enabled
    expect(result.stats.entriesRendered).toBeGreaterThan(0);

    // Spinner outputs contain ANSI escape codes with shimmer
    // The spinner characters are ·✢✳✻✽
    const outputTexts = result.document.events
      .filter((e) => e[1] === "o")
      .map((e) => e[2] as string)
      .join("");

    // Should contain spinner characters
    expect(outputTexts).toMatch(/[·✢✳✻✽]/);
  });

  it("maintains deterministic output with spinner enabled", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));

    // Run conversion twice with same entries
    const result1 = convertToAsciicast(entries, { statusSpinner: true });
    const result2 = convertToAsciicast(entries, { statusSpinner: true });

    // Output should be identical (deterministic)
    expect(serializeCast(result1.document)).toBe(serializeCast(result2.document));
  });

  it("produces consistent output across multiple runs", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));

    // Run 3 times and compare
    const results = [
      convertToAsciicast(entries, { statusSpinner: true }),
      convertToAsciicast(entries, { statusSpinner: true }),
      convertToAsciicast(entries, { statusSpinner: true }),
    ];

    // All outputs should be identical
    const serialized = results.map((r) => serializeCast(r.document));
    expect(serialized[0]).toBe(serialized[1]);
    expect(serialized[1]).toBe(serialized[2]);
  });
});
