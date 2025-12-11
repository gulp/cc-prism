/**
 * Diff visualization for Edit tool results
 * Renders structured patches with line numbers, +/- indicators, and colored backgrounds
 * Supports character-level highlighting for modified lines
 */

import { colorize, style, indent, RESET, wordWrap } from "./ansi.js";
import type { RenderTheme } from "./theme.js";

// Line number width (5) + space (1) + prefix " + " (3) = 9 chars before content
const LINE_PREFIX_WIDTH = 9;

// =============================================================================
// Types
// =============================================================================

/** A single hunk from a unified diff */
export interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[]; // Each line prefixed with ' ', '+', or '-'
}

/** Edit tool result with structured patch data */
export interface EditToolResult {
  filePath: string;
  oldString: string;
  newString: string;
  originalFile?: string;
  structuredPatch?: PatchHunk[];
  userModified?: boolean;
  replaceAll?: boolean;
  content?: string;
}

/** Configuration for diff rendering */
export interface DiffRenderConfig {
  theme: RenderTheme;
  indentSize: number;
  width: number;
}

/** A segment of text with change flag for character-level diff */
interface DiffSegment {
  text: string;
  changed: boolean;
}

// =============================================================================
// Main Renderer
// =============================================================================

/**
 * Check if a tool result is an Edit result with structured patch data
 */
export function isEditToolResult(result: unknown): result is EditToolResult {
  if (typeof result !== "object" || result === null) return false;
  const r = result as Record<string, unknown>;
  return (
    typeof r.filePath === "string" &&
    Array.isArray(r.structuredPatch) &&
    r.structuredPatch.length > 0
  );
}

/**
 * Render an Edit tool result as a diff visualization
 */
export function renderEditDiff(result: EditToolResult, cfg: DiffRenderConfig): string {
  const { theme, indentSize } = cfg;
  const output: string[] = [];

  // Calculate statistics
  let additions = 0;
  let removals = 0;
  for (const hunk of result.structuredPatch ?? []) {
    for (const line of hunk.lines) {
      if (line[0] === "+") additions++;
      if (line[0] === "-") removals++;
    }
  }

  // Render header
  const statsText = `${additions} addition${additions !== 1 ? "s" : ""} and ${removals} removal${removals !== 1 ? "s" : ""}`;
  const header = colorize(`Updated ${result.filePath} with ${statsText}`, theme.muted);
  output.push(indent(header, indentSize));

  // Render each hunk
  // Calculate available width for content: total width - indent - prefix
  const contentWidth = cfg.width - indentSize - LINE_PREFIX_WIDTH;
  for (const hunk of result.structuredPatch ?? []) {
    const hunkLines = renderHunk(hunk, theme, contentWidth);
    for (const line of hunkLines) {
      output.push(indent(line, indentSize));
    }
  }

  return output.join("\n");
}

// =============================================================================
// Hunk Rendering
// =============================================================================

/**
 * Render a single diff hunk with line numbers and colored backgrounds.
 * Identifies paired -/+ lines for character-level diff highlighting.
 */
