/**
 * Session to asciicast conversion
 * Main orchestration for generating .cast files from parsed sessions
 */

import type { TranscriptEntry } from "../types/messages.js";
import type { AsciicastDocument } from "../types/asciicast.js";
import { AsciicastBuilder, type BuilderConfig } from "./builder.js";
import {
  TimingCalculator,
  resolveTimingConfig,
  type TimingOptions,
} from "./timing.js";
import {
  shouldHaveMarker,
  generateMarkerLabel,
  type MarkerOptions,
  DEFAULT_MARKER_OPTIONS,
} from "./markers.js";
import {
  renderMessage,
  extractTextContent,
  type RenderConfig,
  DEFAULT_RENDER_CONFIG,
} from "../renderer/messages.js";
import { toAsciicastTheme, type RenderTheme } from "../renderer/theme.js";
import {
  generateInputAnimation,
  generateInputAreaSetup,
  redrawInputFrame,
  getInputAreaRows,
  DEFAULT_BURST_TYPING_CONFIG,
  type InputUIConfig,
  type BurstTypingConfig,
} from "../renderer/input.js";
import { moveTo } from "../renderer/ansi.js";
import { isRenderableMessage } from "../types/messages.js";
import { isTodoWriteToolResult } from "../renderer/todos.js";
import { isBashInputMessage, parseBashInput, renderBashInput } from "../renderer/commands.js";
import {
  generateStatusSpinnerSegments,
  generateSpinnerClear,
  selectVerb,
  VERBS,
  DEFAULT_SPINNER_CONFIG,
  SpinnerMode,
  createSpinnerState,
  type SpinnerConfig,
  type SpinnerState,
} from "../renderer/spinner.js";

// =============================================================================
// Conversion Configuration
// =============================================================================

export interface ConvertOptions {
  /** Builder configuration (terminal size, title, etc.) */
  builder?: Partial<BuilderConfig>;
  /** Timing configuration */
  timing?: Partial<TimingOptions>;
  /** Marker configuration */
  markers?: Partial<MarkerOptions>;
  /** Render configuration */
  render?: Partial<RenderConfig>;
  /** Enable input animation for user prompts (Claude Code style UI) */
  inputAnimation?: boolean;
  /** Input animation timing config */
  inputAnimationConfig?: Partial<BurstTypingConfig>;
  /** Enable status spinner animation during thinking pauses */
  statusSpinner?: boolean;
  /** Duration of status spinner animation in seconds (default: 3.0) */
  spinnerDuration?: number;
}

export interface ConvertResult {
  /** The generated asciicast document */
  document: AsciicastDocument;
  /** Statistics about the conversion */
  stats: ConvertStats;
}

export interface ConvertStats {
  /** Total entries processed */
  entriesProcessed: number;
  /** Entries that were rendered */
  entriesRendered: number;
  /** Total events generated */
  eventsGenerated: number;
  /** Markers generated */
  markersGenerated: number;
  /** Total playback duration (seconds) */
  duration: number;
}

// =============================================================================
// Main Conversion Function
// =============================================================================

