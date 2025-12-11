/**
 * Clip extraction - filter messages by UUID range, timestamp range, or last N
 */

import type { TranscriptEntry } from "../types/messages.js";
import { getTimestamp, getUuid, sortByTimestamp } from "./loader.js";

export interface ClipOptions {
  /** Start extraction from this message UUID (inclusive) */
  startUuid?: string;
  /** End extraction at this message UUID (inclusive) */
  endUuid?: string;
  /** Start extraction from this timestamp (ISO 8601) */
  startTime?: string;
  /** End extraction at this timestamp (ISO 8601) */
  endTime?: string;
  /** Extract last N messages */
  last?: number;
}

/**
 * Extract a clip from transcript entries based on filtering options
 *
 * Priority:
 * 1. If `last` is specified, return the last N renderable messages
 * 2. If UUID range is specified, extract messages between start and end UUID
 * 3. If time range is specified, extract messages within time range
 * 4. If no options, return all entries
 */
export function extractClip(
  entries: TranscriptEntry[],
  options: ClipOptions = {}
): TranscriptEntry[] {
  const { startUuid, endUuid, startTime, endTime, last } = options;

  // Sort by timestamp for consistent ordering
  let sorted = sortByTimestamp(entries);

  // Handle --last N option (highest priority)
  if (last !== undefined) {
    if (last <= 0) {
      return [];
    }
    // Filter to renderable messages only for counting
    const renderable = sorted.filter(isRenderableForClip);
    const startIndex = Math.max(0, renderable.length - last);
    return renderable.slice(startIndex);
  }

  // Handle UUID range filtering
  if (startUuid || endUuid) {
    sorted = filterByUuidRange(sorted, startUuid, endUuid);
  }

  // Handle time range filtering
  if (startTime || endTime) {
    sorted = filterByTimeRange(sorted, startTime, endTime);
  }

  return sorted;
}

/** Filter entries by UUID range (inclusive) */
function filterByUuidRange(
  entries: TranscriptEntry[],
  startUuid?: string,
  endUuid?: string
): TranscriptEntry[] {
  let startIndex = 0;
  let endIndex = entries.length;

  if (startUuid) {
    const idx = entries.findIndex((e) => getUuid(e) === startUuid);
    if (idx !== -1) {
      startIndex = idx;
    }
  }

  if (endUuid) {
    const idx = entries.findIndex((e) => getUuid(e) === endUuid);
    if (idx !== -1) {
      endIndex = idx + 1; // inclusive
    }
  }

  return entries.slice(startIndex, endIndex);
}

/** Filter entries by time range (inclusive) */
function filterByTimeRange(
  entries: TranscriptEntry[],
  startTime?: string,
  endTime?: string
): TranscriptEntry[] {
  const startDate = startTime ? new Date(startTime) : null;
  const endDate = endTime ? new Date(endTime) : null;

  return entries.filter((entry) => {
    const timestamp = getTimestamp(entry);
    if (!timestamp) return true; // Include entries without timestamps

    if (startDate && timestamp < startDate) return false;
    if (endDate && timestamp > endDate) return false;

    return true;
  });
}

/** Check if an entry should be counted for clip extraction */
function isRenderableForClip(entry: TranscriptEntry): boolean {
  switch (entry.type) {
    case "user":
    case "assistant":
      return true;
    case "system":
      return entry.content !== null;
    case "queue-operation":
      // Include 'remove' operations as they represent user steering
      return entry.operation === "remove";
    case "summary":
    case "file-history-snapshot":
      return false;
    default:
      return false;
  }
}

/** Get summary of clip for display */
export function getClipSummary(entries: TranscriptEntry[]): {
  total: number;
  user: number;
  assistant: number;
  tools: number;
  startTime: Date | null;
  endTime: Date | null;
} {
  let user = 0;
  let assistant = 0;
  let tools = 0;
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  for (const entry of entries) {
    const timestamp = getTimestamp(entry);

    if (timestamp) {
      if (!startTime || timestamp < startTime) startTime = timestamp;
      if (!endTime || timestamp > endTime) endTime = timestamp;
    }

    if (entry.type === "user") {
      if (entry.toolUseResult) {
        tools++;
      } else {
        user++;
      }
    } else if (entry.type === "assistant") {
      assistant++;
    }
  }

  return {
    total: entries.length,
    user,
    assistant,
    tools,
    startTime,
    endTime,
  };
}
