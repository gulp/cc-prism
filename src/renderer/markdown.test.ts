/**
 * Tests for markdown-to-ANSI parsing
 */

/* eslint-disable no-control-regex */
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown.js";
import { stripAnsi } from "./ansi.js";
import { TOKYO_NIGHT } from "./theme.js";
import type { RenderConfig } from "./messages.js";

const defaultConfig: RenderConfig = {
  theme: TOKYO_NIGHT,
  width: 80,
  maxToolOutputLines: 20,
  showThinking: true,
  indentSize: 2,
};

describe("markdown parsing", () => {
  describe("bold text", () => {
    it("renders **bold** with ANSI bold codes", () => {
      const input = "This is **bold** text";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m"); // BOLD
      expect(output).toContain("\x1b[22m"); // RESET_BOLD
      expect(stripAnsi(output)).toBe("This is bold text");
    });

    it("renders __bold__ with ANSI bold codes", () => {
      const input = "This is __bold__ text";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m");
      expect(stripAnsi(output)).toBe("This is bold text");
    });

    it("handles multiple bold sections", () => {
      const input = "**first** and **second**";
      const output = renderMarkdown(input, defaultConfig);

      // Should have two bold sequences
      const boldMatches = output.match(/\x1b\[1m/g);
      expect(boldMatches).toHaveLength(2);
      expect(stripAnsi(output)).toBe("first and second");
    });
  });

  describe("italic text", () => {
    it("renders *italic* with ANSI italic codes", () => {
      const input = "This is *italic* text";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[3m"); // ITALIC
      expect(output).toContain("\x1b[23m"); // RESET_ITALIC
      expect(stripAnsi(output)).toBe("This is italic text");
    });

    it("renders _italic_ with ANSI italic codes", () => {
      const input = "This is _italic_ text";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[3m");
      expect(stripAnsi(output)).toBe("This is italic text");
    });

    it("does not treat underscores in words as italic", () => {
      const input = "snake_case_variable";
      const output = renderMarkdown(input, defaultConfig);

      // Should NOT have italic codes
      expect(output).not.toContain("\x1b[3m");
      expect(stripAnsi(output)).toBe("snake_case_variable");
    });
  });

  describe("inline code", () => {
    it("renders `code` with purple accent color", () => {
      const input = "Use `console.log` for debugging";
      const output = renderMarkdown(input, defaultConfig);

      // Should use theme.agent color (purple) - Tokyo Night is #bb9af7
      expect(output).toContain("\x1b[38;2;"); // 24-bit color
      expect(stripAnsi(output)).toBe("Use console.log for debugging");
    });

    it("protects code content from other parsing", () => {
      const input = "The `**not bold**` should stay literal";
      const output = renderMarkdown(input, defaultConfig);

      // The ** inside backticks should not trigger bold
      // When stripped, we should see the content without **
      expect(stripAnsi(output)).toBe("The **not bold** should stay literal");
    });
  });

  describe("nested formatting", () => {
    it("handles bold inside text", () => {
      const input = "Start **bold part** end";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m");
      expect(stripAnsi(output)).toBe("Start bold part end");
    });
  });

  describe("escaped characters", () => {
    it("renders escaped asterisks literally", () => {
      const input = "This is \\*not italic\\*";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).not.toContain("\x1b[3m"); // No italic
      expect(stripAnsi(output)).toBe("This is *not italic*");
    });

    it("renders escaped underscores literally", () => {
      const input = "This is \\_not italic\\_";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).not.toContain("\x1b[3m");
      expect(stripAnsi(output)).toBe("This is _not italic_");
    });
  });

  describe("word wrapping", () => {
    it("wraps long lines to specified width", () => {
      const input = "This is a very long line that should be wrapped to fit within the specified terminal width limit";
      const config = { ...defaultConfig, width: 40 };
      const output = renderMarkdown(input, config);

      const lines = output.split("\n");
      expect(lines.length).toBeGreaterThan(1);

      // Each line's visible length should be <= width
      for (const line of lines) {
        expect(stripAnsi(line).length).toBeLessThanOrEqual(40);
      }
    });

    it("preserves explicit line breaks", () => {
      const input = "Line one\nLine two\nLine three";
      const output = renderMarkdown(input, defaultConfig);

      const lines = output.split("\n");
      expect(lines.length).toBe(3);
      expect(stripAnsi(lines[0])).toBe("Line one");
      expect(stripAnsi(lines[1])).toBe("Line two");
      expect(stripAnsi(lines[2])).toBe("Line three");
    });
  });

  describe("edge cases", () => {
    it("handles empty input", () => {
      const output = renderMarkdown("", defaultConfig);
      expect(stripAnsi(output)).toBe("");
    });

    it("handles text with no markdown", () => {
      const input = "Just plain text";
      const output = renderMarkdown(input, defaultConfig);
      expect(stripAnsi(output)).toBe("Just plain text");
    });

    it("handles incomplete markdown gracefully", () => {
      const input = "This has **unclosed bold";
      const output = renderMarkdown(input, defaultConfig);
      // Should render literally when not matched
      expect(stripAnsi(output)).toBe("This has **unclosed bold");
    });
  });

  describe("tables", () => {
    it("renders simple table with aligned columns", () => {
      const input = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;
      const output = renderMarkdown(input, defaultConfig);
      const lines = output.split("\n");

      expect(lines.length).toBe(3);
      // Check that columns are aligned (same spacing)
      expect(stripAnsi(lines[0])).toContain("Header 1");
      expect(stripAnsi(lines[0])).toContain("Header 2");
    });

    it("handles tables with varying cell widths", () => {
      const input = `| Short | Very Long Header |
|-------|------------------|
| A     | B                |`;
      const output = renderMarkdown(input, defaultConfig);
      const lines = output.split("\n");

      // Columns should be padded to max width
      expect(lines.length).toBe(3);
    });

    it("applies inline formatting within table cells", () => {
      const input = `| **Bold** | *Italic* |
|----------|----------|`;
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m"); // BOLD
      expect(output).toContain("\x1b[3m"); // ITALIC
    });
  });

  describe("headers", () => {
    it("renders h1 header as bold", () => {
      const input = "# Main Title";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m"); // BOLD
      expect(stripAnsi(output)).toBe("Main Title");
    });

    it("renders h2 header as bold", () => {
      const input = "## Section Header";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m");
      expect(stripAnsi(output)).toBe("Section Header");
    });

    it("applies inline formatting within headers", () => {
      const input = "# Title with `code`";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m"); // BOLD for header
      expect(stripAnsi(output)).toBe("Title with code");
    });
  });

  describe("lists", () => {
    it("renders unordered list with bullet", () => {
      const input = "- First item\n- Second item";
      const output = renderMarkdown(input, defaultConfig);
      const lines = output.split("\n");

      expect(lines.length).toBe(2);
      expect(stripAnsi(lines[0])).toBe("• First item");
      expect(stripAnsi(lines[1])).toBe("• Second item");
    });

    it("renders ordered list with numbers", () => {
      const input = "1. First\n2. Second\n3. Third";
      const output = renderMarkdown(input, defaultConfig);
      const lines = output.split("\n");

      expect(lines.length).toBe(3);
      expect(stripAnsi(lines[0])).toBe("1. First");
      expect(stripAnsi(lines[1])).toBe("2. Second");
      expect(stripAnsi(lines[2])).toBe("3. Third");
    });

    it("handles asterisk list markers", () => {
      const input = "* Item one\n* Item two";
      const output = renderMarkdown(input, defaultConfig);
      const lines = output.split("\n");

      expect(stripAnsi(lines[0])).toBe("• Item one");
      expect(stripAnsi(lines[1])).toBe("• Item two");
    });

    it("preserves indentation for nested lists", () => {
      const input = "- Top level\n  - Nested item";
      const output = renderMarkdown(input, defaultConfig);
      const lines = output.split("\n");

      expect(stripAnsi(lines[0])).toBe("• Top level");
      expect(stripAnsi(lines[1])).toBe("  • Nested item");
    });

    it("applies inline formatting within list items", () => {
      const input = "- Item with **bold** text";
      const output = renderMarkdown(input, defaultConfig);

      expect(output).toContain("\x1b[1m"); // BOLD
      expect(stripAnsi(output)).toBe("• Item with bold text");
    });
  });
});