/** Convert parsed session entries to asciicast document */
export function convertToAsciicast(
  entries: TranscriptEntry[],
  options: ConvertOptions = {}
): ConvertResult {
  const renderConfig = { ...DEFAULT_RENDER_CONFIG, ...options.render };
  const markerOptions = { ...DEFAULT_MARKER_OPTIONS, ...options.markers };
  const timingConfig = resolveTimingConfig(options.timing ?? {});
  const inputAnimation = options.inputAnimation ?? false;
  const burstConfig: BurstTypingConfig = {
    ...DEFAULT_BURST_TYPING_CONFIG,
    ...options.inputAnimationConfig,
  };

  // Build asciicast theme from render theme
  const asciicastTheme = toAsciicastTheme(renderConfig.theme);

  // Create builder with theme
  const builder = new AsciicastBuilder({
    ...options.builder,
    theme: asciicastTheme,
  });

  // Get terminal dimensions for input animation
  const termRows = options.builder?.rows ?? 40;
  const termCols = options.builder?.cols ?? 100;

  // Create timing calculator
  const timing = new TimingCalculator(timingConfig);

  // Stats tracking
  let entriesRendered = 0;
  let markersGenerated = 0;

  // Input UI configuration (used for animation and cursor positioning)
  const inputConfig: InputUIConfig = {
    theme: renderConfig.theme,
    width: termCols,
    height: termRows,
    textColumn: 2,
  };
  // Set up fixed input area at start (if input animation enabled)
  if (inputAnimation) {
    builder.output(generateInputAreaSetup(inputConfig));
  }

  // Status spinner configuration
  const statusSpinner = options.statusSpinner ?? false;
  let currentActiveForm: string | null = null;

  // Seed messageIndex from first entry's timestamp for varied verb selection per session
  // This ensures different sessions get different verb sequences while remaining deterministic
  const firstTimestamp = entries[0] && "timestamp" in entries[0]
    ? new Date(entries[0].timestamp as string).getTime()
    : Date.now();
  let messageIndex = Math.abs(firstTimestamp | 0) % 1000; // Start at varied offset (0-999)

  // Verb rotation timing - prevents rapid switching during consecutive tool calls
  // Note: Use 2.0s since default timing preset compresses gaps to max 3s
  const MIN_VERB_INTERVAL = 2.0; // Minimum seconds between verb changes
  let lastVerbChangeTime = 0;
  let lastVerb: string | null = null; // Track last verb separately (spinner.verb gets cleared)

  // Spinner state machine - replaces scattered boolean flags
  const spinner: SpinnerState = createSpinnerState();

  const spinnerConfig: SpinnerConfig = {
    ...DEFAULT_SPINNER_CONFIG,
    theme: renderConfig.theme,
  };

  // Spinner row: use spinnerRow from InputAreaRows (outside scroll region) when input animation enabled
  // Layout for height=40: rows 1-36 (scroll), row 37 (spinner), rows 38-40 (input frame)
  const rows = getInputAreaRows(termRows);
  const spinnerRow = inputAnimation ? rows.spinnerRow : undefined;

  // Helper to start spinner (shows initial frame, marks as active)
  // Clears any existing spinner first, then starts a new one
  const startSpinner = (verb: string) => {
    // Clear existing spinner if active (handles user prompt transitions)
    if (spinner.mode !== SpinnerMode.OFF) {
      builder.output(generateSpinnerClear(spinner.row ?? undefined));
    }
    // Generate just the first frame to establish the spinner
    const segments = generateStatusSpinnerSegments(
      verb,
      builder.time,
      0.2, // Single frame
      spinnerConfig,
      spinnerRow
    );
    const firstSegment = segments[0];
    if (firstSegment) {
      builder.output(firstSegment.text);
    }
    // Update spinner state
    spinner.verb = verb;
    spinner.row = spinnerRow ?? null;
    spinner.mode = spinnerRow !== undefined ? SpinnerMode.FIXED : SpinnerMode.INLINE;
  };

  // Helper to continue spinner animation for a duration (fills time gap with animation)
  const continueSpinner = (duration: number) => {
    if (spinner.mode === SpinnerMode.OFF || !spinner.verb) return;
    if (duration <= 0) return;

    const segments = generateStatusSpinnerSegments(
      spinner.verb,
      builder.time,
      duration,
      spinnerConfig,
      spinner.row ?? undefined
    );
    for (const segment of segments) {
      builder.time = segment.time;
      builder.output(segment.text);
    }
  };

  // Helper to clear spinner and mark inactive
  // Note: redrawSpinner removed - in FIXED mode, spinner stays at fixed row (no redraw needed)
  // In INLINE mode, spinner scrolls away naturally (no redraw possible)
  const clearSpinner = () => {
    if (spinner.mode === SpinnerMode.OFF) return;
    builder.output(generateSpinnerClear(spinner.row ?? undefined));
    if (spinner.row !== null && inputAnimation) {
      // In fixed row mode, no need to redraw input frame - spinner row is separate
    } else if (spinner.row === null) {
      builder.output("\r\n"); // Add newline in inline mode
    }
    spinner.mode = SpinnerMode.OFF;
    spinner.verb = null;
    spinner.row = null;
  };

  // Helper to get verb with throttling - prevents rapid switching
  // Returns current verb if MIN_VERB_INTERVAL hasn't elapsed, otherwise selects new verb
  const getThrottledVerb = (): string => {
    const elapsed = builder.time - lastVerbChangeTime;

    // Reuse last verb if interval hasn't elapsed and we have one
    // Note: Use lastVerb instead of spinner.verb since clearSpinner() nulls spinner.verb
    if (lastVerb !== null && elapsed < MIN_VERB_INTERVAL) {
      messageIndex++; // Still increment for deterministic seeding
      return lastVerb;
    }

    // Select new verb and update timing
    const verb = currentActiveForm ?? selectVerb(VERBS, messageIndex);
    messageIndex++;
    lastVerbChangeTime = builder.time;
    lastVerb = verb;
    return verb;
  };

  // Note: We no longer start a spinner at the beginning of the recording.
  // Spinners only appear AFTER user prompts are rendered, not before.
  // This keeps the initial frame clean and matches expected UX flow.

  // Process each entry
  for (const entry of entries) {
    // Skip non-renderable entries
    if (!isRenderableMessage(entry)) {
      continue;
    }

    // Track activeForm from TodoWrite tool results for spinner verb
    if (statusSpinner && entry.type === "user" && "toolUseResult" in entry && entry.toolUseResult) {
      if (isTodoWriteToolResult(entry.toolUseResult)) {
        const inProgressTodo = entry.toolUseResult.newTodos.find(
          (t) => t.status === "in_progress"
        );
        currentActiveForm = inProgressTodo?.activeForm ?? null;
      }
    }

    // Check if this is a bash output message (stdout/stderr only - NOT bash-input)
    // bash-input should go through normal input animation, bash-output should not
    const isBashOutput = entry.type === "user" &&
      typeof entry.message?.content === "string" &&
      (entry.message.content.includes("<bash-stdout>") ||
       entry.message.content.includes("<bash-stderr>"));

    // Check if this is a "[Request interrupted by user]" message
    // Must NOT be a tool result to distinguish from tool output containing this text
    // Handle both string and array content formats
    const isInterruptMessage = entry.type === "user" &&
      !("toolUseResult" in entry && entry.toolUseResult) &&
      (
        // String content
        (typeof entry.message?.content === "string" &&
          entry.message.content.includes("[Request interrupted by user]")) ||
        // Array content
        (Array.isArray(entry.message?.content) &&
          entry.message.content.some((item) =>
            item.type === "text" && item.text?.includes("[Request interrupted by user]")
          ))
      );

    // Check if this is a system message with level "info" (like /status command output)
    const isSystemInfoMessage = entry.type === "system" &&
      "level" in entry && entry.level === "info";

    // Check if this is a meta message (system info like /status command output)
    const isMetaMessage = entry.type === "user" && "isMeta" in entry && entry.isMeta;

    // Check if this is a user prompt (not tool result, not meta, not bash output, not interrupt)
    const isUserPrompt =
      entry.type === "user" &&
      !("toolUseResult" in entry && entry.toolUseResult) &&
      !isMetaMessage &&
      !isBashOutput &&
      !isInterruptMessage;
    const useInputAnimation = inputAnimation && isUserPrompt;

    // Check if this is an assistant message with text content (final response, not just tool calls)
    // We should clear the spinner when the assistant produces actual text output
    const isAssistantWithText = entry.type === "assistant" &&
      entry.message.content.some((item) => item.type === "text" && item.text.trim() !== "");

    // Check if this is a tool call (assistant message with tool_use)
    const isToolCall = entry.type === "assistant" &&
      entry.message.content.some((item) => item.type === "tool_use");

    // Check if this is a simple tool call (no inline content like TodoWrite)
    // Simple tool calls get tight spacing with their results
    const isSimpleToolCall = isToolCall && entry.type === "assistant" &&
      !entry.message.content.some((item) =>
        item.type === "tool_use" && item.name === "TodoWrite"
      );

    // Check if this is a tool result (user message with toolUseResult)
    const isToolResult = entry.type === "user" && "toolUseResult" in entry && entry.toolUseResult;

    // Check if this is agentic content (thinking, tool calls, tool results)
    // Spinner should be active during agentic work
    const isAgenticContent =
      // Assistant with thinking or tool_use
      (entry.type === "assistant" &&
        entry.message.content.some((item) =>
          item.type === "thinking" || item.type === "tool_use"
        )) ||
      // Tool result (user message with toolUseResult)
      isToolResult;

    // Determine if spinner should clear for this message type
    // 1. Meta messages (isMeta user messages)
    // 2. System info messages (level: "info")
    // 3. Interrupt messages ("[Request interrupted by user]")
    // Note: User prompts are NOT in this list - startSpinner() handles the transition
    const shouldClearSpinner = isMetaMessage || isSystemInfoMessage || isInterruptMessage;

    // Calculate timing for this entry
    // Skip for input animation (handles its own timing)
    if (!useInputAnimation) {
      const previousTime = builder.time;
      const entryTime = timing.nextEntry(entry);

      // If spinner is active, fill the time gap with animation frames
      if (statusSpinner && spinner.mode !== SpinnerMode.OFF) {
        const timeDelta = entryTime - previousTime;
        if (timeDelta > 0) {
          continueSpinner(timeDelta);
        }
      }

      builder.time = entryTime;
    } else if (statusSpinner && spinner.mode !== SpinnerMode.OFF) {
      // Input animation mode: calculate timing gap and fill with spinner animation
      const previousTime = builder.time;
      const entryTime = timing.nextEntry(entry);
      const timeDelta = entryTime - previousTime;
      if (timeDelta > 0) {
        continueSpinner(timeDelta);
      }
      builder.time = entryTime;
    }

    // Clear spinner AFTER timing gap is filled (so animation plays first)
    if (statusSpinner && spinner.mode !== SpinnerMode.OFF && shouldClearSpinner) {
      clearSpinner();
    }

    // Handle spinner visibility for assistant text
    // In FIXED mode: spinner persists (it's outside scroll region, content can't overwrite it)
    // In INLINE mode: spinner already scrolled away, just mark OFF
    if (statusSpinner && spinner.mode === SpinnerMode.INLINE && isAssistantWithText) {
      // Inline mode: spinner already scrolled away, just mark state as OFF
      spinner.mode = SpinnerMode.OFF;
      spinner.verb = null;
      spinner.row = null;
    }

    // Generate marker if applicable
    if (shouldHaveMarker(entry, markerOptions.mode)) {
      const label = generateMarkerLabel(entry, markerOptions.labelLength);
      if (label) {
        builder.marker(label);
        markersGenerated++;
      }
    }

    // Check if this is a command message (should use renderMessage, not input animation)
    // Only user/assistant messages have .message property
    const entryText = "message" in entry ? extractTextContent(entry.message.content) : "";
    const isCommand = entryText.trim().startsWith("<command-name>") ||
                      entryText.trim().startsWith("<local-command-stdout>");

    if (useInputAnimation && !isCommand) {
      // Use Claude Code style fixed-position input animation
      // For bash-input, extract just the command for typing (not the XML tags)
      const isBashInput = typeof entry.message?.content === "string" &&
        isBashInputMessage(entry.message.content);
      const text = isBashInput
        ? `! ${parseBashInput(entry.message.content as string)!}`
        : entryText;
      if (!text.trim()) continue;

      const inputConfig: InputUIConfig = {
        theme: renderConfig.theme,
        width: termCols,
        height: termRows,
        textColumn: 2,
      };

      const animation = generateInputAnimation(
        text,
        builder.time,
        inputConfig,
        burstConfig
      );

      // Output each segment with timing (typing animation in input area)
      for (const segment of animation.segments) {
        builder.time = segment.time;
        builder.output(segment.text);
      }

      // Output the user prompt to scrolling area
      // For bash-input messages, render with ! prefix styling instead of default prompt
      if (isBashInput) {
        const bashCmd = parseBashInput(entry.message.content as string)!;
        const bashOutput = renderBashInput(bashCmd, { theme: renderConfig.theme, width: termCols });
        builder.output(bashOutput.replace(/\n/g, "\r\n") + "\r\n");
      } else {
        builder.output(animation.scrollOutput);
      }

      // Redraw input frame after scroll output (may have been corrupted)
      builder.output(redrawInputFrame(inputConfig));

      // Sync timing calculator with animation end time
      timing.time = builder.time;

      // Start spinner after user prompt (just first frame)
      // Spinner will continue animating as subsequent entries add time gaps
      if (statusSpinner) {
        startSpinner(getThrottledVerb());
      }
    } else {
      // Standard rendering
      const rendered = renderMessage(entry, renderConfig);
      if (!rendered) continue;

      // Convert \n to \r\n for proper terminal line endings
      // Use single newline after simple tool calls and bash input so results attach directly
      const isBashInput = entry.type === "user" &&
        typeof entry.message?.content === "string" &&
        entry.message.content.includes("<bash-input>");
      const trailing = (isSimpleToolCall || isBashInput || isBashOutput) ? "\r\n" : "\r\n\r\n";
      const output = rendered.replace(/\n/g, "\r\n") + trailing;

      // When using input animation, position in scroll region first
      // Use scrollEnd - 1 to avoid boundary issues where content overwrites instead of scrolling
      if (inputAnimation) {
        builder.output(moveTo(rows.scrollEnd - 1, 1) + "\r\n");
      }

      // Regular output (no typing effect when using input animation)
      builder.output(output);

      // Redraw input frame after output (may have been corrupted by scroll/wrap)
      if (inputAnimation) {
        builder.output(redrawInputFrame(inputConfig));
      }

      // Spinner handling for standard rendering path
      if (statusSpinner) {
        if (isUserPrompt) {
          // Start spinner after user prompt (just first frame)
          startSpinner(getThrottledVerb());
        } else if (isAgenticContent && spinner.mode === SpinnerMode.OFF) {
          // Start spinner after agentic content if not already active
          // This handles clips that start mid-conversation with thinking/tool calls
          startSpinner(getThrottledVerb());
        }
        // Note: No redrawSpinner() needed anymore
        // In FIXED mode: spinner is outside scroll region, stays visible automatically
        // In INLINE mode: spinner scrolls away naturally with content
      }
    }

    entriesRendered++;
  }

  // Build final document
  const document = builder.build();

  return {
    document,
    stats: {
      entriesProcessed: entries.length,
      entriesRendered,
      eventsGenerated: document.events.length,
      markersGenerated,
      duration: builder.time,
    },
  };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/** Convert session with common presets */
export function convertWithPreset(
  entries: TranscriptEntry[],
  preset: "speedrun" | "default" | "realtime",
  theme?: RenderTheme
): ConvertResult {
  return convertToAsciicast(entries, {
    timing: { preset },
    render: theme ? { theme } : undefined,
  });
}

/** Quick conversion with defaults (default preset, all markers) */
export function quickConvert(entries: TranscriptEntry[]): AsciicastDocument {
  return convertToAsciicast(entries).document;
}

// =============================================================================
// Session Info Extraction
// =============================================================================

export interface SessionInfo {
  /** First message timestamp */
  startTime: Date | null;
  /** Last message timestamp */
  endTime: Date | null;
  /** Number of user messages (excluding tool results) */
  userMessages: number;
  /** Number of assistant messages */
  assistantMessages: number;
  /** Number of tool calls */
  toolCalls: number;
  /** Whether session contains agent/sidechain messages */
  hasAgents: boolean;
}

/** Extract session info for title/description generation */
export function getSessionInfo(entries: TranscriptEntry[]): SessionInfo {
  let startTime: Date | null = null;
  let endTime: Date | null = null;
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let hasAgents = false;

  for (const entry of entries) {
    // Track timestamps
    if ("timestamp" in entry && typeof entry.timestamp === "string") {
      const timestamp = new Date(entry.timestamp);
      if (!startTime || timestamp < startTime) startTime = timestamp;
      if (!endTime || timestamp > endTime) endTime = timestamp;
    }

    // Track sidechain
    if ("isSidechain" in entry && entry.isSidechain) {
      hasAgents = true;
    }

    // Count message types
    if (entry.type === "user") {
      if (!entry.toolUseResult) {
        userMessages++;
      }
    } else if (entry.type === "assistant") {
      assistantMessages++;
      // Count tool calls
      for (const item of entry.message.content) {
        if (item.type === "tool_use") {
          toolCalls++;
        }
      }
    }
  }

  return {
    startTime,
    endTime,
    userMessages,
    assistantMessages,
    toolCalls,
    hasAgents,
  };
}

/** Generate a title from session info */
export function generateTitle(info: SessionInfo): string {
  const parts: string[] = ["Claude Code Session"];

  if (info.toolCalls > 0) {
    parts.push(`(${info.toolCalls} tool calls)`);
  }

  return parts.join(" ");
}
