/* eslint-disable no-control-regex */
import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTranscript } from "../parser/loader.js";
import { renderMessage } from "./messages.js";
import { stripAnsi } from "./ansi.js";
import { TOKYO_NIGHT } from "./theme.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "../parser/__fixtures__");

describe("renderMessage", () => {
  it("renders user prompt with arrow prefix", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const userMsg = entries.find((e) => e.type === "user" && !("toolUseResult" in e && e.toolUseResult));

    expect(userMsg).toBeDefined();
    const output = renderMessage(userMsg!, { theme: TOKYO_NIGHT });

    // Should contain arrow prefix (stripped of ANSI)
    expect(stripAnsi(output)).toContain("→");
    // Should contain user's text
    expect(stripAnsi(output)).toContain("Hello");
  });

  it("renders assistant text message", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const assistantMsg = entries.find((e) => e.type === "assistant");

    expect(assistantMsg).toBeDefined();
    const output = renderMessage(assistantMsg!, { theme: TOKYO_NIGHT });

    // Should contain assistant's response
    expect(stripAnsi(output)).toContain("happy to help");
  });

  it("renders tool use with bullet and tool name", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    // Find assistant message with tool_use
    const toolMsg = entries.find(
      (e) =>
        e.type === "assistant" &&
        e.message.content.some((c) => c.type === "tool_use")
    );

    expect(toolMsg).toBeDefined();
    const output = renderMessage(toolMsg!, { theme: TOKYO_NIGHT });

    // Should contain bullet
    expect(stripAnsi(output)).toContain("●");
    // Should contain tool name
    expect(stripAnsi(output)).toContain("Read");
  });

  it("renders thinking blocks when enabled", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const thinkingMsg = entries.find(
      (e) =>
        e.type === "assistant" &&
        e.message.content.some((c) => c.type === "thinking")
    );

    expect(thinkingMsg).toBeDefined();

    // With thinking enabled - should include "check" from thinking block
    const withThinking = renderMessage(thinkingMsg!, {
      theme: TOKYO_NIGHT,
      showThinking: true,
    });
    expect(stripAnsi(withThinking)).toContain("check the startup");

    // With thinking disabled - should NOT include "check" (only in thinking)
    const withoutThinking = renderMessage(thinkingMsg!, {
      theme: TOKYO_NIGHT,
      showThinking: false,
    });
    expect(stripAnsi(withoutThinking)).not.toContain("check the startup");
    // But should still have text content
    expect(stripAnsi(withoutThinking)).toContain("look at your startup");
  });

  it("renders tool result", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const toolResultMsg = entries.find(
      (e) => e.type === "user" && "toolUseResult" in e && e.toolUseResult
    );

    expect(toolResultMsg).toBeDefined();
    const output = renderMessage(toolResultMsg!, { theme: TOKYO_NIGHT });

    // Should contain indented tool output
    expect(stripAnsi(output)).toContain("export function main");
  });

  it("renders system message", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const systemMsg = entries.find((e) => e.type === "system");

    expect(systemMsg).toBeDefined();
    const output = renderMessage(systemMsg!, { theme: TOKYO_NIGHT });

    // Should contain system message content
    expect(stripAnsi(output)).toContain("Session auto-saved");
  });

  it("returns empty string for summary messages", async () => {
    const summaryEntry = {
      type: "summary" as const,
      summary: "Test summary",
      leafUuid: "test-uuid",
    };

    const output = renderMessage(summaryEntry, { theme: TOKYO_NIGHT });
    expect(output).toBe("");
  });

  it("returns empty string for file-history-snapshot", async () => {
    const snapshotEntry = {
      type: "file-history-snapshot" as const,
      files: [],
    };

    const output = renderMessage(snapshotEntry, { theme: TOKYO_NIGHT });
    expect(output).toBe("");
  });

  it("renders empty tool result with bullet only", () => {
    const emptyToolResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {},
    };

    const output = renderMessage(emptyToolResult, { theme: TOKYO_NIGHT });

    // Should show tree connector with checkmark (no content placeholder)
    expect(stripAnsi(output)).toContain("⎿");
    expect(stripAnsi(output)).toContain("✓");
    expect(output.length).toBeGreaterThan(0);
  });

  it("renders tool result with stdout/stderr format", () => {
    const bashToolResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        stdout: "command output here",
        stderr: "",
      },
    };

    const output = renderMessage(bashToolResult, { theme: TOKYO_NIGHT });

    // Should contain the stdout content
    expect(stripAnsi(output)).toContain("command output here");
  });

  it("renders truncation indicator with Claude Code format", () => {
    // Generate 10 lines of output (default maxToolOutputLines is 5)
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n");
    const bashToolResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        stdout: lines,
        stderr: "",
      },
    };

    const output = renderMessage(bashToolResult, { theme: TOKYO_NIGHT });
    const plainOutput = stripAnsi(output);

    // Should show truncation indicator with Claude Code format
    expect(plainOutput).toContain("… +");
    expect(plainOutput).toContain("lines (ctrl+o to expand)");
    // Should NOT use old format
    expect(plainOutput).not.toContain("... (");
    expect(plainOutput).not.toContain("more lines)");
  });

  it("wraps long lines before counting for truncation", () => {
    // Generate 3 very long lines that will wrap at width 100
    const longLine = "x".repeat(150); // Will wrap to 2 lines at width ~98 (100 - 2 indent)
    const content = `${longLine}\n${longLine}\n${longLine}`;
    const bashToolResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        stdout: content,
        stderr: "",
      },
    };

    const output = renderMessage(bashToolResult, { theme: TOKYO_NIGHT, width: 100 });
    const plainOutput = stripAnsi(output);

    // Long lines should wrap and then truncate
    // Verify wrapping occurred (lines should be <= 98 chars, not 150)
    const outputLines = plainOutput.split("\n");
    const contentLines = outputLines.filter(l => l.includes("x"));
    expect(contentLines.every(l => l.length <= 100)).toBe(true);

    // Should show truncation indicator
    expect(plainOutput).toContain("… +");
    expect(plainOutput).toContain("lines (ctrl+o to expand)");
  });

  it("renders WebFetch result with result field", () => {
    const webFetchResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        bytes: 12345,
        code: 200,
        result: "# Page Title\n\nThis is the fetched content from the web page.",
        url: "https://example.com/page",
      },
    };

    const output = renderMessage(webFetchResult, { theme: TOKYO_NIGHT });
    const plainOutput = stripAnsi(output);

    expect(plainOutput).toContain("Page Title");
    expect(plainOutput).toContain("fetched content");
  });

  it("renders WebSearch result with query and results", () => {
    const webSearchResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        query: "typescript best practices",
        results: [
          { title: "TypeScript Guide", url: "https://example.com/ts", snippet: "Learn TypeScript..." },
          { title: "Advanced TS", url: "https://example.com/advanced", snippet: "Advanced patterns" },
        ],
        durationSeconds: 1.5,
      },
    };

    const output = renderMessage(webSearchResult, { theme: TOKYO_NIGHT });
    const plainOutput = stripAnsi(output);

    expect(plainOutput).toContain("Query: typescript best practices");
    expect(plainOutput).toContain("TypeScript Guide");
    expect(plainOutput).toContain("Advanced TS");
  });

  it("renders Task/Agent result with content array", () => {
    const taskResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        status: "completed",
        content: [
          { type: "text", text: "Found 3 matching files:" },
          { type: "text", text: "src/utils/helper.ts" },
        ],
      },
    };

    const output = renderMessage(taskResult, { theme: TOKYO_NIGHT });
    const plainOutput = stripAnsi(output);

    expect(plainOutput).toContain("Found 3 matching files");
    expect(plainOutput).toContain("src/utils/helper.ts");
  });

  it("renders WebSearch result with string items", () => {
    const webSearchResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        query: "simple search",
        results: ["Result one", "Result two", "Result three"],
        durationSeconds: 0.5,
      },
    };

    const output = renderMessage(webSearchResult, { theme: TOKYO_NIGHT });
    const plainOutput = stripAnsi(output);

    expect(plainOutput).toContain("Query: simple search");
    expect(plainOutput).toContain("Result one");
    expect(plainOutput).toContain("Result two");
  });

  it("renders MCP array-format toolUseResult with text content", () => {
    const mcpResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      // MCP tools return array directly as toolUseResult
      toolUseResult: [
        { type: "text", text: "# take_snapshot response\n## Page content\nSome page content here" },
      ],
    };

    const output = renderMessage(mcpResult, { theme: TOKYO_NIGHT });
    const plainOutput = stripAnsi(output);

    expect(plainOutput).toContain("take_snapshot response");
    expect(plainOutput).toContain("Page content");
  });

  it("renders MCP array-format toolUseResult with image as [Screenshot captured]", () => {
    const mcpScreenshot = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      // MCP screenshot returns text + image
      toolUseResult: [
        { type: "text", text: "Screenshot of page" },
        { type: "image", source: { data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..." } },
      ],
    };

    const output = renderMessage(mcpScreenshot, { theme: TOKYO_NIGHT });
    const plainOutput = stripAnsi(output);

    expect(plainOutput).toContain("Screenshot of page");
    expect(plainOutput).toContain("[Screenshot captured]");
    // Should NOT contain base64 data
    expect(plainOutput).not.toContain("iVBORw0KGgo");
  });
});

