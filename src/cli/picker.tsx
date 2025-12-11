/**
 * Interactive message picker TUI using Ink
 */

import React, { useState, useMemo } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import Fuse from "fuse.js";
import clipboard from "clipboardy";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TranscriptEntry } from "../types/messages.js";
import { isRenderableMessage } from "../types/messages.js";
import { getUuid, getTimestamp } from "../parser/loader.js";
import { convertToAsciicast } from "../generator/convert.js";
import { serializeCast } from "../generator/builder.js";
import { getTheme } from "../renderer/theme.js";

// Types
interface PickerProps {
  entries: TranscriptEntry[];
  sessionPath: string;
  onExit: (selections: Selection[]) => void;
  onInteractiveExport?: (result: InteractiveExportResult) => void;
}

interface Selection {
  startUuid: string;
  endUuid: string;
  startIdx: number;
  endIdx: number;
}

/** Result returned when picker exits with "Advanced options" selected */
export interface InteractiveExportResult {
  jsonlPath: string;
  sessionPath: string;
}

type HistoryFilter = "all" | "selected";
type ExportFormat = "cast" | "jsonl" | "command" | "uuids";
type ExportMode = "single" | "multiple"; // For multiple ranges: single concatenated vs multiple files
type DialogScreen = "format" | "filename" | "multimode" | null;

interface SearchableEntry {
  idx: number;
  uuid: string | null;
  text: string;
  type: string;
}

// Constants - VISIBLE_LINES now calculated dynamically in component
const HEADER_FOOTER_LINES = 11; // header + margins + pane headers + borders + indicators + status + help
const EXPORT_HEADER_FOOTER_LINES = 9; // header + margin + export header + borders + scroll indicator + status bar

// Helper to extract text content for search and preview
function extractPreviewText(entry: TranscriptEntry): string {
  if (entry.type === "user") {
    if (entry.toolUseResult) {
      const isError =
        typeof entry.toolUseResult === "string" || entry.toolUseResult.is_error;
      return isError ? "error" : "success";
    }
    const content = entry.message.content;
    if (typeof content === "string") {
      return content;
    }
    const textItems = content.filter((c) => c.type === "text");
    return textItems.map((t) => (t.type === "text" ? t.text : "")).join("\n");
  }

  if (entry.type === "assistant") {
    const tools = entry.message.content.filter((c) => c.type === "tool_use");
    if (tools.length > 0) {
      const toolNames = tools.map((t) => (t.type === "tool_use" ? t.name : "")).join(", ");
      return `[${toolNames}]`;
    }
    const text = entry.message.content.find((c) => c.type === "text");
    if (text && text.type === "text") {
      return text.text;
    }
  }

  if (entry.type === "system" && entry.content) {
    return entry.content;
  }

  return "";
}

// Extract full content for preview pane (not truncated)
function extractFullContent(entry: TranscriptEntry): string {
  if (entry.type === "user") {
    if (entry.toolUseResult) {
      const result = entry.toolUseResult;
      if (typeof result === "string") {
        return `Tool Result (error):\n${result}`;
      }
      const status = result.is_error ? "error" : "success";
      const content = typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content, null, 2);
      return `Tool Result (${status}):\n${content}`;
    }
    const content = entry.message.content;
    if (typeof content === "string") {
      return content;
    }
    const textItems = content.filter((c) => c.type === "text");
    return textItems.map((t) => (t.type === "text" ? t.text : "")).join("\n");
  }

  if (entry.type === "assistant") {
    const parts: string[] = [];
    for (const item of entry.message.content) {
      if (item.type === "text") {
        parts.push(item.text);
      } else if (item.type === "tool_use") {
        parts.push(`[Tool: ${item.name}]`);
        if (item.input && typeof item.input === "object") {
          const inputStr = JSON.stringify(item.input, null, 2);
          if (inputStr.length < 500) {
            parts.push(inputStr);
          }
        }
      } else if (item.type === "thinking") {
        parts.push(`[Thinking]\n${item.thinking}`);
      }
    }
    return parts.join("\n");
  }

  if (entry.type === "system" && entry.content) {
    return entry.content;
  }

  return "";
}

// Helper to group selected indices into contiguous ranges
function getSelectionRanges(
  selected: Set<number>,
  renderableEntries: TranscriptEntry[]
): Selection[] {
  if (selected.size === 0) return [];

  const sortedSelected = Array.from(selected).sort((a, b) => a - b);
  const ranges: Selection[] = [];
  let rangeStartIdx = sortedSelected[0]!;
  let rangeEndIdx = rangeStartIdx;

  for (let i = 1; i <= sortedSelected.length; i++) {
    const current = sortedSelected[i];
    if (current === rangeEndIdx + 1) {
      rangeEndIdx = current;
    } else {
      const startEntry = renderableEntries[rangeStartIdx];
      const endEntry = renderableEntries[rangeEndIdx];
      if (startEntry && endEntry) {
        ranges.push({
          startUuid: getUuid(startEntry) ?? "",
          endUuid: getUuid(endEntry) ?? "",
          startIdx: rangeStartIdx,
          endIdx: rangeEndIdx,
        });
      }
      if (current !== undefined) {
        rangeStartIdx = current;
        rangeEndIdx = current;
      }
    }
  }

  return ranges;
}

// Generate a single cast command string
function generateCommandString(range: Selection, sessionPath: string): string {
  return `cc-prism cast "${sessionPath}" --start-uuid ${range.startUuid} --end-uuid ${range.endUuid}`;
}

// Generate UUID pair string
function generateUuidPair(range: Selection): string {
  return `${range.startUuid} ${range.endUuid}`;
}

// Generate JSONL content from selected entries
function generateJsonlContent(selectedEntries: TranscriptEntry[]): string {
  return selectedEntries.map((e) => JSON.stringify(e)).join("\n");
}

// Helper to get sorted selected entries from selection set
function getSelectedEntries(
  selected: Set<number>,
  renderableEntries: TranscriptEntry[]
): TranscriptEntry[] {
  const sortedSelected = Array.from(selected).sort((a, b) => a - b);
  return sortedSelected
    .map(idx => renderableEntries[idx])
    .filter((e): e is TranscriptEntry => e !== undefined);
}

// Generate suggested filename from selection ranges
function generateSuggestedFilename(ranges: Selection[]): string {
  if (ranges.length === 0) return "export";
  const first = ranges[0]!;
  const last = ranges[ranges.length - 1]!;
  const startUuid = first.startUuid.slice(0, 8);
  const endUuid = last.endUuid.slice(0, 8);
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHmmss
  return `${startUuid}-${endUuid}-${timestamp}`;
}

// Wrapped line with continuation tracking
interface WrappedLine {
  text: string;
  isContinuation: boolean;
}

// Simple word wrap for preview with continuation tracking
function wrapText(text: string, width: number): WrappedLine[] {
  const lines: WrappedLine[] = [];
  for (const paragraph of text.split("\n")) {
    let isFirst = true;
    if (paragraph.length <= width) {
      lines.push({ text: paragraph, isContinuation: false });
    } else {
      const words = paragraph.split(/\s+/);
      let currentLine = "";
      for (const word of words) {
        if (currentLine.length + word.length + 1 <= width) {
          currentLine += (currentLine ? " " : "") + word;
        } else {
          if (currentLine) {
            lines.push({ text: currentLine, isContinuation: !isFirst });
            isFirst = false;
          }
          // Handle long words
          if (word.length > width) {
            for (let i = 0; i < word.length; i += width) {
              lines.push({ text: word.slice(i, i + width), isContinuation: !isFirst });
              isFirst = false;
            }
            currentLine = "";
          } else {
            currentLine = word;
          }
        }
      }
      if (currentLine) {
        lines.push({ text: currentLine, isContinuation: !isFirst });
      }
    }
  }
  return lines;
}

