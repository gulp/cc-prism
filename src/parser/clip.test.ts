import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractClip, getClipSummary } from "./clip.js";
import { loadTranscript, getUuid } from "./loader.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "__fixtures__");

describe("extractClip", () => {
  it("returns all entries when no options provided", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const clip = extractClip(entries);

    expect(clip.length).toBe(entries.length);
  });

  it("extracts last N messages", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const clip = extractClip(entries, { last: 3 });

    // Should return last 3 renderable messages
    expect(clip.length).toBe(3);

    // The last 3 renderable messages are: msg-007 (tool result), msg-008 (assistant), system
    // System message doesn't have UUID, so check the second-to-last
    const secondToLast = clip[clip.length - 2]!;
    expect(getUuid(secondToLast)).toBe("msg-008");
  });

  it("extracts by UUID range", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const clip = extractClip(entries, {
      startUuid: "msg-003",
      endUuid: "msg-006",
    });

    // Should include msg-003, msg-004, msg-005, msg-006
    expect(clip.length).toBe(4);
    expect(getUuid(clip[0]!)).toBe("msg-003");
    expect(getUuid(clip[clip.length - 1]!)).toBe("msg-006");
  });

  it("extracts by start UUID only", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const clip = extractClip(entries, { startUuid: "msg-005" });

    // Should include msg-005 through end (msg-005, 006, 007, 008, system)
    expect(clip.length).toBe(5);
    expect(getUuid(clip[0]!)).toBe("msg-005");
  });

  it("extracts by end UUID only", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const clip = extractClip(entries, { endUuid: "msg-003" });

    // Should include from start to msg-003
    expect(clip.length).toBe(3);
    expect(getUuid(clip[clip.length - 1]!)).toBe("msg-003");
  });

  it("extracts by time range", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const clip = extractClip(entries, {
      startTime: "2025-12-04T10:00:30.000Z",
      endTime: "2025-12-04T10:00:41.000Z",
    });

    // Should include messages within time range
    expect(clip.length).toBeGreaterThan(0);

    // All messages should be within the time range
    for (const entry of clip) {
      if ("timestamp" in entry && typeof entry.timestamp === "string") {
        const time = new Date(entry.timestamp).getTime();
        expect(time).toBeGreaterThanOrEqual(
          new Date("2025-12-04T10:00:30.000Z").getTime()
        );
        expect(time).toBeLessThanOrEqual(
          new Date("2025-12-04T10:00:41.000Z").getTime()
        );
      }
    }
  });

  it("handles last=0 gracefully", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const clip = extractClip(entries, { last: 0 });

    expect(clip.length).toBe(0);
  });
});

describe("getClipSummary", () => {
  it("calculates correct counts", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const summary = getClipSummary(entries);

    expect(summary.total).toBe(9); // Total entries including system
    expect(summary.user).toBeGreaterThan(0); // User prompts
    expect(summary.assistant).toBeGreaterThan(0); // Assistant responses
    expect(summary.tools).toBeGreaterThan(0); // Tool results
  });

  it("calculates time range", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const summary = getClipSummary(entries);

    expect(summary.startTime).toBeInstanceOf(Date);
    expect(summary.endTime).toBeInstanceOf(Date);
    expect(summary.endTime!.getTime()).toBeGreaterThan(
      summary.startTime!.getTime()
    );
  });
});