describe("ANSI output structure", () => {
  it("includes color escape codes", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const userMsg = entries.find((e) => e.type === "user");

    const output = renderMessage(userMsg!, { theme: TOKYO_NIGHT });

    // Should contain ANSI escape sequences
    expect(output).toMatch(/\x1b\[/);
    // Should contain 24-bit color codes (38;2;r;g;b)
    expect(output).toMatch(/\x1b\[38;2;\d+;\d+;\d+m/);
  });

  it("resets styles at end of colored text", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const userMsg = entries.find((e) => e.type === "user");

    const output = renderMessage(userMsg!, { theme: TOKYO_NIGHT });

    // Should contain reset sequence
    expect(output).toContain("\x1b[0m");
  });

  it("user prompt includes background color", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const userMsg = entries.find(
      (e) => e.type === "user" && !("toolUseResult" in e && e.toolUseResult)
    );

    const output = renderMessage(userMsg!, { theme: TOKYO_NIGHT });

    // Should contain background color escape sequence (48;2;r;g;b)
    expect(output).toMatch(/\x1b\[48;2;\d+;\d+;\d+m/);
  });

  it("tool names are bold", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const toolMsg = entries.find(
      (e) =>
        e.type === "assistant" &&
        e.message.content.some((c) => c.type === "tool_use")
    );

    const output = renderMessage(toolMsg!, { theme: TOKYO_NIGHT });

    // Should contain bold escape sequence
    expect(output).toContain("\x1b[1m");
  });

  it("assistant text has bullet prefix", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const assistantMsg = entries.find(
      (e) =>
        e.type === "assistant" &&
        e.message.content.some((c) => c.type === "text")
    );

    const output = renderMessage(assistantMsg!, { theme: TOKYO_NIGHT });

    // Assistant text rendered via renderMarkdown (no bullet prefix)
    expect(stripAnsi(output)).toMatch(/^Of course/);
  });

  it("tool results use indent marker", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));
    const toolResultMsg = entries.find(
      (e) => e.type === "user" && "toolUseResult" in e && e.toolUseResult
    );

    const output = renderMessage(toolResultMsg!, { theme: TOKYO_NIGHT });

    // Should contain indent marker character
    expect(stripAnsi(output)).toContain("⎿");
  });
});