// Format entry for display
// displayIdx: position in filtered list (for cursor highlighting)
// originalIdx: position in full list (for selection tracking)
// visualRangeAddsNew: true if visual range contains unselected items (green), false if all overlap (red)
function formatEntry(
  entry: TranscriptEntry,
  displayIdx: number,
  cursor: number,
  selected: Set<number>,
  matchIndices: number[],
  currentMatchIdx: number,
  rangeStart: number | null,
  originalIdx: number,
  visualRangeAddsNew: boolean
): { prefix: string; uuid: string; time: string; type: string; preview: string; isCursor: boolean; isSelected: boolean; isVisualPreview: boolean; isMatch: boolean; isCurrentMatch: boolean; visualColor: string | undefined; isToolResult: boolean } {
  const uuid = getUuid(entry);
  const timestamp = getTimestamp(entry);
  const timeStr = timestamp ? timestamp.toISOString().substring(11, 19) : "        ";
  const uuidShort = uuid ? uuid.substring(0, 8) : "        ";

  let typeStr = entry.type;
  const isToolResult = entry.type === "user" && entry.toolUseResult;
  if (isToolResult) {
    typeStr = "tool-res";
  }

  const preview = extractPreviewText(entry).substring(0, 50).replace(/\n/g, " ");
  const isCursor = displayIdx === cursor;
  const isSelected = selected.has(originalIdx); // Use originalIdx for selection
  const matchIdx = matchIndices.indexOf(originalIdx); // Use originalIdx for match tracking
  const isMatch = matchIdx !== -1;
  const isCurrentMatch = isMatch && matchIdx === currentMatchIdx;

  // Visual mode preview (not yet confirmed) - uses displayIdx for range
  let isVisualPreview = false;
  if (rangeStart !== null) {
    const [start, end] = rangeStart <= cursor
      ? [rangeStart, cursor]
      : [cursor, rangeStart];
    isVisualPreview = displayIdx >= start && displayIdx <= end;
  }

  // Visual range color: green if adding new items, red if all already selected
  const visualColor = isVisualPreview ? (visualRangeAddsNew ? "green" : "red") : undefined;

  let prefix = "  ";
  if ((isSelected || isVisualPreview) && isCursor) prefix = "▸●";
  else if (isSelected || isVisualPreview) prefix = " ●";
  else if (isCursor) prefix = "▸ ";

  return { prefix, uuid: uuidShort, time: timeStr, type: typeStr, preview, isCursor, isSelected, isVisualPreview, isMatch, isCurrentMatch, visualColor, isToolResult: !!isToolResult };
}

