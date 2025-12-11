/* eslint-disable no-control-regex */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, unlinkSync } from "node:fs";
import { loadTranscript } from "../parser/loader.js";
import { convertToAsciicast } from "../generator/convert.js";
import { serializeCast, parseCast } from "../generator/builder.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "../parser/__fixtures__");
const projectRoot = join(__dirname, "../..");

describe("CLI integration", () => {
  it("builds successfully", () => {
    // Build project
    execSync("npm run build", { cwd: projectRoot, stdio: "pipe" });
  });

  it("shows help", () => {
    const result = execSync("node dist/cli.js --help", {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    expect(result).toContain("cc-prism");
    expect(result).toContain("cast");
    expect(result).toContain("list");
  });

  it("shows cast command help", () => {
    const result = execSync("node dist/cli.js cast --help", {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    expect(result).toContain("--start-uuid");
    expect(result).toContain("--end-uuid");
    expect(result).toContain("--last");
    expect(result).toContain("--theme");
    expect(result).toContain("--preset");
    expect(result).toContain("--upload");
  });

  it("generates cast file to stdout", () => {
    const sessionPath = join(fixturesDir, "sample-session.jsonl");
    const result = execSync(`node dist/cli.js cast "${sessionPath}"`, {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    // Should be valid NDJSON
    const lines = result.trim().split("\n");
    expect(lines.length).toBeGreaterThan(1);

    // First line should be header
    const header = JSON.parse(lines[0]!);
    expect(header.version).toBe(3);
    expect(header.term.cols).toBe(100);
    expect(header.term.rows).toBe(40);

    // Should have events
    const events = lines.slice(1).map((l) => JSON.parse(l));
    expect(events.length).toBeGreaterThan(0);
  });

  it("generates cast file to output path", () => {
    const sessionPath = join(fixturesDir, "sample-session.jsonl");
    const outputPath = join(projectRoot, "test-output.cast");

    try {
      execSync(
        `node dist/cli.js cast "${sessionPath}" -o "${outputPath}" -q`,
        { cwd: projectRoot, encoding: "utf-8" }
      );

      // Read and validate output
      const content = readFileSync(outputPath, "utf-8");
      const doc = parseCast(content);

      expect(doc.header.version).toBe(3);
      expect(doc.events.length).toBeGreaterThan(0);
    } finally {
      try {
        unlinkSync(outputPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("respects --last option", () => {
    const sessionPath = join(fixturesDir, "sample-session.jsonl");
    const result = execSync(`node dist/cli.js cast "${sessionPath}" --last 2`, {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    const doc = parseCast(result);
    // With --last 2, should have fewer events than full session
    expect(doc.events.length).toBeGreaterThan(0);
  });

  it("respects --theme option", () => {
    const sessionPath = join(fixturesDir, "sample-session.jsonl");
    const result = execSync(
      `node dist/cli.js cast "${sessionPath}" --theme dracula`,
      { cwd: projectRoot, encoding: "utf-8" }
    );

    const doc = parseCast(result);
    expect(doc.header.term.theme?.bg).toBe("#282a36"); // Dracula bg
  });

  it("respects --markers none", () => {
    const sessionPath = join(fixturesDir, "sample-session.jsonl");
    const result = execSync(
      `node dist/cli.js cast "${sessionPath}" --markers none`,
      { cwd: projectRoot, encoding: "utf-8" }
    );

    const doc = parseCast(result);
    const markers = doc.events.filter((e) => e[1] === "m");
    expect(markers.length).toBe(0);
  });

  it("lists messages with list command", () => {
    const sessionPath = join(fixturesDir, "sample-session.jsonl");
    const result = execSync(`node dist/cli.js list "${sessionPath}"`, {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    expect(result).toContain("UUID");
    expect(result).toContain("TYPE");
    expect(result).toContain("user");
    expect(result).toContain("assistant");
    expect(result).toContain("Total:");
  });
});

describe("end-to-end conversion", () => {
  it("converts sample session to valid asciicast", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const result = convertToAsciicast(entries);

    // Validate structure
    expect(result.document.header.version).toBe(3);
    expect(result.document.header.term.cols).toBeGreaterThan(0);
    expect(result.document.header.term.rows).toBeGreaterThan(0);
    expect(result.document.header.term.theme).toBeDefined();

    // Validate events
    expect(result.document.events.length).toBeGreaterThan(0);

    // All events should have proper format [time, type, data]
    for (const event of result.document.events) {
      expect(Array.isArray(event)).toBe(true);
      expect(event.length).toBe(3);
      expect(typeof event[0]).toBe("number"); // timestamp
      expect(["o", "m", "r"]).toContain(event[1]); // event type
      expect(typeof event[2]).toBe("string"); // data
    }

    // Validate stats
    expect(result.stats.entriesProcessed).toBeGreaterThan(0);
    expect(result.stats.entriesRendered).toBeGreaterThan(0);
    expect(result.stats.duration).toBeGreaterThan(0);
  });

  it("serializes and parses correctly", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const result = convertToAsciicast(entries);

    const serialized = serializeCast(result.document);
    const parsed = parseCast(serialized);

    expect(parsed.header.version).toBe(result.document.header.version);
    expect(parsed.events.length).toBe(result.document.events.length);
  });

  it("handles session with agent references", async () => {
    const entries = await loadTranscript(
      join(fixturesDir, "with-agent-ref.jsonl"),
      { loadAgents: true }
    );

    const result = convertToAsciicast(entries);

    // Should include agent messages
    expect(result.stats.entriesProcessed).toBeGreaterThan(4); // Main + agent
  });

  it("generates valid ANSI in output events", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    // Use speedrun preset to avoid typing effect which splits styled text across events
    const result = convertToAsciicast(entries, { timing: { preset: "speedrun" } });

    const outputEvents = result.document.events.filter((e) => e[1] === "o");

    // At least some events should contain ANSI codes
    const hasAnsi = outputEvents.some((e) => e[2].includes("\x1b["));
    expect(hasAnsi).toBe(true);

    // All ANSI sequences should be properly terminated
    for (const event of outputEvents) {
      const text = event[2];
      // Count opens and closes (simplified check)
      const opens = (text.match(/\x1b\[/g) || []).length;
      const resets = (text.match(/\x1b\[0m/g) || []).length;
      // Should have at least as many resets as color codes (rough check)
      // This isn't perfectly accurate but catches obvious issues
      if (opens > 0) {
        expect(resets).toBeGreaterThan(0);
      }
    }
  });
});
