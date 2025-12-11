/**
 * JSONL file loader with agent file handling
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { TranscriptEntry } from "../types/messages.js";

/** Parse a single JSONL line into a typed message */
export function parseLine(line: string): TranscriptEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as TranscriptEntry;
    return parsed;
  } catch {
    // Silently skip malformed lines
    return null;
  }
}

/** Load and parse a JSONL transcript file */
export async function loadTranscript(
  filePath: string,
  options: {
    loadAgents?: boolean;
    agentCache?: Map<string, TranscriptEntry[]>;
  } = {}
): Promise<TranscriptEntry[]> {
  const { loadAgents = true, agentCache = new Map() } = options;

  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const entries: TranscriptEntry[] = [];

  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) {
      entries.push(entry);

      // Check for agent references in tool results
      if (
        loadAgents &&
        entry.type === "user" &&
        entry.toolUseResult &&
        typeof entry.toolUseResult !== "string" &&
        entry.toolUseResult.agentId
      ) {
        const agentId = entry.toolUseResult.agentId;

        // Check cache first
        if (!agentCache.has(agentId)) {
          const agentPath = join(dirname(filePath), `agent-${agentId}.jsonl`);
          try {
            const agentEntries = await loadTranscript(agentPath, {
              loadAgents: true,
              agentCache,
            });
            agentCache.set(agentId, agentEntries);
          } catch {
            // Agent file may not exist or be inaccessible
            agentCache.set(agentId, []);
          }
        }

        // Mark agent entries as sidechain and insert after parent
        const agentEntries = agentCache.get(agentId) ?? [];
        for (const agentEntry of agentEntries) {
          if ("isSidechain" in agentEntry) {
            (agentEntry as { isSidechain: boolean }).isSidechain = true;
          }
          entries.push(agentEntry);
        }
      }
    }
  }

  // Interleave parallel tool calls with their results for logical ordering
  return interleaveToolCallsAndResults(entries);
}

/** Sort entries chronologically by timestamp */
export function sortByTimestamp(entries: TranscriptEntry[]): TranscriptEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = getTimestamp(a)?.getTime() ?? 0;
    const bTime = getTimestamp(b)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

/** Get timestamp from entry (if available) */
export function getTimestamp(entry: TranscriptEntry): Date | null {
  if (
    "timestamp" in entry &&
    typeof entry.timestamp === "string" &&
    entry.timestamp
  ) {
    return new Date(entry.timestamp);
  }
  return null;
}

/** Get UUID from entry (if available) */
export function getUuid(entry: TranscriptEntry): string | null {
  if ("uuid" in entry && typeof entry.uuid === "string" && entry.uuid) {
    return entry.uuid;
  }
  return null;
}

/** Check if an assistant message contains a tool call */
function isToolCallMessage(entry: TranscriptEntry): boolean {
  if (entry.type !== "assistant") return false;
  const content = entry.message?.content;
  if (!Array.isArray(content)) return false;
  return content.some((item) => item.type === "tool_use");
}

/** Check if a user message is a tool result */
function isToolResultMessage(entry: TranscriptEntry): boolean {
  if (entry.type !== "user") return false;
  return entry.toolUseResult !== undefined;
}

/**
 * Interleave parallel tool calls with their results.
 *
 * When Claude makes parallel tool calls, the JSONL stores them as:
 *   [call1, call2, call3, result1, result2, result3]
 *
 * This function reorders to logical conversation flow:
 *   [call1, result1, call2, result2, call3, result3]
 *
 * Detection: consecutive assistant messages with tool_use content,
 * followed by consecutive user messages with toolUseResult.
 * The results match calls by position (first result → first call, etc).
 */
export function interleaveToolCallsAndResults(
  entries: TranscriptEntry[]
): TranscriptEntry[] {
  const result: TranscriptEntry[] = [];
  let i = 0;

  while (i < entries.length) {
    // Collect consecutive tool calls
    const toolCalls: TranscriptEntry[] = [];
    while (i < entries.length && isToolCallMessage(entries[i]!)) {
      toolCalls.push(entries[i]!);
      i++;
    }

    // Collect consecutive tool results
    const toolResults: TranscriptEntry[] = [];
    while (i < entries.length && isToolResultMessage(entries[i]!)) {
      toolResults.push(entries[i]!);
      i++;
    }

    // Interleave if we have matching calls and results
    if (toolCalls.length > 0 && toolResults.length > 0) {
      const maxPairs = Math.min(toolCalls.length, toolResults.length);
      for (let j = 0; j < maxPairs; j++) {
        result.push(toolCalls[j]!);
        result.push(toolResults[j]!);
      }
      // Add any remaining unmatched entries
      for (let j = maxPairs; j < toolCalls.length; j++) {
        result.push(toolCalls[j]!);
      }
      for (let j = maxPairs; j < toolResults.length; j++) {
        result.push(toolResults[j]!);
      }
    } else {
      // No interleaving needed, add as-is
      for (const call of toolCalls) {
        result.push(call);
      }
      for (const res of toolResults) {
        result.push(res);
      }
    }

    // If we didn't collect any tool calls or results, add the current entry
    if (toolCalls.length === 0 && toolResults.length === 0 && i < entries.length) {
      result.push(entries[i]!);
      i++;
    }
  }

  return result;
}