// Main Picker Component
function Picker({ entries, sessionPath, onExit, onInteractiveExport }: PickerProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Calculate visible lines based on terminal height
  const terminalRows = stdout?.rows ?? 24;
  const VISIBLE_LINES = Math.max(5, terminalRows - HEADER_FOOTER_LINES);
  const EXPORT_VISIBLE_LINES = Math.max(5, terminalRows - EXPORT_HEADER_FOOTER_LINES);

  // Filter to renderable messages
  const renderableEntries = useMemo(
    () => entries.filter(isRenderableMessage),
    [entries]
  );

  // State
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeStart, setRangeStart] = useState<number | null>(null); // Idle by default, space starts visual
  const [cherrypickMode, setCherrypickMode] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedNoMatches, setSearchedNoMatches] = useState(false);
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectionHistory, setSelectionHistory] = useState<Set<number>[]>([]);
  const [redoHistory, setRedoHistory] = useState<Set<number>[]>([]);
  const [focusedPane, setFocusedPane] = useState<"history" | "preview">("history");
  const [previewScrollOffset, setPreviewScrollOffset] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [filterSnapshot, setFilterSnapshot] = useState<Set<number>>(new Set());
  const [exportPreviewMode, setExportPreviewMode] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [exportContentLines, setExportContentLines] = useState<WrappedLine[]>([]);
  const [exportScrollOffset, setExportScrollOffset] = useState(0);
  const [exportCursor, setExportCursor] = useState(0); // Cursor position in content (absolute line index)

  // Export dialog state
  const [dialogScreen, setDialogScreen] = useState<DialogScreen>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("single"); // For multiple ranges
  const [dialogCursor, setDialogCursor] = useState(0);
  const [filenameInput, setFilenameInput] = useState("");
  const [multiExportCast, setMultiExportCast] = useState(true);
  const [multiExportJsonl, setMultiExportJsonl] = useState(false);

  // Build search index
  const fuse = useMemo(() => {
    const searchable: SearchableEntry[] = renderableEntries.map((entry, idx) => ({
      idx,
      uuid: getUuid(entry),
      text: extractFullContent(entry),
      type: entry.type,
    }));
    return new Fuse(searchable, {
      keys: ["text"],
      threshold: 0.3,
      includeMatches: true,
    });
  }, [renderableEntries]);

  // Handle search
  const performSearch = (query: string) => {
    if (!query) {
      setMatchIndices([]);
      setCurrentMatchIdx(0);
      return;
    }
    const results = fuse.search(query);
    let indices = results.map((r) => r.item.idx);
    // When in Selected filter mode, only include matches within filterSnapshot
    if (historyFilter === "selected") {
      indices = indices.filter((idx) => filterSnapshot.has(idx));
    }
    setMatchIndices(indices);
    setCurrentMatchIdx(0);
    if (indices.length > 0 && indices[0] !== undefined) {
      setCursor(indices[0]);
      updateScrollForCursor(indices[0]);
    }
  };

  // Keep cursor in view
  const updateScrollForCursor = (newCursor: number) => {
    if (newCursor < scrollOffset) {
      setScrollOffset(newCursor);
    } else if (newCursor >= scrollOffset + VISIBLE_LINES) {
      setScrollOffset(newCursor - VISIBLE_LINES + 1);
    }
  };

  // Generate human-readable export content for preview and clipboard
  const generateExportContent = (): string => {
    if (selected.size === 0) return "No messages selected";

    const sortedSelected = Array.from(selected).sort((a, b) => a - b);
    const parts: string[] = [];

    for (const idx of sortedSelected) {
      const entry = renderableEntries[idx];
      if (!entry) continue;

      // Add header separator
      const uuid = getUuid(entry);
      const timestamp = getTimestamp(entry);
      const timeStr = timestamp ? timestamp.toISOString().substring(11, 19) : "unknown";
      const uuidShort = uuid ? uuid.substring(0, 8) : "unknown";

      let typeStr = entry.type;
      if (entry.type === "user" && entry.toolUseResult) {
        typeStr = "tool-result";
      }

      parts.push(`[${typeStr} ${timeStr} ${uuidShort}]`);

      // Add content
      const content = extractFullContent(entry);
      parts.push(content);
      parts.push(" "); // blank line before next message (space so Ink renders it)
    }

    return parts.join("\n").trimEnd();
  };

  // Helper function for executing export actions
  const executeExport = async (format: ExportFormat, filename?: string): Promise<void> => {
    const ranges = getSelectionRanges(selected, renderableEntries);
    if (ranges.length === 0) return;

    try {
      switch (format) {
        case "command": {
          const commands = ranges.map(r => generateCommandString(r, sessionPath)).join("\n");
          try {
            await clipboard.write(commands);
            setStatusMessage(`${ranges.length} command${ranges.length > 1 ? "s" : ""} copied`);
          } catch {
            setStatusMessage("Clipboard unavailable");
          }
          break;
        }
        case "uuids": {
          const uuids = ranges.map(r => generateUuidPair(r)).join("\n");
          try {
            await clipboard.write(uuids);
            setStatusMessage(`${ranges.length} UUID pair${ranges.length > 1 ? "s" : ""} copied`);
          } catch {
            setStatusMessage("Clipboard unavailable");
          }
          break;
        }
        case "jsonl": {
          if (filename) {
            const selectedEntries = getSelectedEntries(selected, renderableEntries);
            const content = generateJsonlContent(selectedEntries);
            const fullPath = resolve(process.cwd(), filename.endsWith(".jsonl") ? filename : `${filename}.jsonl`);
            await writeFile(fullPath, content, "utf-8");
            setStatusMessage(`Written: ${fullPath}`);
          }
          break;
        }
        case "cast": {
          if (filename) {
            const selectedEntries = getSelectedEntries(selected, renderableEntries);
            const theme = getTheme("tokyo-night");
            const result = convertToAsciicast(selectedEntries, {
              builder: { cols: 100, rows: 40 },
              timing: { preset: "default" },
              markers: { mode: "all" },
              render: { theme, width: 100 },
            });
            const content = serializeCast(result.document);
            const fullPath = resolve(process.cwd(), filename.endsWith(".cast") ? filename : `${filename}.cast`);
            await writeFile(fullPath, content, "utf-8");
            setStatusMessage(`Written: ${fullPath}`);
          }
          break;
        }
      }
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    setTimeout(() => setStatusMessage(null), 3000);
    setDialogScreen(null);
    setFilenameInput("");
    setDialogCursor(0);
  };

  // Helper function for exporting both .cast and .jsonl formats
  const executeBothExports = async (filename: string): Promise<void> => {
    const selectedEntries = getSelectedEntries(selected, renderableEntries);

    // Strip any extension user might have added
    const baseName = filename.replace(/\.(cast|jsonl)$/, "");

    try {
      // Export .cast
      const theme = getTheme("tokyo-night");
      const result = convertToAsciicast(selectedEntries, {
        builder: { cols: 100, rows: 40 },
        timing: { preset: "default" },
        markers: { mode: "all" },
        render: { theme, width: 100 },
      });
      const castContent = serializeCast(result.document);
      const castPath = resolve(process.cwd(), `${baseName}.cast`);
      await writeFile(castPath, castContent, "utf-8");

      // Export .jsonl
      const jsonlContent = generateJsonlContent(selectedEntries);
      const jsonlPath = resolve(process.cwd(), `${baseName}.jsonl`);
      await writeFile(jsonlPath, jsonlContent, "utf-8");

      setStatusMessage(`Written: ${baseName}.cast and .jsonl`);
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    setTimeout(() => setStatusMessage(null), 3000);
    setDialogScreen(null);
    setFilenameInput("");
    setDialogCursor(0);
  };

  // Helper function for exporting JSONL and launching interactive cast mode
  const executeAdvancedExport = async (): Promise<void> => {
    const selectedEntries = getSelectedEntries(selected, renderableEntries);
    const ranges = getSelectionRanges(selected, renderableEntries);
    const suggestedName = generateSuggestedFilename(ranges);

    try {
      // Export .jsonl only
      const jsonlContent = generateJsonlContent(selectedEntries);
      const jsonlPath = resolve(process.cwd(), `${suggestedName}.jsonl`);
      await writeFile(jsonlPath, jsonlContent, "utf-8");

      setStatusMessage(`Exported: ${suggestedName}.jsonl`);

      // Short delay to show the message before exiting
      setTimeout(() => {
        if (onInteractiveExport) {
          onInteractiveExport({ jsonlPath, sessionPath });
        }
        onExit([]);
        exit();
      }, 500);
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Input handling
  useInput((input, key) => {
    // Dialog input handling (highest priority)
    if (dialogScreen !== null) {
      // Escape: close dialog and return to export preview
      if (key.escape) {
        setDialogScreen(null);
        setFilenameInput("");
        setDialogCursor(0);
        return;
      }

      // Filename input screen
      if (dialogScreen === "filename") {
        if (key.return) {
          // Confirm filename - use input or auto-fill with suggested name
          const ranges = getSelectionRanges(selected, renderableEntries);
          const filename = filenameInput.trim() || generateSuggestedFilename(ranges);

          // Use format flags (same pattern for single and multi-range)
          if (multiExportCast && multiExportJsonl) {
            executeBothExports(filename);
          } else if (multiExportCast) {
            executeExport("cast", filename);
          } else {
            executeExport("jsonl", filename);
          }
          return;
        }
        if (key.backspace || key.delete) {
          setFilenameInput(s => s.slice(0, -1));
          return;
        }
        // Regular character input
        if (input && !key.ctrl && !key.meta && input.length === 1) {
          setFilenameInput(s => s + input);
          return;
        }
        return;
      }

      // Format selection screen (single range)
      if (dialogScreen === "format") {
        const formatOptions = 3; // .cast, .jsonl, Both
        const showAdvanced = multiExportCast; // Show "Advanced options" when .cast is selected
        const actionCount = showAdvanced ? 3 : 2; // Confirm, [Advanced options], Cancel

        if (key.upArrow || input === "k") {
          setDialogCursor(c => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow || input === "j") {
          setDialogCursor(c => Math.min(formatOptions + actionCount - 1, c + 1));
          return;
        }

        // Select format option (first 3 options)
        if (dialogCursor < formatOptions) {
          if (key.return || input === " ") {
            if (dialogCursor === 0) {
              // .cast only
              setMultiExportCast(true);
              setMultiExportJsonl(false);
            } else if (dialogCursor === 1) {
              // .jsonl only
              setMultiExportCast(false);
              setMultiExportJsonl(true);
            } else {
              // Both
              setMultiExportCast(true);
              setMultiExportJsonl(true);
            }
            return;
          }
        }

        // Action buttons
        if (dialogCursor === formatOptions) {
          // Confirm button
          if (key.return) {
            setDialogScreen("filename");
            setDialogCursor(0);
            return;
          }
        }

        if (showAdvanced && dialogCursor === formatOptions + 1) {
          // Advanced options button
          if (key.return) {
            executeAdvancedExport();
            return;
          }
        }

        const cancelIdx = showAdvanced ? formatOptions + 2 : formatOptions + 1;
        if (dialogCursor === cancelIdx) {
          // Cancel button
          if (key.return) {
            setDialogScreen(null);
            setDialogCursor(0);
            return;
          }
        }

        // 'y' key: copy command to clipboard
        if (input === "y") {
          if (statusMessage) return; // Debounce: skip if feedback already showing
          const ranges = getSelectionRanges(selected, renderableEntries);
          if (ranges.length > 0) {
            const commands = ranges.map(r => generateCommandString(r, sessionPath)).join("\n");
            setStatusMessage("Command copied");
            setTimeout(() => setStatusMessage(null), 2000);
            clipboard.write(commands).catch(() => {
              setStatusMessage("Clipboard unavailable");
              setTimeout(() => setStatusMessage(null), 2000);
            });
          }
          return;
        }

        return;
      }

      // Multiple ranges mode selection screen
      if (dialogScreen === "multimode") {
        const ranges = getSelectionRanges(selected, renderableEntries);
        const modeOptions = 2; // Single concatenated, Multiple ranges
        const formatOptions = 3; // .jsonl, .cast, both
        const showAdvanced = multiExportCast; // Show "Advanced options" when .cast is selected
        // Action count: Confirm + [Advanced options] + [Copy commands] + Cancel
        let actionCount = 2; // Confirm, Cancel
        if (showAdvanced) actionCount++;
        if (exportMode === "multiple") actionCount++;

        if (key.upArrow || input === "k") {
          setDialogCursor(c => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow || input === "j") {
          setDialogCursor(c => Math.min(modeOptions + formatOptions + actionCount - 1, c + 1));
          return;
        }

        // Mode selection (first 2 options)
        if (dialogCursor < modeOptions) {
          if (key.return || input === " ") {
            setExportMode(dialogCursor === 0 ? "single" : "multiple");
            return;
          }
        }

        // Format selection (next 3 options)
        if (dialogCursor >= modeOptions && dialogCursor < modeOptions + formatOptions) {
          if (key.return || input === " ") {
            const formatIdx = dialogCursor - modeOptions;
            if (formatIdx === 0) {
              // .jsonl only
              setMultiExportJsonl(true);
              setMultiExportCast(false);
            } else if (formatIdx === 1) {
              // .cast only
              setMultiExportJsonl(false);
              setMultiExportCast(true);
            } else {
              // both
              setMultiExportJsonl(true);
              setMultiExportCast(true);
            }
            return;
          }
        }

        // Action buttons
        const actionStart = modeOptions + formatOptions;
        let currentAction = actionStart;

        if (dialogCursor === currentAction) {
          // Confirm button
          if (key.return) {
            // For now, proceed to filename input
            setDialogScreen("filename");
            setDialogCursor(0);
            return;
          }
        }
        currentAction++;

        if (showAdvanced && dialogCursor === currentAction) {
          // Advanced options button
          if (key.return) {
            executeAdvancedExport();
            return;
          }
        }
        if (showAdvanced) currentAction++;

        if (exportMode === "multiple" && dialogCursor === currentAction) {
          // Copy commands button (only in multiple mode)
          if (key.return) {
            const commands = ranges.map(r => generateCommandString(r, sessionPath)).join("\n");
            setStatusMessage(`${ranges.length} commands copied`);
            clipboard.write(commands).catch(() => {
              setStatusMessage("Clipboard unavailable");
              setTimeout(() => setStatusMessage(null), 2000);
            });
            setTimeout(() => setStatusMessage(null), 2000);
            setDialogScreen(null);
            setDialogCursor(0);
            return;
          }
        }
        if (exportMode === "multiple") currentAction++;

        if (dialogCursor === currentAction) {
          // Cancel button
          if (key.return) {
            setDialogScreen(null);
            setDialogCursor(0);
            return;
          }
        }
        return;
      }

      return;
    }

    // Search results mode: block mode-changing keys, only allow n/N/Esc
    if (!searchMode && searchQuery) {
      // n: next match
      if (input === "n" && matchIndices.length > 0) {
        // Find next match after current cursor position
        const nextMatch = matchIndices.find(idx => idx > cursor);
        const nextIdx = nextMatch !== undefined
          ? matchIndices.indexOf(nextMatch)
          : 0; // Wrap to first match
        setCurrentMatchIdx(nextIdx);
        const newCursor = matchIndices[nextIdx];
        if (newCursor !== undefined) {
          setCursor(newCursor);
          updateScrollForCursor(newCursor);
          setPreviewScrollOffset(0);
        }
        return;
      }

      // N: previous match
      if (input === "N" && matchIndices.length > 0) {
        // Find previous match before current cursor position
        const prevMatches = matchIndices.filter(idx => idx < cursor);
        const prevMatch = prevMatches.length > 0 ? prevMatches[prevMatches.length - 1] : undefined;
        const prevIdx = prevMatch !== undefined
          ? matchIndices.indexOf(prevMatch)
          : matchIndices.length - 1; // Wrap to last match
        setCurrentMatchIdx(prevIdx);
        const newCursor = matchIndices[prevIdx];
        if (newCursor !== undefined) {
          setCursor(newCursor);
          updateScrollForCursor(newCursor);
          setPreviewScrollOffset(0);
        }
        return;
      }

      // j/k: manual navigation in search results
      if (key.downArrow || input === "j") {
        const maxCursor = filteredEntries.length - 1;
        const newCursor = Math.min(maxCursor, cursor + 1);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0);
        return;
      }
      if (key.upArrow || input === "k") {
        const newCursor = Math.max(0, cursor - 1);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0);
        return;
      }

      // Esc or /: back to search input mode
      if (key.escape || input === "/") {
        setSearchMode(true);
        return;
      }

      // Block all other keys in search results mode
      return;
    }

    // Shift+Tab: reverse cycle Preview → Selected → All
    if (key.tab && key.shift) {
      if (focusedPane === "preview") {
        // Preview → Selected
        setFocusedPane("history");
        setHistoryFilter("selected");
        setFilterSnapshot(new Set(selected));
        setScrollOffset(0);
        setCursor(0);
      } else if (historyFilter === "selected") {
        // Selected → All
        setHistoryFilter("all");
        setFilterSnapshot(new Set());
        setScrollOffset(0);
      } else {
        // All → Preview
        setFocusedPane("preview");
      }
      return;
    }

    // Tab: cycle through All → Selected → Preview tabs
    if (key.tab) {
      if (focusedPane === "preview") {
        // Preview → All
        setFocusedPane("history");
        setHistoryFilter("all");
        setFilterSnapshot(new Set());
        setScrollOffset(0);
      } else if (historyFilter === "all") {
        // All → Selected
        setHistoryFilter("selected");
        setFilterSnapshot(new Set(selected));
        setScrollOffset(0);
        setCursor(0);
      } else {
        // Selected → Preview
        setFocusedPane("preview");
      }
      return;
    }

    // Number keys: pane focus (1=left, 2=right)
    if (input === "1") {
      setFocusedPane("history");
      return;
    }
    if (input === "2") {
      setFocusedPane("preview");
      return;
    }

    // Export preview mode input handling
    if (exportPreviewMode) {
      // Escape: exit export preview
      if (key.escape) {
        setExportPreviewMode(false);
        return;
      }

      // j/k: move cursor with scroll-into-view
      if (key.downArrow || input === "j") {
        const maxCursor = exportContentLines.length - 1;
        const newCursor = Math.min(maxCursor, exportCursor + 1);
        setExportCursor(newCursor);
        // Scroll if cursor goes below visible area
        if (newCursor >= exportScrollOffset + EXPORT_VISIBLE_LINES) {
          setExportScrollOffset(newCursor - EXPORT_VISIBLE_LINES + 1);
        }
        return;
      }

      if (key.upArrow || input === "k") {
        const newCursor = Math.max(0, exportCursor - 1);
        setExportCursor(newCursor);
        // Scroll if cursor goes above visible area
        if (newCursor < exportScrollOffset) {
          setExportScrollOffset(newCursor);
        }
        return;
      }

      // Page navigation - scroll and cursor move together, maintaining relative position
      const pageJump = Math.max(1, EXPORT_VISIBLE_LINES - 3);
      if (key.pageDown || (key.ctrl && input === "d")) {
        const maxCursor = exportContentLines.length - 1;
        const maxOffset = Math.max(0, exportContentLines.length - EXPORT_VISIBLE_LINES);
        const newScrollOffset = Math.min(maxOffset, exportScrollOffset + pageJump);
        const scrollDelta = newScrollOffset - exportScrollOffset;
        const newCursor = Math.min(maxCursor, exportCursor + scrollDelta);
        setExportScrollOffset(newScrollOffset);
        setExportCursor(newCursor);
        return;
      }

      if (key.pageUp || (key.ctrl && input === "u")) {
        const newScrollOffset = Math.max(0, exportScrollOffset - pageJump);
        const scrollDelta = exportScrollOffset - newScrollOffset;
        const newCursor = Math.max(0, exportCursor - scrollDelta);
        setExportScrollOffset(newScrollOffset);
        setExportCursor(newCursor);
        return;
      }

      // g: jump to first line
      if (input === "g") {
        setExportCursor(0);
        setExportScrollOffset(0);
        return;
      }

      // G: jump to last line
      if (input === "G") {
        const maxCursor = exportContentLines.length - 1;
        const maxOffset = Math.max(0, exportContentLines.length - EXPORT_VISIBLE_LINES);
        setExportCursor(maxCursor);
        setExportScrollOffset(maxOffset);
        return;
      }

      // y: copy to clipboard
      if (input === "y") {
        if (statusMessage) return; // Debounce: skip if feedback already showing
        const lineCount = exportContentLines.length;
        setStatusMessage(`${lineCount} lines copied`);
        setTimeout(() => setStatusMessage(null), 2000);
        clipboard.write(exportContent).catch(() => {
          setStatusMessage("Clipboard unavailable");
          setTimeout(() => setStatusMessage(null), 2000);
        });
        return;
      }

      // Enter: open export dialog
      if (key.return) {
        const ranges = getSelectionRanges(selected, renderableEntries);
        if (ranges.length === 1) {
          setDialogScreen("format");
        } else {
          setDialogScreen("multimode");
        }
        setDialogCursor(0);
        setFilenameInput("");
        return;
      }

      // Ignore all other input in export preview mode
      return;
    }

    if (searchMode) {
      if (key.return) {
        // Check if search will find matches BEFORE updating state
        const results = fuse.search(searchQuery);
        let indices = results.map((r) => r.item.idx);
        if (historyFilter === "selected") {
          indices = indices.filter((idx) => filterSnapshot.has(idx));
        }

        performSearch(searchQuery);

        // Stay in search mode if no matches (let user edit query)
        if (indices.length === 0) {
          setSearchedNoMatches(true);
          return;
        }
        setSearchedNoMatches(false);
        setSearchMode(false);
      } else if (key.escape) {
        // Esc state machine: has query → clear query; empty → exit search
        if (searchQuery) {
          setSearchQuery("");
          setMatchIndices([]);
        } else {
          setSearchMode(false);
        }
      } else if (key.backspace || key.delete) {
        setSearchQuery((q) => q.slice(0, -1));
        setSearchedNoMatches(false);
      } else if (input && !key.ctrl && !key.meta) {
        setSearchQuery((q) => q + input);
        setSearchedNoMatches(false);
      }
      return;
    }

    // Navigation - route based on focused pane
    // Get current filtered list length for bounds
    const getFilteredLength = () => {
      if (historyFilter === "all") return renderableEntries.length;
      return Array.from(filterSnapshot).length;
    };

    if (key.upArrow || input === "k") {
      if (focusedPane === "history") {
        const newCursor = Math.max(0, cursor - 1);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0); // Reset preview scroll on cursor move
      } else {
        // Preview pane: scroll up
        setPreviewScrollOffset(Math.max(0, previewScrollOffset - 1));
      }
    }

    if (key.downArrow || input === "j") {
      if (focusedPane === "history") {
        const maxCursor = getFilteredLength() - 1;
        const newCursor = Math.min(maxCursor, cursor + 1);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0); // Reset preview scroll on cursor move
      } else {
        // Preview pane: scroll down (bounds checked in render)
        setPreviewScrollOffset(previewScrollOffset + 1);
      }
    }

    // Page navigation - route based on focused pane
    if (key.pageUp || (key.ctrl && input === "u")) {
      if (focusedPane === "history") {
        const newCursor = Math.max(0, cursor - VISIBLE_LINES);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0);
      } else {
        setPreviewScrollOffset(Math.max(0, previewScrollOffset - VISIBLE_LINES));
      }
    }

    if (key.pageDown || (key.ctrl && input === "d")) {
      if (focusedPane === "history") {
        const maxCursor = getFilteredLength() - 1;
        const newCursor = Math.min(maxCursor, cursor + VISIBLE_LINES);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0);
      } else {
        setPreviewScrollOffset(previewScrollOffset + VISIBLE_LINES);
      }
    }

    // Space: start visual, confirm range, or toggle (cherrypick)
    if (input === " ") {
      // Helper to get originalIdx for cursor position in filtered view
      const getOriginalIdx = (displayIdx: number): number => {
        if (historyFilter === "all") return displayIdx;
        const snapshotArr = Array.from(filterSnapshot).sort((a, b) => a - b);
        return snapshotArr[displayIdx] ?? displayIdx;
      };

      if (cherrypickMode) {
        // Toggle individual using originalIdx
        const origIdx = getOriginalIdx(cursor);
        setSelectionHistory((h) => [...h, new Set(selected)]);
        setSelected((s) => {
          const newSet = new Set(s);
          if (newSet.has(origIdx)) newSet.delete(origIdx);
          else newSet.add(origIdx);
          return newSet;
        });
      } else if (rangeStart === null) {
        // Start visual mode
        setRangeStart(cursor);
      } else {
        // Confirm visual range - convert display indices to original indices
        const [start, end] = rangeStart <= cursor ? [rangeStart, cursor] : [cursor, rangeStart];

        // Check if range adds new items or is all overlap
        let addsNew = false;
        for (let i = start; i <= end; i++) {
          const origIdx = getOriginalIdx(i);
          if (!selected.has(origIdx)) {
            addsNew = true;
            break;
          }
        }

        setSelectionHistory((h) => [...h, new Set(selected)]);
        setSelected((s) => {
          const newSet = new Set(s);
          for (let i = start; i <= end; i++) {
            const origIdx = getOriginalIdx(i);
            if (addsNew) {
              newSet.add(origIdx); // Green: add to selection
            } else {
              newSet.delete(origIdx); // Red: remove from selection
            }
          }
          return newSet;
        });
        setRangeStart(null); // Back to idle
      }
    }

    // c: toggle cherrypick mode
    if (input === "c") {
      setCherrypickMode(!cherrypickMode);
      setRangeStart(null); // Disable visual while cherrypicking
    }

    // Escape: exit search results → exit cherrypick → exit visual (doesn't quit picker)
    if (key.escape) {
      // If in search results navigation mode, go back to search input
      if (!searchMode && searchQuery) {
        setSearchMode(true);
        return;
      }
      if (cherrypickMode) {
        setCherrypickMode(false);
        setRangeStart(null);
        return;
      }
      if (rangeStart !== null) {
        setRangeStart(null);
        return;
      }
    }

    // Ctrl-C to exit
    if (key.ctrl && input === "c") {
      onExit([]);
      exit();
      return;
    }

    // Undo last selection change
    if (input === "u") {
      if (selectionHistory.length > 0) {
        const prev = selectionHistory[selectionHistory.length - 1];
        if (prev) {
          setRedoHistory((h) => [...h, new Set(selected)]);
          setSelected(prev);
          setSelectionHistory((h) => h.slice(0, -1));
          setStatusMessage("Undone");
          setTimeout(() => setStatusMessage(null), 1000);
        }
      }
    }

    // Redo (Ctrl+R)
    if (key.ctrl && input === "r") {
      if (redoHistory.length > 0) {
        const next = redoHistory[redoHistory.length - 1];
        if (next) {
          setSelectionHistory((h) => [...h, new Set(selected)]);
          setSelected(next);
          setRedoHistory((h) => h.slice(0, -1));
          setStatusMessage("Redone");
          setTimeout(() => setStatusMessage(null), 1000);
        }
      }
    }

    // Search
    if (input === "/") {
      setFocusedPane("history");
      setSearchMode(true);
      setSearchQuery("");
    }

    // Next/prev match
    if (input === "n" && matchIndices.length > 0) {
      const nextIdx = (currentMatchIdx + 1) % matchIndices.length;
      setCurrentMatchIdx(nextIdx);
      const newCursor = matchIndices[nextIdx];
      if (newCursor !== undefined) {
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
      }
    }

    if (input === "N" && matchIndices.length > 0) {
      const prevIdx = (currentMatchIdx - 1 + matchIndices.length) % matchIndices.length;
      setCurrentMatchIdx(prevIdx);
      const newCursor = matchIndices[prevIdx];
      if (newCursor !== undefined) {
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
      }
    }

    // Select all
    if (input === "a") {
      const all = new Set<number>();
      for (let i = 0; i < renderableEntries.length; i++) all.add(i);
      setSelected(all);
    }

    // Enter: open export preview (when not in visual select mode)
    if (key.return && rangeStart === null) {
      if (selected.size === 0) {
        setStatusMessage("No messages selected");
        setTimeout(() => setStatusMessage(null), 1500);
        return;
      }

      // Generate export preview content
      const content = generateExportContent();
      setExportContent(content);

      // Wrap content to terminal width
      const columns = stdout?.columns ?? 80;
      const estLineCount = content.split("\n").length * 2;
      const estNumWidth = Math.max(2, String(estLineCount).length);
      const wrapWidth = columns - 6 - estNumWidth - 2;
      const wrapped = wrapText(content, wrapWidth);
      setExportContentLines(wrapped);

      // Find highlighted message position
      const highlightedEntry = filteredEntries[cursor]?.entry;
      const highlightedUuid = highlightedEntry ? getUuid(highlightedEntry)?.substring(0, 8) : null;

      let targetLine = 0;
      if (highlightedUuid) {
        const headerPattern = new RegExp(`^\\[\\S+\\s+\\S+\\s+${highlightedUuid}\\]$`);
        targetLine = wrapped.findIndex(line => headerPattern.test(line.text));
        if (targetLine === -1) targetLine = 0;
      }

      const centeredOffset = Math.max(0, targetLine - Math.floor(EXPORT_VISIBLE_LINES / 2));
      const maxOffset = Math.max(0, wrapped.length - EXPORT_VISIBLE_LINES);
      setExportScrollOffset(Math.min(centeredOffset, maxOffset));
      setExportCursor(targetLine);
      setExportPreviewMode(true);
    }

    // Quit (q exits)
    if (input === "q") {
      onExit([]);
      exit();
    }
  });

  // Filtered entries based on history filter mode
  const filteredEntries = useMemo(() => {
    if (historyFilter === "all") {
      return renderableEntries.map((entry, idx) => ({ entry, originalIdx: idx }));
    }
    // Use snapshot to keep unselected items visible until filter is cycled
    return renderableEntries
      .map((entry, idx) => ({ entry, originalIdx: idx }))
      .filter(({ originalIdx }) => filterSnapshot.has(originalIdx));
  }, [renderableEntries, historyFilter, filterSnapshot]);

  // Clamp scroll offset to valid range for history pane
  const maxScrollOffset = Math.max(0, filteredEntries.length - VISIBLE_LINES);
  const clampedScrollOffset = Math.min(scrollOffset, maxScrollOffset);

  // Visible slice for history pane
  const visibleEntries = filteredEntries.slice(clampedScrollOffset, clampedScrollOffset + VISIBLE_LINES);

  // Compute whether visual range adds new items (for coloring)
  const visualRangeAddsNew = useMemo(() => {
    if (rangeStart === null) return false;
    const [start, end] = rangeStart <= cursor ? [rangeStart, cursor] : [cursor, rangeStart];
    // Check if any item in the visual range (by display index) is not already selected
    for (let displayIdx = start; displayIdx <= end; displayIdx++) {
      const item = filteredEntries[displayIdx];
      if (item && !selected.has(item.originalIdx)) {
        return true; // Found an unselected item, will add new
      }
    }
    return false; // All items in range already selected
  }, [rangeStart, cursor, filteredEntries, selected]);

  // Preview content - use the entry at cursor position in filtered list
  const PREVIEW_VISIBLE_LINES = VISIBLE_LINES;
  const PREVIEW_WIDTH = 60;
  const currentFilteredItem = filteredEntries[cursor];
  const currentEntry = currentFilteredItem?.entry;
  const previewContent = currentEntry ? extractFullContent(currentEntry) : "";
  const previewLines = wrapText(previewContent, PREVIEW_WIDTH - 4);

  // Clamp preview scroll offset to valid range
  const maxPreviewOffset = Math.max(0, previewLines.length - PREVIEW_VISIBLE_LINES);
  const clampedPreviewOffset = Math.min(previewScrollOffset, maxPreviewOffset);

  const visiblePreviewLines = previewLines.slice(
    clampedPreviewOffset,
    clampedPreviewOffset + PREVIEW_VISIBLE_LINES
  );

  // Type colors
  const getTypeColor = (type: string): string => {
    switch (type) {
      case "user": return "blue";
      case "assistant": return "magenta";
      case "system": return "yellow";
      case "tool-res": return "green";
      case "tool-result": return "green";
      default: return "white";
    }
  };

  // Render export content line with colored header detection and line numbers
  const terminalCols = stdout?.columns ?? 80;
  const logicalLineCount = exportContentLines.filter(l => !l.isContinuation).length;
  const numWidth = String(logicalLineCount).length;
  const lineWidth = terminalCols - 6 - numWidth - 2; // subtract borders, padding, line number, and separator
  const renderExportLine = (wrappedLine: WrappedLine, key: number, lineNum: number, isCurrentLine = false) => {
    const { text: line, isContinuation } = wrappedLine;
    const bgColor = isCurrentLine ? "#333333" : undefined;
    const padLine = (text: string) => text.padEnd(lineWidth, " ");
    // Show line number for first lines, padding for continuations
    const lineNumCol = isContinuation
      ? " ".repeat(numWidth + 2)
      : String(lineNum).padStart(numWidth) + "  ";
    // Detect header pattern: [type timestamp uuid]
    const headerMatch = line.match(/^\[(\S+)\s+(\S+)\s+(\S+)\]$/);
    if (headerMatch) {
      const [, type, time, uuid] = headerMatch;
      const headerText = `[${type} ${time} ${uuid}]`;
      const padding = " ".repeat(Math.max(0, lineWidth - headerText.length));
      return (
        <Text key={key} backgroundColor={bgColor}>
          <Text dimColor={!isCurrentLine}>{lineNumCol}</Text>
          <Text>[</Text>
          <Text color={getTypeColor(type || "")}>{type}</Text>
          <Text> </Text>
          <Text dimColor>{time} {uuid}</Text>
          <Text>]{padding}</Text>
        </Text>
      );
    }
    return (
      <Text key={key} backgroundColor={bgColor}>
        <Text dimColor={!isCurrentLine}>{lineNumCol}</Text>
        <Text>{padLine(line || " ")}</Text>
      </Text>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1} width="100%">
        <Text bold color="cyan">cc-prism pick</Text>
        <Text> │ </Text>
        <Text dimColor>{sessionPath.split("/").pop()}</Text>
      </Box>

      {dialogScreen !== null ? (
        <>
          {/* Dialog header */}
          <Box>
            {(() => {
              const ranges = getSelectionRanges(selected, renderableEntries);
              const range = ranges[0];
              const startUuid = range?.startUuid.substring(0, 8) ?? "????????";
              const endUuid = range?.endUuid.substring(0, 8) ?? "????????";
              const msgCount = selected.size;
              return (
                <>
                  <Text color="cyan">Exporting range: </Text>
                  <Text>{startUuid}-{endUuid}</Text>
                  <Text dimColor> - {msgCount} message{msgCount !== 1 ? "s" : ""}</Text>
                </>
              );
            })()}
          </Box>

          {/* Dialog content */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="magenta"
            paddingX={2}
            paddingY={1}
          >
            {dialogScreen === "format" && (() => {
              const showAdvanced = multiExportCast;
              const cancelIdx = showAdvanced ? 5 : 4;
              return (
                <Box flexDirection="column">
                  <Text bold color="cyan">Select format:</Text>
                  <Text> </Text>
                  <Text color={dialogCursor === 0 ? "yellow" : undefined}>
                    {dialogCursor === 0 ? "▸" : " "}
                    <Text color={multiExportCast && !multiExportJsonl ? "cyan" : undefined}>
                      ({multiExportCast && !multiExportJsonl ? "●" : " "}) .cast
                    </Text>
                  </Text>
                  <Text color={dialogCursor === 1 ? "yellow" : undefined}>
                    {dialogCursor === 1 ? "▸" : " "}
                    <Text color={multiExportJsonl && !multiExportCast ? "cyan" : undefined}>
                      ({multiExportJsonl && !multiExportCast ? "●" : " "}) .jsonl
                    </Text>
                  </Text>
                  <Text color={dialogCursor === 2 ? "yellow" : undefined}>
                    {dialogCursor === 2 ? "▸" : " "}
                    <Text color={multiExportCast && multiExportJsonl ? "cyan" : undefined}>
                      ({multiExportCast && multiExportJsonl ? "●" : " "}) Both
                    </Text>
                  </Text>
                  <Text> </Text>
                  <Text color={dialogCursor === 3 ? "green" : undefined} bold={dialogCursor === 3}>
                    {dialogCursor === 3 ? "▸" : " "} Confirm
                  </Text>
                  {showAdvanced && (
                    <Text color={dialogCursor === 4 ? "cyan" : undefined}>
                      {dialogCursor === 4 ? "▸" : " "} Advanced options
                    </Text>
                  )}
                  <Text color={dialogCursor === cancelIdx ? "red" : undefined}>
                    {dialogCursor === cancelIdx ? "▸" : " "} Cancel
                  </Text>
                </Box>
              );
            })()}

            {dialogScreen === "multimode" && (() => {
              const ranges = getSelectionRanges(selected, renderableEntries);
              const showAdvanced = multiExportCast;
              // Calculate button indices dynamically
              const confirmIdx = 5;
              const advancedIdx = showAdvanced ? 6 : -1;
              const copyIdx = exportMode === "multiple" ? (showAdvanced ? 7 : 6) : -1;
              const cancelIdx = showAdvanced
                ? (exportMode === "multiple" ? 8 : 7)
                : (exportMode === "multiple" ? 7 : 6);
              return (
                <Box flexDirection="column">
                  <Text bold color="cyan">Export {ranges.length} Ranges</Text>
                  <Text> </Text>
                  <Text color={dialogCursor === 0 ? "yellow" : undefined}>
                    {dialogCursor === 0 ? "▸" : " "}
                    <Text color={exportMode === "single" ? "cyan" : undefined}>
                      ({exportMode === "single" ? "●" : " "}) Single (Concatenated)
                    </Text>
                  </Text>
                  <Text color={dialogCursor === 1 ? "yellow" : undefined}>
                    {dialogCursor === 1 ? "▸" : " "}
                    <Text color={exportMode === "multiple" ? "cyan" : undefined}>
                      ({exportMode === "multiple" ? "●" : " "}) Multiple ranges
                    </Text>
                  </Text>
                  <Text> </Text>
                  <Text dimColor>
                    {exportMode === "multiple" ? `Exporting ${ranges.length} ranges, c` : "C"}hoose format:
                  </Text>
                  <Text color={dialogCursor === 2 ? "yellow" : undefined}>
                    {dialogCursor === 2 ? "▸" : " "}
                    <Text color={multiExportJsonl && !multiExportCast ? "cyan" : undefined}>
                      ({multiExportJsonl && !multiExportCast ? "●" : " "}) .jsonl
                    </Text>
                  </Text>
                  <Text color={dialogCursor === 3 ? "yellow" : undefined}>
                    {dialogCursor === 3 ? "▸" : " "}
                    <Text color={multiExportCast && !multiExportJsonl ? "cyan" : undefined}>
                      ({multiExportCast && !multiExportJsonl ? "●" : " "}) .cast
                    </Text>
                  </Text>
                  <Text color={dialogCursor === 4 ? "yellow" : undefined}>
                    {dialogCursor === 4 ? "▸" : " "}
                    <Text color={multiExportCast && multiExportJsonl ? "cyan" : undefined}>
                      ({multiExportCast && multiExportJsonl ? "●" : " "}) both
                    </Text>
                  </Text>
                  <Text> </Text>
                  <Text color={dialogCursor === confirmIdx ? "green" : undefined} bold={dialogCursor === confirmIdx}>
                    {dialogCursor === confirmIdx ? "▸" : " "} Confirm
                  </Text>
                  {showAdvanced && (
                    <Text color={dialogCursor === advancedIdx ? "cyan" : undefined}>
                      {dialogCursor === advancedIdx ? "▸" : " "} Advanced options
                    </Text>
                  )}
                  {exportMode === "multiple" && (
                    <Text color={dialogCursor === copyIdx ? "cyan" : undefined}>
                      {dialogCursor === copyIdx ? "▸" : " "} Copy commands
                    </Text>
                  )}
                  <Text color={dialogCursor === cancelIdx ? "red" : undefined}>
                    {dialogCursor === cancelIdx ? "▸" : " "} Cancel
                  </Text>
                </Box>
              );
            })()}

            {dialogScreen === "filename" && (() => {
              const ranges = getSelectionRanges(selected, renderableEntries);
              const suggestedName = generateSuggestedFilename(ranges);
              return (
                <Box flexDirection="column">
                  <Text bold color="cyan">Enter filename</Text>
                  <Text dimColor>(extension will be added automatically)</Text>
                  <Text> </Text>
                  <Box>
                    <Text color="yellow">Filename: </Text>
                    {filenameInput ? (
                      <>
                        <Text>{filenameInput}</Text>
                        <Text color="gray">█</Text>
                      </>
                    ) : (
                      <>
                        <Text dimColor>{suggestedName}</Text>
                        <Text color="gray">█</Text>
                      </>
                    )}
                  </Box>
                  <Text> </Text>
                  <Text dimColor>Press Enter to confirm, Esc to cancel</Text>
                </Box>
              );
            })()}
          </Box>

          {/* Status bar for dialog */}
          <Box marginTop={1} justifyContent="space-between">
            <Box>
              <Text backgroundColor="#F97583" color="black" bold> EXPORT </Text>
              <Text>  </Text>
              <Text color="#F97583">y</Text><Text dimColor>:copy command  </Text>
              <Text color="#F97583">Esc</Text><Text dimColor>:back</Text>
            </Box>
            {statusMessage && <Text color="cyan">{statusMessage}</Text>}
          </Box>
        </>
      ) : exportPreviewMode ? (
        <>
          {/* Export preview header */}
          <Box>
            <Text color="cyan">Export preview</Text>
            <Text dimColor> - {selected.size} message{selected.size !== 1 ? "s" : ""}</Text>
          </Box>

          {/* Full-width export content pane */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="cyan"
            paddingX={1}
          >
            <Box flexDirection="column">
              {(() => {
                // Count non-continuation lines before scroll offset to get starting line number
                let logicalLineNum = exportContentLines.slice(0, exportScrollOffset).filter(l => !l.isContinuation).length;
                return exportContentLines
                  .slice(exportScrollOffset, exportScrollOffset + EXPORT_VISIBLE_LINES)
                  .map((line, i) => {
                    if (!line.isContinuation) logicalLineNum++;
                    return renderExportLine(line, i, logicalLineNum, exportScrollOffset + i === exportCursor);
                  });
              })()}
            </Box>

            {/* Scroll indicator */}
            <Box justifyContent="space-between">
              <Text dimColor>
                {exportContentLines.length === 0
                  ? ""
                  : `${exportScrollOffset + 1}-${Math.min(exportScrollOffset + EXPORT_VISIBLE_LINES, exportContentLines.length)} of ${exportContentLines.length}`}
              </Text>
              <Text dimColor>j/k:scroll  ^d/^u:pgup/pgdown</Text>
            </Box>
          </Box>

          {/* Status bar for export preview */}
          <Box marginTop={1} justifyContent="space-between">
            <Box>
              <Text backgroundColor="#D4A843" color="black" bold> EXPORT </Text>
              <Text>  </Text>
              <Text color="#D4A843">Enter</Text><Text dimColor>:proceed  </Text>
              <Text color="#D4A843">Esc</Text><Text dimColor>:back  </Text>
              <Text color="#D4A843">y</Text><Text dimColor>:copy</Text>
            </Box>
            {statusMessage && <Text color="cyan">{statusMessage}</Text>}
          </Box>
        </>
      ) : (
        <>
          {/* Pane titles - aligned with pane borders below */}
          <Box flexDirection="row">
            <Box width="40%" paddingLeft={1}>
              <Text color={focusedPane === "history" ? "cyan" : undefined} bold={focusedPane === "history"}>[1]</Text>
              <Text> </Text>
              <Text color={historyFilter === "all" ? "cyan" : undefined}>All</Text>
              <Text> - </Text>
              <Text color={historyFilter === "selected" ? "cyan" : undefined}>Selected ({selected.size})</Text>
            </Box>
            <Box flexGrow={1} paddingLeft={1}>
              <Text color={focusedPane === "preview" ? "cyan" : undefined} bold={focusedPane === "preview"}>[2]</Text>
              <Text color={focusedPane === "preview" ? "cyan" : undefined}> Preview</Text>
            </Box>
          </Box>

          {/* Dual-pane area */}
          <Box flexDirection="row">
            {/* History Pane (Left) */}
            <Box
              flexDirection="column"
              justifyContent="space-between"
              borderStyle="single"
              borderColor={focusedPane === "history" ? "cyan" : "gray"}
              paddingX={1}
              width="40%"
              minHeight={VISIBLE_LINES + 3}
            >
              <Box flexDirection="column">
              {visibleEntries.map(({ entry, originalIdx }, i) => {
                const displayIdx = clampedScrollOffset + i; // Position in filtered list (for cursor)
                const uuid = getUuid(entry) ?? `idx-${originalIdx}`;
                const fmt = formatEntry(entry, displayIdx, cursor, selected, matchIndices, currentMatchIdx, rangeStart, originalIdx, visualRangeAddsNew);
                // Color priority: visual preview (green/red) > selected (cyan) > normal
                const prefixColor = fmt.isVisualPreview ? fmt.visualColor : (fmt.isSelected ? "cyan" : undefined);
                return (
                  <Text key={`${uuid}-${originalIdx}`} wrap="truncate">
                    <Text color={prefixColor} bold={fmt.isCursor}>
                      {fmt.prefix}
                    </Text>
                    <Text dimColor>{fmt.uuid} </Text>
                    <Text color={getTypeColor(fmt.type)}>{fmt.type.padEnd(9)} </Text>
                    {fmt.isToolResult && <Text dimColor>∟ </Text>}
                    <Text
                      color={fmt.isCurrentMatch ? "yellow" : fmt.isMatch ? "cyan" : undefined}
                      inverse={fmt.isCursor}
                    >
                      {fmt.preview}
                    </Text>
                  </Text>
                );
              })}
              </Box>
              <Box justifyContent="space-between">
                <Text>{selected.size > 0 ? <Text>{selected.size} selected</Text> : <Text dimColor>No selection</Text>}</Text>
                <Text dimColor>
                  {filteredEntries.length === 0
                    ? ""
                    : `${clampedScrollOffset + 1}-${Math.min(clampedScrollOffset + VISIBLE_LINES, filteredEntries.length)} of ${filteredEntries.length}`}
                </Text>
              </Box>
            </Box>

            {/* Preview Pane (Right) */}
            <Box
              flexDirection="column"
              justifyContent="space-between"
              borderStyle="single"
              borderColor={focusedPane === "preview" ? "cyan" : "gray"}
              paddingX={1}
              flexGrow={1}
              minHeight={VISIBLE_LINES + 3}
            >
              <Box flexDirection="column">
                {visiblePreviewLines.map((wrappedLine, i) => (
                  <Text key={i} wrap="truncate">{wrappedLine.text}</Text>
                ))}
              </Box>
              <Box justifyContent="flex-end">
                <Text dimColor>
                  {previewLines.length === 0
                    ? ""
                    : `${clampedPreviewOffset + 1}-${Math.min(clampedPreviewOffset + PREVIEW_VISIBLE_LINES, previewLines.length)} of ${previewLines.length}`}
                </Text>
              </Box>
            </Box>
          </Box>

          {/* Status bar */}
          <Box marginTop={1} justifyContent="space-between">
            <Box>
              {/* Vim-style mode indicator */}
              {searchMode || searchQuery ? (
                <Text backgroundColor="#D5B451" color="black" bold> SEARCH </Text>
              ) : cherrypickMode ? (
                <Text backgroundColor="#55A3E0" color="black" bold> CHERRYPICK </Text>
              ) : rangeStart !== null ? (
                <Text backgroundColor="#A6A8FA" color="black" bold> VISUAL </Text>
              ) : (
                <Text backgroundColor="#8BB372" color="black" bold> NORMAL </Text>
              )}
              <Text>  </Text>
              {/* Status info */}
              {statusMessage ? (
                <Text color="green">{statusMessage}</Text>
              ) : searchMode ? (
                <Text>
                  <Text color="green">/</Text>
                  {searchQuery ? (
                    <>
                      <Text bold>{searchQuery}</Text>
                      <Text color="gray">█</Text>
                      {searchedNoMatches ? (
                        <Text dimColor> No matches</Text>
                      ) : (
                        <Text dimColor> [Enter]</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text color="gray">█</Text>
                      <Text dimColor> type keyword</Text>
                    </>
                  )}
                </Text>
              ) : searchQuery && matchIndices.length > 0 ? (
                <Text>
                  <Text color="green">/</Text>
                  <Text color="green" bold>{searchQuery}</Text>
                  <Text color="green"> [{currentMatchIdx + 1}/{matchIndices.length}]</Text>
                  <Text dimColor> n/N:cycle</Text>
                </Text>
              ) : searchQuery && matchIndices.length === 0 ? (
                <Text>
                  <Text color="green">/</Text>
                  <Text bold>{searchQuery}</Text>
                  <Text color="gray">█</Text>
                  <Text dimColor> No matches</Text>
                </Text>
              ) : (
                <>
                  <Text color="#8BB372">Space</Text><Text dimColor>:select  </Text>
                  <Text color="#8BB372">Enter</Text><Text dimColor>:Export</Text>
                </>
              )}
            </Box>
          </Box>

          {/* Help */}
          <Box marginTop={1}>
            <Text dimColor>
              {searchMode || searchQuery
                ? "Esc:back"
                : "Tab:tabs  c:cherrypick  u:undo  /:search  q:quit"}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}

// Main export
export interface PickerResult {
  selections: Selection[];
  interactiveExport?: InteractiveExportResult;
}

export async function runPicker(
  entries: TranscriptEntry[],
  sessionPath: string
): Promise<PickerResult> {
  return new Promise((resolve) => {
    let interactiveResult: InteractiveExportResult | undefined;

    const { waitUntilExit } = render(
      <Picker
        entries={entries}
        sessionPath={sessionPath}
        onExit={(selections) => {
          resolve({ selections, interactiveExport: interactiveResult });
        }}
        onInteractiveExport={(result) => {
          interactiveResult = result;
        }}
      />
    );
    waitUntilExit().then(() => {
      // Ensure cleanup completes
    });
  });
}

export type { Selection };
