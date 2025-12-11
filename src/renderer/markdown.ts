/**
 * Markdown-to-ANSI parser for assistant text
 * Converts markdown syntax to ANSI escape sequences for terminal rendering
 */

import { BOLD, RESET_BOLD, ITALIC, RESET_ITALIC, UNDERLINE, RESET_UNDERLINE, visibleLength, colorize, style } from "./ansi.js";
import type { RenderConfig } from "./messages.js";

/**
 * Render markdown text to ANSI-styled output
 * Handles inline formatting (bold, italic, code), tables, and word wrapping
 */
export function renderMarkdown(text: string, cfg: RenderConfig): string {
  const { theme, width } = cfg;

  // Split into lines to preserve explicit line breaks
  const inputLines = text.split("\n");
  const outputLines: string[] = [];

  let i = 0;
  while (i < inputLines.length) {
    const line = inputLines[i];

    // Check if this starts a code block (```)
    if (line.trimStart().startsWith("```")) {
      const indent = line.match(/^(\s*)/)?.[1] || "";
      // Collect lines until closing ```
      const codeLines: string[] = [];
      i++; // Skip opening fence
      while (i < inputLines.length && !inputLines[i].trimStart().startsWith("```")) {
        codeLines.push(inputLines[i]);
        i++;
      }
      i++; // Skip closing fence (if found)
      // Render code block with muted styling, no word wrap
      const rendered = renderCodeBlock(codeLines, indent, cfg);
      outputLines.push(...rendered);
      continue;
    }

    // Check if this is a horizontal rule (---, ***, ___)
    if (/^(\s*)[-*_]{3,}\s*$/.test(line)) {
      // Render as a line of dashes using box drawing character
      const rule = "─".repeat(Math.min(width, 40)); // Cap at 40 chars for visual balance
      outputLines.push(colorize(rule, theme.muted));
      i++;
      continue;
    }

    // Check if this is a header (starts with #)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const content = headerMatch[2];
      // Render header as bold
      const formatted = parseInlineFormatting(content, cfg);
      // Wrap with bold
      outputLines.push(`${BOLD}${formatted}${RESET_BOLD}`);
      i++;
      continue;
    }

    // Check if this is an unordered list item (-, *, +)
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (unorderedMatch) {
      const indent = unorderedMatch[1];
      const content = unorderedMatch[3];
      const formatted = parseInlineFormatting(content, cfg);
      // Use bullet character
      outputLines.push(`${indent}• ${formatted}`);
      i++;
      continue;
    }

    // Check if this is an ordered list item (1., 2., etc.)
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const indent = orderedMatch[1];
      const num = orderedMatch[2];
      const content = orderedMatch[3];
      const formatted = parseInlineFormatting(content, cfg);
      outputLines.push(`${indent}${num}. ${formatted}`);
      i++;
      continue;
    }

    // Check if this starts a table (line contains | and looks like a table row)
    if (isTableRow(line)) {
      // Collect all consecutive table rows
      const tableLines: string[] = [];
      while (i < inputLines.length && isTableRow(inputLines[i])) {
        tableLines.push(inputLines[i]);
        i++;
      }
      // Render the table with alignment
      const renderedTable = renderTable(tableLines, cfg);
      outputLines.push(...renderedTable);
    } else {
      // Regular line - parse inline formatting and word wrap
      const formatted = parseInlineFormatting(line, cfg);
      const wrapped = wordWrapAnsi(formatted, width, cfg);
      outputLines.push(...wrapped);
      i++;
    }
  }

  return outputLines.join("\n");
}

/**
 * Check if a line looks like a markdown table row
 */
function isTableRow(line: string): boolean {
  // Must have at least one | and not be just dashes/pipes (separator row counts too)
  return line.includes("|") && line.trim().length > 0;
}

/**
 * Render a markdown table with aligned columns
 */