describe("Edit tool diff rendering", () => {
  it("renders diff header with file path and stats", () => {
    const editResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        filePath: "/test/file.ts",
        oldString: "old",
        newString: "new",
        structuredPatch: [
          {
            oldStart: 10,
            newStart: 10,
            oldLines: 1,
            newLines: 1,
            lines: ["-old", "+new"],
          },
        ],
      },
    };

    const output = renderMessage(editResult, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    expect(stripped).toContain("Updated /test/file.ts");
    expect(stripped).toContain("1 addition");
    expect(stripped).toContain("1 removal");
  });

  it("renders addition lines with + prefix and green background", () => {
    const editResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        filePath: "/test/file.ts",
        oldString: "",
        newString: "new content",
        structuredPatch: [
          {
            oldStart: 10,
            newStart: 10,
            oldLines: 0,
            newLines: 1,
            lines: ["+new content"],
          },
        ],
      },
    };

    const output = renderMessage(editResult, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should contain + prefix and content
    expect(stripped).toContain(" + new content");
    // Should contain background color code (48;2 for RGB background)
    expect(output).toMatch(/\x1b\[48;2;\d+;\d+;\d+m/);
  });

  it("renders removal lines with - prefix and red background", () => {
    const editResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        filePath: "/test/file.ts",
        oldString: "old content",
        newString: "",
        structuredPatch: [
          {
            oldStart: 10,
            newStart: 10,
            oldLines: 1,
            newLines: 0,
            lines: ["-old content"],
          },
        ],
      },
    };

    const output = renderMessage(editResult, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should contain - prefix and content
    expect(stripped).toContain(" - old content");
    // Should contain background color code
    expect(output).toMatch(/\x1b\[48;2;\d+;\d+;\d+m/);
  });

  it("renders context lines without prefix", () => {
    const editResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        filePath: "/test/file.ts",
        oldString: "old",
        newString: "new",
        structuredPatch: [
          {
            oldStart: 9,
            newStart: 9,
            oldLines: 3,
            newLines: 3,
            lines: [" context before", "-old", "+new", " context after"],
          },
        ],
      },
    };

    const output = renderMessage(editResult, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Context lines should appear without +/- prefix
    expect(stripped).toContain("context before");
    expect(stripped).toContain("context after");
    // Should have line numbers
    expect(stripped).toMatch(/\d+.*context before/);
  });

  it("handles multi-section patches", () => {
    const editResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        filePath: "/test/file.ts",
        oldString: "old1\nold2",
        newString: "new1\nnew2",
        structuredPatch: [
          {
            oldStart: 5,
            newStart: 5,
            oldLines: 1,
            newLines: 1,
            lines: ["-old1", "+new1"],
          },
          {
            oldStart: 20,
            newStart: 20,
            oldLines: 1,
            newLines: 1,
            lines: ["-old2", "+new2"],
          },
        ],
      },
    };

    const output = renderMessage(editResult, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should show stats for all patches
    expect(stripped).toContain("2 additions");
    expect(stripped).toContain("2 removals");
    // Should contain content from both patches
    expect(stripped).toContain("new1");
    expect(stripped).toContain("new2");
  });

  it("applies character-level highlighting for paired modifications", () => {
    const editResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        filePath: "/test/file.ts",
        oldString: "const x = 1;",
        newString: "const y = 2;",
        structuredPatch: [
          {
            oldStart: 10,
            newStart: 10,
            oldLines: 1,
            newLines: 1,
            lines: ["-const x = 1;", "+const y = 2;"],
          },
        ],
      },
    };

    const output = renderMessage(editResult, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should contain both old and new content
    expect(stripped).toContain(" - const x = 1;");
    expect(stripped).toContain(" + const y = 2;");
    // Should have multiple background codes for character highlighting
    // (at least 4: line bg for unchanged "const ", char bg for "x", line bg for " = ", char bg for "1")
    const bgMatches = output.match(/\x1b\[48;2;\d+;\d+;\d+m/g) ?? [];
    expect(bgMatches.length).toBeGreaterThan(4);
  });

  it("falls back to regular rendering without structuredPatch", () => {
    const editResult = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "human" as const,
      cwd: "/test",
      message: { role: "user" as const, content: "" },
      toolUseResult: {
        filePath: "/test/file.ts",
        oldString: "old",
        newString: "new",
        content: "cat snippet showing the edit",
      },
    };

    const output = renderMessage(editResult, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should render the content field as fallback
    expect(stripped).toContain("cat snippet showing the edit");
    // Should NOT have diff formatting
    expect(stripped).not.toContain("Updated /test/file.ts");
  });
});