function renderHunk(hunk: PatchHunk, theme: RenderTheme, contentWidth: number): string[] {
  const output: string[] = [];
  let oldLineNum = hunk.oldStart;
  let newLineNum = hunk.newStart;
  const lines = hunk.lines;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const prefix = line[0];
    const content = line.slice(1);

    switch (prefix) {
      case " ":
        // Context line - show line number, no background
        output.push(...renderContextLine(newLineNum, content, theme, contentWidth));
        oldLineNum++;
        newLineNum++;
        i++;
        break;

      case "-": {
        // Check if this is a modification (- followed by +)
        const nextLine = lines[i + 1];
        if (nextLine && nextLine[0] === "+") {
          // Paired modification - render with character-level diff
          const oldContent = content;
          const newContent = nextLine.slice(1);
          const { oldSegments, newSegments } = diffWords(oldContent, newContent);

          output.push(...renderRemovalLineWithHighlight(oldLineNum, oldSegments, theme, contentWidth));
          output.push(...renderAdditionLineWithHighlight(newLineNum, newSegments, theme, contentWidth));

          oldLineNum++;
          newLineNum++;
          i += 2; // Skip both lines
        } else {
          // Pure removal
          output.push(...renderRemovalLine(oldLineNum, content, theme, contentWidth));
          oldLineNum++;
          i++;
        }
        break;
      }

      case "+":
        // Pure addition (not paired with a removal)
        output.push(...renderAdditionLine(newLineNum, content, theme, contentWidth));
        newLineNum++;
        i++;
        break;

      default:
        // Unknown prefix, render as context
        output.push(...renderContextLine(newLineNum, line, theme, contentWidth));
        newLineNum++;
        i++;
    }
  }

  return output;
}

// =============================================================================
// Word-based Diff Algorithm
// =============================================================================

/**
 * Compute word-based diff between two lines.
 * Returns segments marked as changed or unchanged for both lines.
 */
function diffWords(
  oldLine: string,
  newLine: string
): { oldSegments: DiffSegment[]; newSegments: DiffSegment[] } {
  // Split on word boundaries while preserving whitespace
  const oldTokens = tokenize(oldLine);
  const newTokens = tokenize(newLine);

  // Compute LCS (longest common subsequence) to identify unchanged tokens
  const lcs = longestCommonSubsequence(oldTokens, newTokens);

  // Build segments for old line
  const oldSegments = buildSegments(oldTokens, lcs, "old");

  // Build segments for new line
  const newSegments = buildSegments(newTokens, lcs, "new");

  return { oldSegments, newSegments };
}

/**
 * Tokenize a line into words and whitespace, preserving order.
 */
