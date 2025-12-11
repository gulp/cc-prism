/**
 * Interactive session selector TUI using Ink
 */

import React, { useState, useEffect, useMemo } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import type { SessionInfo } from "./sessions.js";
import { formatAge, formatSize, getSessionPreview } from "./sessions.js";

// Types
interface SessionSelectorProps {
  sessions: SessionInfo[];
  onSelect: (path: string | null) => void;
}

interface SessionWithPreview extends SessionInfo {
  preview: string;
  messageCount: number;
  loading: boolean;
}

// Constants
const HEADER_LINES = 4; // Title + blank + help line + blank

function SessionSelector({ sessions, onSelect }: SessionSelectorProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Reverse order: oldest first, newest (latest) at bottom
  const reversedSessions = useMemo(() => [...sessions].reverse(), [sessions]);

  const [sessionsWithPreviews, setSessionsWithPreviews] = useState<
    SessionWithPreview[]
  >(() =>
    reversedSessions.map((s) => ({
      ...s,
      preview: "Loading...",
      messageCount: 0,
      loading: true,
    }))
  );

  // Start cursor at bottom (latest session)
  const [cursor, setCursor] = useState(reversedSessions.length - 1);

  // Calculate visible lines based on terminal height
  const terminalHeight = stdout?.rows ?? 24;
  const visibleLines = Math.max(3, terminalHeight - HEADER_LINES - 2);

  // Load previews for visible sessions
  useEffect(() => {
    let cancelled = false;

    async function loadPreviews() {
      for (let i = 0; i < reversedSessions.length; i++) {
        if (cancelled) break;

        const session = reversedSessions[i];
        try {
          const { firstMessage, messageCount } = await getSessionPreview(
            session.path
          );
          if (!cancelled) {
            setSessionsWithPreviews((prev) => {
              const updated = [...prev];
              updated[i] = {
                ...updated[i],
                preview: firstMessage,
                messageCount,
                loading: false,
              };
              return updated;
            });
          }
        } catch {
          if (!cancelled) {
            setSessionsWithPreviews((prev) => {
              const updated = [...prev];
              updated[i] = {
                ...updated[i],
                preview: "Error loading preview",
                messageCount: 0,
                loading: false,
              };
              return updated;
            });
          }
        }
      }
    }

    loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [reversedSessions]);

  // Handle input
  useInput((input, key) => {
    // Navigation
    if (input === "j" || key.downArrow) {
      setCursor((c) => Math.min(c + 1, sessionsWithPreviews.length - 1));
    }
    if (input === "k" || key.upArrow) {
      setCursor((c) => Math.max(c - 1, 0));
    }

    // Page navigation
    if (key.ctrl && input === "d") {
      setCursor((c) =>
        Math.min(c + Math.floor(visibleLines / 2), sessionsWithPreviews.length - 1)
      );
    }
    if (key.ctrl && input === "u") {
      setCursor((c) => Math.max(c - Math.floor(visibleLines / 2), 0));
    }

    // Jump to start/end
    if (input === "g") {
      setCursor(0);
    }
    if (input === "G") {
      setCursor(sessionsWithPreviews.length - 1);
    }

    // Select
    if (key.return) {
      const selected = sessionsWithPreviews[cursor];
      if (selected) {
        onSelect(selected.path);
        exit();
      }
    }

    // Cancel
    if (input === "q" || (key.ctrl && input === "c")) {
      onSelect(null);
      exit();
    }
  });

  // Calculate scroll window - each session takes ~3 lines (preview + metadata + spacing)
  // So we can show fewer sessions than terminal lines
  const sessionsPerScreen = Math.max(1, Math.floor(visibleLines / 3));
  const halfVisible = Math.floor(sessionsPerScreen / 2);

  // Ensure cursor is always visible by centering it in the viewport
  let scrollStart = Math.max(0, cursor - halfVisible);
  let scrollEnd = Math.min(
    sessionsWithPreviews.length,
    scrollStart + sessionsPerScreen
  );

  // Adjust scrollStart if we hit the end
  if (scrollEnd === sessionsWithPreviews.length) {
    scrollStart = Math.max(0, scrollEnd - sessionsPerScreen);
  }

  const visibleSessions = sessionsWithPreviews.slice(scrollStart, scrollEnd);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Select a session
        </Text>
        <Text dimColor> ({sessionsWithPreviews.length} sessions)</Text>
      </Box>

      {/* Session list */}
      <Box flexDirection="column">
        {visibleSessions.map((session, idx) => {
          const actualIdx = scrollStart + idx;
          const isSelected = actualIdx === cursor;

          return (
            <Box key={session.path} flexDirection="column">
              {/* First line: indicator + preview */}
              <Box>
                <Text color={isSelected ? "green" : "white"}>
                  {isSelected ? "❯ " : "  "}
                </Text>
                <Text
                  color={isSelected ? "white" : "gray"}
                  bold={isSelected}
                  wrap="truncate"
                >
                  {session.loading ? (
                    <Text dimColor>Loading...</Text>
                  ) : (
                    session.preview
                  )}
                </Text>
              </Box>

              {/* Second line: metadata */}
              <Box marginLeft={2}>
                <Text dimColor>
                  {formatAge(session.modified)} · {session.messageCount} messages · {formatSize(session.size)}
                </Text>
              </Box>

              {/* Spacing between entries */}
              {idx < visibleSessions.length - 1 && <Text> </Text>}
            </Box>
          );
        })}
      </Box>

      {/* Scroll indicator */}
      {sessionsWithPreviews.length > visibleLines && (
        <Box marginTop={1}>
          <Text dimColor>
            [{scrollStart + 1}-{scrollEnd} of {sessionsWithPreviews.length}]
          </Text>
        </Box>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text dimColor>
          j/k: navigate · Enter: select · q: cancel
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Run the session selector and return selected path (or null if cancelled)
 */
export async function runSessionSelector(
  sessions: SessionInfo[]
): Promise<string | null> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(
      <SessionSelector sessions={sessions} onSelect={resolve} />
    );
    waitUntilExit().then(() => {
      // Ensure cleanup completes
    });
  });
}