describe("full session rendering", () => {
  it("renders complete session without errors", async () => {
    const entries = await loadTranscript(join(fixturesDir, "sample-session.jsonl"));

    const outputs: string[] = [];
    for (const entry of entries) {
      const output = renderMessage(entry, { theme: TOKYO_NIGHT });
      outputs.push(output);
    }

    // Should have rendered all entries
    expect(outputs.length).toBe(entries.length);

    // Combine and check overall structure
    const combined = outputs.filter((o) => o.length > 0).join("\n\n");
    const stripped = stripAnsi(combined);

    // Should contain key elements from the conversation
    expect(stripped).toContain("→"); // User prompt prefix
    expect(stripped).toContain("●"); // Tool bullet
    expect(stripped).toContain("Read"); // Tool name
    expect(stripped).toContain("Edit"); // Another tool
  });
});

describe("slash command rendering", () => {
  it("renders /clear command with XML tags", () => {
    const clearCommand = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: `<command-name>/clear</command-name>
            <command-message>clear</command-message>
            <command-args></command-args>`,
      },
    };

    const output = renderMessage(clearCommand, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should render as → /clear instead of raw XML (matches Claude Code UI)
    expect(stripped).toContain("→ /clear");
    expect(stripped).not.toContain("<command-name>");
    expect(stripped).not.toContain("</command-name>");
  });

  it("renders /status command with stdout output", () => {
    const statusCommand = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: `<command-name>/status</command-name>
            <command-message>status</command-message>
            <command-args></command-args>
<local-command-stdout>Status dialog dismissed</local-command-stdout>`,
      },
    };

    const output = renderMessage(statusCommand, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    expect(stripped).toContain("→ /status");
    expect(stripped).toContain("Status dialog dismissed");
    expect(stripped).not.toContain("<local-command-stdout>");
  });

  it("renders /plugin command with args", () => {
    const pluginCommand = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: `<command-name>/plugin</command-name>
            <command-message>plugin</command-message>
            <command-args>marketplace add anthropic-agent-skills</command-args>`,
      },
    };

    const output = renderMessage(pluginCommand, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    expect(stripped).toContain("→ /plugin");
    expect(stripped).toContain("marketplace add anthropic-agent-skills");
  });

  it("renders standalone local-command-stdout", () => {
    const stdoutOnly = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: `<local-command-stdout>Goodbye!</local-command-stdout>`,
      },
    };

    const output = renderMessage(stdoutOnly, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    expect(stripped).toContain("Goodbye!");
    expect(stripped).not.toContain("<local-command-stdout>");
    // Should NOT have user prompt arrow since it's command output
    expect(stripped).not.toContain("→");
  });

  it("renders empty local-command-stdout as empty string", () => {
    const emptyStdout = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: `<local-command-stdout></local-command-stdout>`,
      },
    };

    const output = renderMessage(emptyStdout, { theme: TOKYO_NIGHT });
    expect(output).toBe("");
  });
});