function tokenize(line: string): string[] {
  // Split on whitespace boundaries while keeping the whitespace
  const tokens: string[] = [];
  let current = "";
  let inWhitespace: boolean | null = null;

  for (const char of line) {
    const isWs = /\s/.test(char);
    if (inWhitespace === null) {
      // First character
      current = char;
      inWhitespace = isWs;
    } else if (isWs === inWhitespace) {
      // Same type as current token, append
      current += char;
    } else {
      // Different type, push current and start new
      tokens.push(current);
      current = char;
      inWhitespace = isWs;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Find the longest common subsequence of tokens.
 * Returns a Set of token indices that are part of the LCS.
 */
function longestCommonSubsequence(
  oldTokens: string[],
  newTokens: string[]
): Map<string, Set<number>> {
  const m = oldTokens.length;
  const n = newTokens.length;

  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS indices
  const oldLcsIndices = new Set<number>();
  const newLcsIndices = new Set<number>();

  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      oldLcsIndices.add(i - 1);
      newLcsIndices.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return new Map([
    ["old", oldLcsIndices],
    ["new", newLcsIndices],
  ]);
}

/**
 * Build diff segments from tokens, marking which are changed.
 */
function buildSegments(
  tokens: string[],
  lcs: Map<string, Set<number>>,
  side: "old" | "new"
): DiffSegment[] {
  const lcsIndices = lcs.get(side) ?? new Set();
  const segments: DiffSegment[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const changed = !lcsIndices.has(i);
    const text = tokens[i];

    // Merge with previous segment if same change status
    if (segments.length > 0 && segments[segments.length - 1].changed === changed) {
      segments[segments.length - 1].text += text;
    } else {
      segments.push({ text, changed });
    }
  }

  return segments;
}

// =============================================================================
// Line Rendering
// =============================================================================

/**
 * Render a context line (unchanged), with wrapping support
 */
function renderContextLine(lineNum: number, content: string, theme: RenderTheme, contentWidth: number): string[] {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     "; // 5 spaces to replace line number on continuation

  // Wrap content if needed
  if (contentWidth > 0 && content.length > contentWidth) {
    const wrapped = wordWrap(content, contentWidth);
    return wrapped.map((line, idx) => {
      if (idx === 0) {
        return `${lineNumStr}      ${line}`;
      }
      return `${lineNumPadding}      ${line}`;
    });
  }

  return [`${lineNumStr}      ${content}`];
}

/**
 * Render a removal line with red background (no character highlighting), with wrapping
 */
function renderRemovalLine(lineNum: number, content: string, theme: RenderTheme, contentWidth: number): string[] {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     "; // 5 spaces to replace line number on continuation

  // Wrap content if needed
  if (contentWidth > 0 && content.length > contentWidth) {
    const wrapped = wordWrap(content, contentWidth);
    return wrapped.map((line, idx) => {
      const styledContent = style(` - ${line}`, {
        fg: "#ffffff",
        bg: theme.diffRemoveLineBg,
      });
      if (idx === 0) {
        return `${lineNumStr} ${styledContent}`;
      }
      return `${lineNumPadding} ${styledContent}`;
    });
  }

  const styledContent = style(` - ${content}`, {
    fg: "#ffffff",
    bg: theme.diffRemoveLineBg,
  });
  return [`${lineNumStr} ${styledContent}`];
}

/**
 * Render an addition line with green background (no character highlighting), with wrapping
 */
function renderAdditionLine(lineNum: number, content: string, theme: RenderTheme, contentWidth: number): string[] {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     "; // 5 spaces to replace line number on continuation

  // Wrap content if needed
  if (contentWidth > 0 && content.length > contentWidth) {
    const wrapped = wordWrap(content, contentWidth);
    return wrapped.map((line, idx) => {
      const styledContent = style(` + ${line}`, {
        fg: "#ffffff",
        bg: theme.diffAddLineBg,
      });
      if (idx === 0) {
        return `${lineNumStr} ${styledContent}`;
      }
      return `${lineNumPadding} ${styledContent}`;
    });
  }

  const styledContent = style(` + ${content}`, {
    fg: "#ffffff",
    bg: theme.diffAddLineBg,
  });
  return [`${lineNumStr} ${styledContent}`];
}

/**
 * Render a removal line with character-level highlighting for changed segments, with wrapping
 */
function renderRemovalLineWithHighlight(
  lineNum: number,
  segments: DiffSegment[],
  theme: RenderTheme,
  contentWidth: number
): string[] {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     "; // 5 spaces to replace line number on continuation

  // Calculate total visible content length
  const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);

  // If no wrapping needed, render simply
  if (contentWidth <= 0 || totalLength <= contentWidth) {
    let content = "";
    for (const seg of segments) {
      if (seg.changed) {
        content += style(seg.text, { fg: "#ffffff", bg: theme.diffRemoveCharBg });
      } else {
        content += style(seg.text, { fg: "#ffffff", bg: theme.diffRemoveLineBg });
      }
    }
    const prefix = style(" - ", { fg: "#ffffff", bg: theme.diffRemoveLineBg });
    return [`${lineNumStr} ${prefix}${content}${RESET}`];
  }

  // Wrap segments across multiple lines
  return wrapSegmentedLine(
    lineNumStr,
    lineNumPadding,
    " - ",
    segments,
    theme.diffRemoveLineBg,
    theme.diffRemoveCharBg,
    contentWidth
  );
}

/**
 * Render an addition line with character-level highlighting for changed segments, with wrapping
 */
function renderAdditionLineWithHighlight(
  lineNum: number,
  segments: DiffSegment[],
  theme: RenderTheme,
  contentWidth: number
): string[] {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     "; // 5 spaces to replace line number on continuation

  // Calculate total visible content length
  const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);

  // If no wrapping needed, render simply
  if (contentWidth <= 0 || totalLength <= contentWidth) {
    let content = "";
    for (const seg of segments) {
      if (seg.changed) {
        content += style(seg.text, { fg: "#ffffff", bg: theme.diffAddCharBg });
      } else {
        content += style(seg.text, { fg: "#ffffff", bg: theme.diffAddLineBg });
      }
    }
    const prefix = style(" + ", { fg: "#ffffff", bg: theme.diffAddLineBg });
    return [`${lineNumStr} ${prefix}${content}${RESET}`];
  }

  // Wrap segments across multiple lines
  return wrapSegmentedLine(
    lineNumStr,
    lineNumPadding,
    " + ",
    segments,
    theme.diffAddLineBg,
    theme.diffAddCharBg,
    contentWidth
  );
}

// =============================================================================
// Wrapping Helper for Segmented Lines
// =============================================================================

/**
 * Wrap a line with character-level highlighting across multiple output lines.
 * Handles segments with different backgrounds and maintains styling across wraps.
 */
function wrapSegmentedLine(
  lineNumStr: string,
  lineNumPadding: string,
  prefixText: string,
  segments: DiffSegment[],
  lineBg: string,
  charBg: string,
  contentWidth: number
): string[] {
  const outputLines: string[] = [];
  let currentLineContent = "";
  let currentLineWidth = 0;
  let isFirstLine = true;

  // Process each segment
  for (const seg of segments) {
    const segBg = seg.changed ? charBg : lineBg;
    let remaining = seg.text;

    while (remaining.length > 0) {
      const spaceLeft = contentWidth - currentLineWidth;

      if (remaining.length <= spaceLeft) {
        // Whole segment fits on current line
        currentLineContent += style(remaining, { fg: "#ffffff", bg: segBg });
        currentLineWidth += remaining.length;
        remaining = "";
      } else {
        // Need to split segment
        // Try to split at word boundary
        let splitPoint = spaceLeft;
        const lastSpace = remaining.lastIndexOf(" ", spaceLeft);
        if (lastSpace > 0) {
          splitPoint = lastSpace + 1; // Include the space
        }

        // Safety: force progress if splitPoint is 0 (prevents infinite loop)
        if (splitPoint <= 0) {
          // Line is full with no room - emit it and continue
          if (currentLineContent) {
            const prefix = style(prefixText, { fg: "#ffffff", bg: lineBg });
            if (isFirstLine) {
              outputLines.push(`${lineNumStr} ${prefix}${currentLineContent}${RESET}`);
              isFirstLine = false;
            } else {
              outputLines.push(`${lineNumPadding} ${prefix}${currentLineContent}${RESET}`);
            }
            currentLineContent = "";
            currentLineWidth = 0;
          }
          // Force at least one character to prevent infinite loop
          const chunk = remaining.slice(0, 1);
          currentLineContent += style(chunk, { fg: "#ffffff", bg: segBg });
          currentLineWidth += 1;
          remaining = remaining.slice(1);
          continue;
        }

        const chunk = remaining.slice(0, splitPoint);
        currentLineContent += style(chunk, { fg: "#ffffff", bg: segBg });
        remaining = remaining.slice(splitPoint);

        // Emit current line
        const prefix = style(prefixText, { fg: "#ffffff", bg: lineBg });
        if (isFirstLine) {
          outputLines.push(`${lineNumStr} ${prefix}${currentLineContent}${RESET}`);
          isFirstLine = false;
        } else {
          outputLines.push(`${lineNumPadding} ${prefix}${currentLineContent}${RESET}`);
        }

        // Start new line
        currentLineContent = "";
        currentLineWidth = 0;
      }
    }
  }

  // Emit final line if there's content
  if (currentLineContent || outputLines.length === 0) {
    const prefix = style(prefixText, { fg: "#ffffff", bg: lineBg });
    if (isFirstLine) {
      outputLines.push(`${lineNumStr} ${prefix}${currentLineContent}${RESET}`);
    } else {
      outputLines.push(`${lineNumPadding} ${prefix}${currentLineContent}${RESET}`);
    }
  }

  return outputLines;
}