function renderTable(lines: string[], cfg: RenderConfig): string[] {
  const { theme } = cfg;

  // Parse all rows into cells
  const rows: string[][] = [];
  const separatorIndices: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if this is a separator row (|---|---|)
    if (/^\|?[\s\-:|]+\|?$/.test(line)) {
      separatorIndices.push(i);
      rows.push([]); // Placeholder
      continue;
    }

    // Parse cells: split by |, trim, filter empty edge cells
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, idx, arr) => {
        // Filter out empty first/last cells from leading/trailing |
        if (idx === 0 && c === "") return false;
        if (idx === arr.length - 1 && c === "") return false;
        return true;
      });
    rows.push(cells);
  }

  // Apply inline formatting to cells and calculate visible widths
  const formattedRows: string[][] = [];
  const colWidths: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (separatorIndices.includes(i)) {
      formattedRows.push([]); // Placeholder for separator
      continue;
    }
    const formattedCells = rows[i].map((cell) => parseInlineFormatting(cell, cfg));
    formattedRows.push(formattedCells);

    // Calculate widths based on visible length (strips ANSI codes)
    for (let col = 0; col < formattedCells.length; col++) {
      const cellWidth = visibleLength(formattedCells[col]);
      if (colWidths[col] === undefined || cellWidth > colWidths[col]) {
        colWidths[col] = cellWidth;
      }
    }
  }

  // Render each row with padding based on visible width
  const output: string[] = [];
  for (let i = 0; i < formattedRows.length; i++) {
    if (separatorIndices.includes(i)) {
      // Render separator row with same spacing as data rows
      const sep = colWidths.map((w) => "-".repeat(w)).join(" | ");
      output.push(colorize(sep, theme.muted));
    } else {
      // Render data row with ANSI-aware padding
      const row = formattedRows[i];
      const paddedCells = row.map((cell, col) => {
        const targetWidth = colWidths[col] || visibleLength(cell);
        const currentWidth = visibleLength(cell);
        const padding = Math.max(0, targetWidth - currentWidth);
        return cell + " ".repeat(padding);
      });
      const rowStr = paddedCells.join(" | ");
      output.push(rowStr);
    }
  }

  return output;
}

/**
 * Render a code block with preserved formatting
 * No word wrap, muted styling to distinguish from regular text
 */
function renderCodeBlock(lines: string[], indent: string, cfg: RenderConfig): string[] {
  const { theme } = cfg;
  // Render each line with dim styling, preserve exact content
  return lines.map((line) => {
    // Preserve original indentation, add block indent if any
    const content = indent + line;
    return style(content, { dim: true, fg: theme.muted });
  });
}

/**
 * Parse inline markdown formatting and convert to ANSI
 * Processing order: code first (protected), then bold, then italic
 */
function parseInlineFormatting(text: string, cfg: RenderConfig): string {
  const { theme } = cfg;

  // Step 1: Protect and render inline code first
  // Use placeholder to prevent code content from being parsed
  const codePlaceholders: string[] = [];
  let result = text.replace(/`([^`]+)`/g, (_, code) => {
    const rendered = colorize(code, theme.agent); // Purple accent like Ink
    const placeholder = `\x00CODE${codePlaceholders.length}\x00`;
    codePlaceholders.push(rendered);
    return placeholder;
  });

  // Step 2: Handle escaped characters
  // Replace \* and \_ with placeholders (without the literal char to avoid matching)
  result = result.replace(/\\\*/g, "\x00ESCSTAR\x00");
  result = result.replace(/\\_/g, "\x00ESCUNDER\x00");

  // Step 3: Parse links [text](url) - render as "text" with underline
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    // Show text underlined, URL in muted color after
    return `${UNDERLINE}${text}${RESET_UNDERLINE} (${colorize(url, theme.muted)})`;
  });

  // Step 4: Parse bold (**text** or __text__)
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, content) => {
    return `${BOLD}${content}${RESET_BOLD}`;
  });
  result = result.replace(/__([^_]+)__/g, (_, content) => {
    return `${BOLD}${content}${RESET_BOLD}`;
  });

  // Step 5: Parse italic (*text* or _text_)
  // Must not match inside words for underscore
  result = result.replace(/\*([^*]+)\*/g, (_, content) => {
    return `${ITALIC}${content}${RESET_ITALIC}`;
  });
  result = result.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, (_, content) => {
    return `${ITALIC}${content}${RESET_ITALIC}`;
  });

  // Step 6: Restore escaped characters
  /* eslint-disable no-control-regex */
  result = result.replace(/\x00ESCSTAR\x00/g, "*");
  result = result.replace(/\x00ESCUNDER\x00/g, "_");
  /* eslint-enable no-control-regex */

  // Step 7: Restore code placeholders
  for (let i = 0; i < codePlaceholders.length; i++) {
    result = result.replace(`\x00CODE${i}\x00`, codePlaceholders[i]);
  }

  // Apply base text color
  return colorize(result, theme.assistantText);
}

/**
 * Word wrap text containing ANSI escape sequences
 * Uses visibleLength() to calculate actual display width
 */
function wordWrapAnsi(text: string, width: number, _cfg: RenderConfig): string[] {
  if (width <= 0) return [text];

  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let currentLine = "";
  let currentWidth = 0;

  for (const word of words) {
    const wordWidth = visibleLength(word);

    if (currentWidth === 0) {
      // Start of line
      currentLine = word;
      currentWidth = wordWidth;
    } else if (currentWidth + wordWidth <= width) {
      // Word fits on current line
      currentLine += word;
      currentWidth += wordWidth;
    } else if (word.match(/^\s+$/)) {
      // Whitespace that would exceed width - skip it
      continue;
    } else {
      // Word doesn't fit - start new line
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = word.trimStart();
      currentWidth = visibleLength(currentLine);
    }
  }

  // Don't forget the last line
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  // Handle empty input
  if (lines.length === 0) {
    lines.push("");
  }

  return lines;
}