describe("bash mode rendering", () => {
  it("renders bash-input command with ! prefix", () => {
    const bashInput = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: "<bash-input>ls -la</bash-input>",
      },
    };

    const output = renderMessage(bashInput, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should render as "! ls -la" with proper styling
    expect(stripped).toContain("!");
    expect(stripped).toContain("ls -la");
    expect(stripped).not.toContain("<bash-input>");
    expect(stripped).not.toContain("</bash-input>");
  });

  it("renders bash-input with pink ! and correct background", () => {
    const bashInput = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: "<bash-input>pwd</bash-input>",
      },
    };

    const output = renderMessage(bashInput, { theme: TOKYO_NIGHT });

    // Check for pink color (253;93;177 = #fd5db1)
    expect(output).toContain("38;2;253;93;177");
    // Check for dark gray background (65;60;65 = #413c41)
    expect(output).toContain("48;2;65;60;65");
    // Check for white text (255;255;255 = #ffffff)
    expect(output).toContain("38;2;255;255;255");
  });

  it("renders bash-stdout with tree connector", () => {
    const bashOutput = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: "<bash-stdout>/home/user/project</bash-stdout><bash-stderr></bash-stderr>",
      },
    };

    const output = renderMessage(bashOutput, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should render with tree connector (⎿)
    expect(stripped).toContain("⎿");
    expect(stripped).toContain("/home/user/project");
    expect(stripped).not.toContain("<bash-stdout>");
    expect(stripped).not.toContain("<bash-stderr>");
  });

  it("renders bash-stderr in red color", () => {
    const bashError = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: "<bash-stdout></bash-stdout><bash-stderr>command not found: foo</bash-stderr>",
      },
    };

    const output = renderMessage(bashError, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    // Should render stderr with tree connector
    expect(stripped).toContain("⎿");
    expect(stripped).toContain("command not found: foo");
    // Check for red color (255;107;128 = #ff6b80)
    expect(output).toContain("38;2;255;107;128");
  });

  it("renders both stdout and stderr when present", () => {
    const bashBoth = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: "<bash-stdout>partial output</bash-stdout><bash-stderr>warning: something went wrong</bash-stderr>",
      },
    };

    const output = renderMessage(bashBoth, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    expect(stripped).toContain("partial output");
    expect(stripped).toContain("warning: something went wrong");
  });

  it("renders multiline stdout correctly", () => {
    const bashMultiline = {
      type: "user" as const,
      timestamp: "2025-01-01T00:00:00Z",
      sessionId: "test",
      uuid: "test-uuid",
      parentUuid: null,
      userType: "external" as const,
      cwd: "/test",
      message: {
        role: "user" as const,
        content: "<bash-stdout>line1\nline2\nline3</bash-stdout><bash-stderr></bash-stderr>",
      },
    };

    const output = renderMessage(bashMultiline, { theme: TOKYO_NIGHT });
    const stripped = stripAnsi(output);

    expect(stripped).toContain("line1");
    expect(stripped).toContain("line2");
    expect(stripped).toContain("line3");
    // First line should have tree connector
    expect(stripped).toContain("⎿");
  });
});
