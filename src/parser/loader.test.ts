import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseLine,
  loadTranscript,
  sortByTimestamp,
  getTimestamp,
  getUuid,
} from "./loader.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "__fixtures__");

describe("parseLine", () => {
  it("parses valid user message JSON", () => {
    const line = `{"type":"user","timestamp":"2025-12-04T10:00:00.000Z","sessionId":"test","uuid":"msg-001","parentUuid":null,"userType":"human","cwd":"/home","message":{"role":"user","content":"Hello"}}`;
    const result = parseLine(line);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("user");
    if (result?.type === "user") {
      expect(result.uuid).toBe("msg-001");
      expect(result.message.content).toBe("Hello");
    }
  });

  it("parses valid assistant message JSON", () => {
    const line = `{"type":"assistant","timestamp":"2025-12-04T10:00:05.000Z","sessionId":"test","uuid":"msg-002","parentUuid":"msg-001","message":{"id":"m1","type":"message","role":"assistant","model":"claude","content":[{"type":"text","text":"Hi!"}],"stop_reason":"end_turn"}}`;
    const result = parseLine(line);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("assistant");
    if (result?.type === "assistant") {
      expect(result.message.content).toHaveLength(1);
      expect(result.message.content[0]?.type).toBe("text");
    }
  });

  it("returns null for empty lines", () => {
    expect(parseLine("")).toBeNull();
    expect(parseLine("   ")).toBeNull();
    expect(parseLine("\n")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseLine("not json")).toBeNull();
    expect(parseLine("{invalid}")).toBeNull();
  });
});

describe("loadTranscript", () => {
  it("loads a simple session file", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));

    expect(entries.length).toBeGreaterThan(0);

    // First entry should be a user message
    const first = entries[0];
    expect(first?.type).toBe("user");

    // Should have both user and assistant messages
    const types = entries.map((e) => e.type);
    expect(types).toContain("user");
    expect(types).toContain("assistant");
    expect(types).toContain("system");
  });

  it("loads agent files when agentId is present", async () => {
    const entries = await loadTranscript(
      join(fixturesDir, "with-agent-ref.jsonl"),
      { loadAgents: true }
    );

    // Should include entries from both main session and agent file
    // Main session has 4 entries, agent file has 2
    expect(entries.length).toBe(6);

    // Check that agent entries are marked as sidechain
    const agentEntries = entries.filter(
      (e) => "isSidechain" in e && e.isSidechain
    );
    expect(agentEntries.length).toBeGreaterThan(0);
  });

  it("can skip loading agent files", async () => {
    const entries = await loadTranscript(
      join(fixturesDir, "with-agent-ref.jsonl"),
      { loadAgents: false }
    );

    // Should only have main session entries
    expect(entries.length).toBe(4);
  });
});

describe("sortByTimestamp", () => {
  it("sorts entries by timestamp", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const sorted = sortByTimestamp(entries);

    for (let i = 1; i < sorted.length; i++) {
      const prevTime = getTimestamp(sorted[i - 1]!)?.getTime() ?? 0;
      const currTime = getTimestamp(sorted[i]!)?.getTime() ?? 0;
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });
});

describe("getTimestamp", () => {
  it("returns Date for entries with timestamp", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const first = entries[0]!;
    const timestamp = getTimestamp(first);

    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp?.toISOString()).toBe("2025-12-04T10:00:00.000Z");
  });
});

describe("getUuid", () => {
  it("returns UUID for entries with uuid field", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const first = entries[0]!;
    const uuid = getUuid(first);

    expect(uuid).toBe("msg-001");
  });
});
