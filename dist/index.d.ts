/**
 * Type definitions for Claude Code session JSONL messages
 * Based on claude-code-log models and real session analysis
 */
interface TextContent {
    type: "text";
    text: string;
}
interface ThinkingContent {
    type: "thinking";
    thinking: string;
}
interface ToolUseContent {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}
interface ImageContent {
    type: "image";
    source: {
        type: "base64";
        media_type: string;
        data: string;
    };
}
type ContentItem = TextContent | ThinkingContent | ToolUseContent | ImageContent;
interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}
/** A single todo item from TodoWrite tool */
interface TodoItem {
    content: string;
    status: "pending" | "in_progress" | "completed";
    activeForm?: string;
}
/**
 * Tool use result object - shape varies by tool type.
 */
interface ToolUseResultObject {
    type?: "text" | "image";
    /** Content for simple tool results */
    content?: string;
    /** Read tool result with file content */
    file?: {
        filePath?: string;
        content?: string;
        numLines?: number;
        startLine?: number;
        totalLines?: number;
    };
    /** Stdout for Bash tool results */
    stdout?: string;
    /** Stderr for Bash tool results */
    stderr?: string;
    /** Interruption flag for Bash */
    interrupted?: boolean;
    /** Image flag */
    isImage?: boolean;
    is_error?: boolean;
    agentId?: string;
    /** For Glob results */
    filenames?: string[];
    durationMs?: number;
    numFiles?: number;
    truncated?: boolean;
    /** For TodoWrite results */
    oldTodos?: TodoItem[];
    newTodos?: TodoItem[];
    /** For WebFetch results */
    result?: string;
    url?: string;
    bytes?: number;
    code?: number;
    /** For WebSearch results */
    query?: string;
    results?: Array<{
        title?: string;
        url?: string;
        snippet?: string;
    } | string>;
    durationSeconds?: number;
}
/** Tool result can be an object or a plain error string */
type ToolUseResult = ToolUseResultObject | string;
/** Base fields present in most message types */
interface BaseMessage {
    timestamp: string;
    sessionId: string;
    uuid: string;
    parentUuid: string | null;
    isSidechain?: boolean;
}
/** User message - human prompts and tool results */
interface UserMessage extends BaseMessage {
    type: "user";
    userType: "human" | "external";
    cwd: string;
    version?: string;
    message: {
        role: "user";
        content: string | ContentItem[];
    };
    toolUseResult?: ToolUseResult;
    /** Meta messages (caveats, system info) should not use input animation */
    isMeta?: boolean;
}
/** Assistant message - Claude's responses */
interface AssistantMessage extends BaseMessage {
    type: "assistant";
    requestId?: string;
    message: {
        id: string;
        type: "message";
        role: "assistant";
        model: string;
        content: ContentItem[];
        stop_reason: "end_turn" | "tool_use" | null;
        usage?: TokenUsage;
    };
    context_management?: {
        type: "compacted";
        original_tokens?: TokenUsage;
        compacted_tokens?: TokenUsage;
    };
}
/** System message - warnings, info, errors */
interface SystemMessage {
    type: "system";
    timestamp: string;
    content: string | null;
    level?: "warning" | "info" | "error";
}
/** Summary message - auto-generated session summaries */
interface SummaryMessage {
    type: "summary";
    summary: string;
    leafUuid: string;
    cwd?: string;
}
/** Queue operation message - internal message queueing */
interface QueueOperationMessage {
    type: "queue-operation";
    operation: "enqueue" | "dequeue" | "remove" | "popAll";
    timestamp: string;
    sessionId?: string;
    content?: string | ContentItem[];
}
/** File history snapshot - internal file backup metadata (skip rendering) */
interface FileHistorySnapshotMessage {
    type: "file-history-snapshot";
    [key: string]: unknown;
}
/** Union of all message types */
type TranscriptEntry = UserMessage | AssistantMessage | SystemMessage | SummaryMessage | QueueOperationMessage | FileHistorySnapshotMessage;
/** Get the type-safe message type */
declare function getMessageType(entry: TranscriptEntry): TranscriptEntry["type"];
/** Type guard for user messages */
declare function isUserMessage(entry: TranscriptEntry): entry is UserMessage;
/** Type guard for assistant messages */
declare function isAssistantMessage(entry: TranscriptEntry): entry is AssistantMessage;
/** Type guard for system messages */
declare function isSystemMessage(entry: TranscriptEntry): entry is SystemMessage;
/** Type guard for summary messages */
declare function isSummaryMessage(entry: TranscriptEntry): entry is SummaryMessage;
/** Type guard for queue operation messages */
declare function isQueueOperationMessage(entry: TranscriptEntry): entry is QueueOperationMessage;
/** Type guard for file history snapshot messages */
declare function isFileHistorySnapshotMessage(entry: TranscriptEntry): entry is FileHistorySnapshotMessage;
/** Check if message should be rendered (skip internal types) */
declare function isRenderableMessage(entry: TranscriptEntry): entry is UserMessage | AssistantMessage | SystemMessage;

/**
 * asciicast v3 format types
 * Spec: https://docs.asciinema.org/manual/asciicast/v3/
 */
interface AsciicastTheme {
    fg: string;
    bg: string;
    palette: string;
}
/** Built-in theme presets */
declare const THEMES: Record<string, AsciicastTheme>;
interface SemanticColors {
    userPrompt: string;
    assistantText: string;
    toolName: string;
    toolBulletSuccess: string;
    toolBulletError: string;
    thinking: string;
    boxDrawing: string;
    filePath: string;
}
declare const TOKYO_NIGHT_SEMANTIC: SemanticColors;
interface AsciicastHeader {
    version: 3;
    term: {
        cols: number;
        rows: number;
        type?: string;
        theme?: AsciicastTheme;
    };
    timestamp?: number;
    title?: string;
    env?: Record<string, string>;
}
/** Output event - ANSI-encoded text */
type OutputEvent = [number, "o", string];
/** Marker event - navigation point */
type MarkerEvent = [number, "m", string];
/** Resize event - terminal dimension change */
type ResizeEvent = [number, "r", string];
type AsciicastEvent = OutputEvent | MarkerEvent | ResizeEvent;
interface AsciicastDocument {
    header: AsciicastHeader;
    events: AsciicastEvent[];
}
interface TimingConfig {
    /** Maximum pause between events (seconds) */
    maxWait: number;
    /** Pause before assistant response (seconds) */
    thinkingPause: number;
    /** Enable character-by-character typing effect */
    typingEffect: boolean;
    /** Characters per second when typing effect is enabled */
    typingSpeed: number;
}
declare const TIMING_PRESETS: Record<string, TimingConfig>;
type MarkerMode = "all" | "user" | "tools" | "none";
interface MarkerConfig {
    mode: MarkerMode;
    labelLength: number;
    pauseOnMarkers: boolean;
}
declare const DEFAULT_MARKER_CONFIG: MarkerConfig;

/**
 * JSONL file loader with agent file handling
 */

/** Parse a single JSONL line into a typed message */
declare function parseLine(line: string): TranscriptEntry | null;
/** Load and parse a JSONL transcript file */
declare function loadTranscript(filePath: string, options?: {
    loadAgents?: boolean;
    agentCache?: Map<string, TranscriptEntry[]>;
}): Promise<TranscriptEntry[]>;
/** Sort entries chronologically by timestamp */
declare function sortByTimestamp(entries: TranscriptEntry[]): TranscriptEntry[];
/** Get timestamp from entry (if available) */
declare function getTimestamp(entry: TranscriptEntry): Date | null;
/** Get UUID from entry (if available) */
declare function getUuid(entry: TranscriptEntry): string | null;
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
declare function interleaveToolCallsAndResults(entries: TranscriptEntry[]): TranscriptEntry[];

/**
 * Clip extraction - filter messages by UUID range, timestamp range, or last N
 */

interface ClipOptions {
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
declare function extractClip(entries: TranscriptEntry[], options?: ClipOptions): TranscriptEntry[];
/** Get summary of clip for display */
declare function getClipSummary(entries: TranscriptEntry[]): {
    total: number;
    user: number;
    assistant: number;
    tools: number;
    startTime: Date | null;
    endTime: Date | null;
};

/**
 * ANSI escape code utilities for terminal rendering
 * Provides 24-bit color support, text styling, and word wrapping with hard-breaking
 */
/** Reset all styling */
declare const RESET = "\u001B[0m";
declare const BOLD = "\u001B[1m";
declare const DIM = "\u001B[2m";
declare const ITALIC = "\u001B[3m";
declare const UNDERLINE = "\u001B[4m";
declare const STRIKETHROUGH = "\u001B[9m";
declare const RESET_BOLD = "\u001B[22m";
declare const RESET_DIM = "\u001B[22m";
declare const RESET_ITALIC = "\u001B[23m";
declare const RESET_UNDERLINE = "\u001B[24m";
declare const RESET_STRIKETHROUGH = "\u001B[29m";
/** Parse hex color to RGB tuple */
declare function hexToRgb(hex: string): [number, number, number];
/** Set foreground color using 24-bit RGB */
declare function fg(hex: string): string;
/** Set background color using 24-bit RGB */
declare function bg(hex: string): string;
/** Apply foreground color to text and reset */
declare function colorize(text: string, hex: string): string;
/** Apply foreground color and style to text */
declare function style(text: string, options: {
    fg?: string;
    bg?: string;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
}): string;
declare const BOX: {
    readonly horizontal: "─";
    readonly vertical: "│";
    readonly topLeft: "┌";
    readonly topRight: "┐";
    readonly bottomLeft: "└";
    readonly bottomRight: "┘";
    readonly teeRight: "├";
    readonly teeLeft: "┤";
    readonly teeDown: "┬";
    readonly teeUp: "┴";
    readonly cross: "┼";
    readonly roundTopLeft: "╭";
    readonly roundTopRight: "╮";
    readonly roundBottomLeft: "╰";
    readonly roundBottomRight: "╯";
    readonly doubleHorizontal: "═";
    readonly doubleVertical: "║";
    readonly bullet: "●";
    readonly bulletHollow: "○";
    readonly check: "✓";
    readonly crossMark: "✗";
    readonly arrow: "→";
    readonly arrowDown: "↓";
    readonly arrowSubagent: "⤵";
    readonly indent: "⎿";
};
/** Wrap text to specified width, preserving words when possible, hard-breaking when necessary */
declare function wordWrap(text: string, width: number): string[];
/** Truncate text with ellipsis */
declare function truncate(text: string, maxLength: number): string;
/** Indent each line of text */
declare function indent(text: string, spaces: number): string;
/** Remove ANSI escape codes for length calculation */
declare function stripAnsi(text: string): string;
/** Get visible length of text (excluding ANSI codes) */
declare function visibleLength(text: string): number;
/** Create a horizontal rule */
declare function horizontalRule(width: number, color?: string): string;
/** Save cursor position */
declare function saveCursor(): string;
/** Restore cursor position */
declare function restoreCursor(): string;
/** Move cursor to row, col (1-indexed) */
declare function moveTo(row: number, col?: number): string;
/** Move cursor to column (1-indexed) */
declare function moveToCol(col: number): string;
/** Erase from cursor to end of line */
declare function eraseToEndOfLine(): string;
/** Erase entire line */
declare function eraseLine(): string;
/** Set scroll region (top and bottom rows, 1-indexed) */
declare function setScrollRegion(top: number, bottom: number): string;
/** Reset scroll region to full terminal */
declare function resetScrollRegion(): string;
/** Create a box around text */
declare function box(content: string, options?: {
    width?: number;
    borderColor?: string;
    rounded?: boolean;
}): string;

/**
 * Theme configuration for rendering
 * Provides semantic colors for different message types
 */

/** Semantic colors for message rendering */
interface RenderTheme {
    /** Terminal foreground */
    fg: string;
    /** Terminal background */
    bg: string;
    /** User prompt prefix and text */
    userPrompt: string;
    /** User prompt background color */
    userPromptBg: string;
    /** Assistant response text */
    assistantText: string;
    /** Tool name in tool calls */
    toolName: string;
    /** Success bullet for tool calls */
    toolBulletSuccess: string;
    /** Error bullet for failed tool calls */
    toolBulletError: string;
    /** Thinking block text (dimmed) */
    thinking: string;
    /** Box drawing characters */
    boxDrawing: string;
    /** File paths in tool calls */
    filePath: string;
    /** Muted/secondary text */
    muted: string;
    /** Agent/sidechain indicator */
    agent: string;
    /** Diff: line background for additions */
    diffAddLineBg: string;
    /** Diff: character background for changed chars in additions */
    diffAddCharBg: string;
    /** Diff: line background for removals */
    diffRemoveLineBg: string;
    /** Diff: character background for changed chars in removals */
    diffRemoveCharBg: string;
}
/** Tokyo Night theme (default) */
declare const TOKYO_NIGHT: RenderTheme;
/** Tokyo Storm theme */
declare const TOKYO_STORM: RenderTheme;
/** Dracula theme */
declare const DRACULA: RenderTheme;
/** Nord theme */
declare const NORD: RenderTheme;
/** Catppuccin Mocha theme */
declare const CATPPUCCIN_MOCHA: RenderTheme;
/** All available render themes */
declare const RENDER_THEMES: Record<string, RenderTheme>;
/** Get render theme by name, defaulting to tokyo-night */
declare function getTheme(name: string): RenderTheme;
/** Convert render theme to asciicast theme for embedding */
declare function toAsciicastTheme(theme: RenderTheme): AsciicastTheme;

/**
 * Content normalization utilities for rendering
 * Handles extraction and formatting of message content
 */

/** Extract all text content from a ContentItem array */
declare function extractText(content: string | ContentItem[]): string;
/** Extract thinking content from a ContentItem array */
declare function extractThinking(content: ContentItem[]): string[];
/** Extract tool use items from a ContentItem array */
declare function extractToolUse(content: ContentItem[]): ToolUseContent[];
/** Check if content contains any tool use */
declare function hasToolUse(content: ContentItem[]): boolean;
/** Check if content contains thinking */
declare function hasThinking(content: ContentItem[]): boolean;
type ContentCategory = "text" | "tool-call" | "tool-result" | "thinking" | "mixed";
/** Classify what type of content a message contains */
declare function classifyContent(content: ContentItem[]): ContentCategory;
/** Get a summary label for a user message */
declare function getUserMessageLabel(msg: UserMessage, maxLength?: number): string;
/** Get a summary label for an assistant message */
declare function getAssistantMessageLabel(msg: AssistantMessage, maxLength?: number): string;
/** Get a short description of tool input for display */
declare function formatToolInputSummary(tool: ToolUseContent): string;
/** Truncate multi-line output with line count indicator */
declare function truncateOutput(text: string, maxLines: number, maxLineLength?: number): {
    text: string;
    truncated: boolean;
    hiddenLines: number;
};

/**
 * Message renderers - convert transcript entries to ANSI output
 */

interface RenderConfig {
    /** Theme to use for colors */
    theme: RenderTheme;
    /** Terminal width for word wrapping */
    width: number;
    /** Maximum lines for tool output */
    maxToolOutputLines: number;
    /** Show thinking blocks */
    showThinking: boolean;
    /** Indent for nested content */
    indentSize: number;
}
declare const DEFAULT_RENDER_CONFIG: RenderConfig;
/** Render a transcript entry to ANSI string */
declare function renderMessage(entry: TranscriptEntry, config?: Partial<RenderConfig>): string;
/** Extract plain text from content (string or ContentItem array) */
declare function extractTextContent(content: string | ContentItem[]): string;

/**
 * User input UI renderer - emulates Claude Code's command line interface
 * Renders a fixed-position input area at the bottom of the terminal
 * with burst typing animation and proper cursor positioning
 */

interface InputUIConfig {
    /** Theme for colors */
    theme: RenderTheme;
    /** Terminal width */
    width: number;
    /** Terminal height (rows) */
    height: number;
    /** Text always starts at this column (0-indexed) */
    textColumn: number;
}
/** Row positions for fixed input area (1-indexed for ANSI) */
interface InputAreaRows {
    /** Last row of scrolling content area */
    scrollEnd: number;
    /** Fixed spinner row (outside scroll region) */
    spinnerRow: number;
    /** Top horizontal line */
    topLine: number;
    /** Input row with arrow prompt */
    input: number;
    /** Bottom horizontal line */
    bottomLine: number;
}
/** Calculate input area row positions based on terminal height
 * Layout for height=40:
 *   rows 1-36: scroll region (content)
 *   row 37: spinner (fixed, outside scroll region)
 *   row 38: topLine (input frame border)
 *   row 39: input (prompt line)
 *   row 40: bottomLine (input frame border)
 */
declare function getInputAreaRows(height: number): InputAreaRows;
interface BurstTypingConfig {
    /** Initial delay between words (ms) */
    initialGapMs: number;
    /** Minimum delay between words (ms) */
    minGapMs: number;
    /** Decay factor per word (multiplied each time) */
    decayFactor: number;
}
interface InputTypedSegment {
    /** Text to output */
    text: string;
    /** Time offset from start (seconds) */
    time: number;
}
declare const DEFAULT_INPUT_UI_CONFIG: Omit<InputUIConfig, "theme">;
/**
 * Get the 1-indexed cursor column for the input area.
 * ANSI cursor positioning is 1-indexed, so textColumn (0-indexed) + 1.
 */
declare function getCursorColumn(config: InputUIConfig): number;
declare const DEFAULT_BURST_TYPING_CONFIG: BurstTypingConfig;
/**
 * Render the input UI frame (horizontal lines + arrow prompt)
 * Returns: [topLine, promptLine, bottomLine]
 */
declare function renderInputFrame(config: InputUIConfig): {
    topLine: string;
    promptPrefix: string;
    bottomLine: string;
};
/**
 * Wrap user text for input area, maintaining column 3 alignment
 * Returns lines with proper indentation for continuation lines
 */
declare function wrapInputText(text: string, config: InputUIConfig): string[];
/**
 * Split text into words for burst typing
 * Preserves spaces as separate tokens for accurate replay
 */
declare function splitIntoWords(text: string): string[];
/**
 * Generate burst typing segments for user input
 * Words appear as chunks, gaps between words shrink exponentially
 */
declare function generateBurstTypingSegments(text: string, startTime: number, config?: BurstTypingConfig): InputTypedSegment[];
interface InputAnimationResult {
    /** Segments for typing animation */
    segments: InputTypedSegment[];
    /** User prompt text formatted for scrolling area (→ text with wrapping) */
    scrollOutput: string;
    /** Total duration of animation (seconds) */
    duration: number;
}
/**
 * Generate the initial input area setup at the bottom of the terminal
 * This sets up the scroll region and renders the 3-line input frame
 *
 * Layout for height=40:
 *   rows 1-36: scroll region (content)
 *   row 37: spinner row (outside scroll region, fixed position)
 *   rows 38-40: input frame (topLine, input, bottomLine)
 */
declare function generateInputAreaSetup(config: InputUIConfig): string;
/**
 * Redraw the input frame (use after content output to restore corrupted frame)
 * This clears and redraws all 3 lines of the input area
 */
declare function redrawInputFrame(config: InputUIConfig): string;
/**
 * Generate complete input animation with fixed-position typing
 *
 * The animation:
 * 1. Types text in the input row with burst animation
 * 2. On "submit": clears input row, outputs user text to scrolling area
 * 3. Input area remains with empty prompt ready for next input
 */
declare function generateInputAnimation(text: string, startTime: number, uiConfig: InputUIConfig, typingConfig?: BurstTypingConfig): InputAnimationResult;

/**
 * Tool result extraction and rendering
 * Handles all Claude Code tool output formats (Read, Bash, Glob, TodoWrite, WebFetch, WebSearch, Task/Agent)
 */

/** Tool result object - flexible to accommodate all tool formats */
interface ToolResultContent {
    content?: string | Array<{
        type?: string;
        text?: string;
    }>;
    stdout?: string;
    stderr?: string;
    is_error?: boolean;
    type?: string;
    file?: {
        content?: string;
        filePath?: string;
    };
    filenames?: string[];
    oldTodos?: unknown[];
    newTodos?: unknown[];
    result?: string;
    url?: string;
    query?: string;
    results?: Array<{
        title?: string;
        url?: string;
        snippet?: string;
    } | string>;
}
/**
 * Renders tool execution result with proper formatting.
 *
 * Supports multiple Claude Code tool result formats:
 * - Standard: `{ content: string }`
 * - Read tool: `{ type: "text", file: { content: string, filePath: string } }`
 * - Bash tool: `{ stdout: string, stderr: string }`
 * - Glob tool: `{ filenames: string[] }`
 * - TodoWrite: `{ oldTodos: [], newTodos: [] }`
 * - Empty results: `{}` (renders as bullet only)
 *
 * Priority: content > file.content > stdout/stderr > filenames > TodoWrite
 */
declare function renderToolResult(result: ToolResultContent, cfg: RenderConfig): string;

/**
 * Tool name and argument formatting utilities
 * Converts tool metadata into display-friendly strings for terminal rendering
 */

/** Result of parsing and formatting a tool name */
interface FormattedToolName {
    displayName: string;
    isMcp: boolean;
}
/**
 * Parse MCP tool name into display format.
 * "mcp__chrome-devtools__click" -> { displayName: "chrome-devtools - click", isMcp: true }
 */
declare function formatToolName(name: string): FormattedToolName;
/**
 * Format tool arguments for display in tool call headers
 * Handles tool-specific argument extraction and truncation
 */
declare function formatToolArgs(tool: ToolUseContent, theme: RenderTheme, isMcp?: boolean): string;

/**
 * Slash command parsing and rendering for Claude Code CLI commands
 * Handles XML-formatted command tags in user messages
 */

/** Parsed slash command from XML tags */
interface ParsedCommand {
    /** Command name (e.g., "/clear", "/status") */
    name: string;
    /** Human-readable message (e.g., "clear", "status") */
    message: string;
    /** Command arguments (often empty) */
    args: string;
    /** Command stdout output (may be empty) */
    stdout: string;
}
/** Parsed bash mode command from XML tags */
interface ParsedBashCommand {
    /** The bash command that was executed */
    input: string;
    /** Standard output (may be empty) */
    stdout: string;
    /** Standard error (may be empty) */
    stderr: string;
}
/**
 * Parse command XML tags from user message content.
 * Returns parsed command if found, null otherwise.
 *
 * Expected format:
 * <command-name>/clear</command-name>
 * <command-message>clear</command-message>
 * <command-args></command-args>
 *
 * And optionally in a following message:
 * <local-command-stdout>output text</local-command-stdout>
 */
declare function parseCommandTags(content: string): ParsedCommand | null;
/**
 * Parse local-command-stdout tag from content.
 * Used for standalone stdout messages that follow command messages.
 */
declare function parseLocalCommandStdout(content: string): string | null;
/**
 * Check if content is a command message (starts with command tags, not just contains them)
 */
declare function isCommandMessage(content: string): boolean;
/**
 * Check if content is a bash mode message (starts with bash tags)
 */
declare function isBashMessage(content: string): boolean;
/**
 * Check if content is specifically a bash input message (command, not output)
 */
declare function isBashInputMessage(content: string): boolean;
/**
 * Parse bash-input tag from content.
 * Returns the command string if found, null otherwise.
 */
declare function parseBashInput(content: string): string | null;
/**
 * Parse bash-stdout and bash-stderr tags from content.
 * Returns parsed output if found, null otherwise.
 */
declare function parseBashOutput(content: string): {
    stdout: string;
    stderr: string;
} | null;
/** Configuration for command rendering */
interface CommandRenderConfig {
    theme: RenderTheme;
    width: number;
    maxOutputLines?: number;
}
/**
 * Render a parsed slash command for terminal display.
 * Format: [/command] args (if any)
 *         stdout (if non-empty)
 */
declare function renderSlashCommand(command: ParsedCommand, cfg: CommandRenderConfig): string;
/**
 * Render standalone local-command-stdout for terminal display.
 * Used when stdout appears in a separate message from the command.
 */
declare function renderLocalStdout(stdout: string, cfg: CommandRenderConfig): string;
/**
 * Render a bash mode command input for terminal display.
 * Format: [pink !][white command] on dark background
 */
declare function renderBashInput(command: string, cfg: CommandRenderConfig): string;
/**
 * Render bash mode output (stdout/stderr) for terminal display.
 * Format:   ⎿  output text (with tree connector)
 * Stderr is rendered in red, stdout in default/muted color.
 */
declare function renderBashOutput(output: {
    stdout: string;
    stderr: string;
}, cfg: CommandRenderConfig): string;

/**
 * asciicast document builder
 * Creates asciicast v3 format documents from rendered messages
 */

interface BuilderConfig {
    /** Terminal width */
    cols: number;
    /** Terminal height */
    rows: number;
    /** Terminal type */
    termType: string;
    /** Theme to embed */
    theme: AsciicastTheme;
    /** Recording title */
    title?: string;
    /** Recording timestamp (Unix seconds) */
    timestamp?: number;
}
declare const DEFAULT_BUILDER_CONFIG: BuilderConfig;
declare class AsciicastBuilder {
    private config;
    private events;
    private currentTime;
    private lastEventTime;
    constructor(config?: Partial<BuilderConfig>);
    /** Get the current timestamp */
    get time(): number;
    /** Set the current timestamp */
    set time(t: number);
    /** Add time to current timestamp */
    addTime(seconds: number): this;
    /** Add an output event (ANSI text) */
    output(text: string): this;
    /** Add output with a newline */
    outputLine(text: string): this;
    /** Add multiple lines of output */
    outputLines(lines: string[]): this;
    /** Add a marker event for navigation */
    marker(label: string): this;
    /** Add output and marker at the same time */
    outputWithMarker(text: string, markerLabel: string): this;
    /** Add a blank line */
    blank(): this;
    /** Add multiple blank lines */
    blanks(count: number): this;
    /** Clear the screen (ANSI escape sequence) */
    clear(): this;
    /** Build the header */
    buildHeader(): AsciicastHeader;
    /** Build the complete document */
    build(): AsciicastDocument;
    /** Get current event count */
    get eventCount(): number;
    /** Reset builder state (keeps config) */
    reset(): this;
}
/** Serialize asciicast document to .cast file format (NDJSON) */
declare function serializeCast(doc: AsciicastDocument): string;
/** Parse .cast file content back to document */
declare function parseCast(content: string): AsciicastDocument;

/**
 * Timing logic for asciicast generation
 * Handles timing presets and calculations
 */

interface TimingOptions extends TimingConfig {
    /** Preset name (overrides individual settings) */
    preset?: "speedrun" | "default" | "realtime";
}
declare function resolveTimingConfig(options: Partial<TimingOptions>): TimingConfig;
declare class TimingCalculator {
    private config;
    private lastTimestamp;
    private currentTime;
    constructor(config: TimingConfig);
    /** Get the current playback time */
    get time(): number;
    /** Set the current playback time (for syncing with external animation) */
    set time(value: number);
    /** Reset the calculator */
    reset(): void;
    /** Calculate time for next entry */
    nextEntry(entry: TranscriptEntry): number;
    /** Add pause for assistant response (thinking time) */
    addThinkingPause(): void;
    /** Add a fixed pause */
    addPause(seconds: number): void;
    /** Calculate typing duration for text */
    getTypingDuration(text: string): number;
    /** Check if typing effect is enabled */
    get hasTypingEffect(): boolean;
    /** Get the timing config */
    getConfig(): TimingConfig;
    private getDefaultPause;
}
interface TypedSegment {
    text: string;
    time: number;
}
/** Generate typing effect segments for text */
declare function generateTypingSegments(text: string, startTime: number, charsPerSecond: number, chunkSize?: number): TypedSegment[];
/** Generate line-by-line output with timing */
declare function generateLineSegments(text: string, startTime: number, lineDelay: number): TypedSegment[];

/**
 * Marker generation for asciicast navigation
 */

interface MarkerOptions {
    /** Which messages to create markers for */
    mode: MarkerMode;
    /** Maximum length for marker labels */
    labelLength: number;
}
declare const DEFAULT_MARKER_OPTIONS: MarkerOptions;
/** Check if a message should have a marker based on mode */
declare function shouldHaveMarker(entry: TranscriptEntry, mode: MarkerMode): boolean;
/** Generate marker label for an entry */
declare function generateMarkerLabel(entry: TranscriptEntry, maxLength?: number): string | null;

/**
 * Session to asciicast conversion
 * Main orchestration for generating .cast files from parsed sessions
 */

interface ConvertOptions {
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
interface ConvertResult {
    /** The generated asciicast document */
    document: AsciicastDocument;
    /** Statistics about the conversion */
    stats: ConvertStats;
}
interface ConvertStats {
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
/** Convert parsed session entries to asciicast document */
declare function convertToAsciicast(entries: TranscriptEntry[], options?: ConvertOptions): ConvertResult;
/** Convert session with common presets */
declare function convertWithPreset(entries: TranscriptEntry[], preset: "speedrun" | "default" | "realtime", theme?: RenderTheme): ConvertResult;
/** Quick conversion with defaults (default preset, all markers) */
declare function quickConvert(entries: TranscriptEntry[]): AsciicastDocument;
interface SessionInfo {
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
declare function getSessionInfo(entries: TranscriptEntry[]): SessionInfo;
/** Generate a title from session info */
declare function generateTitle(info: SessionInfo): string;

export { AsciicastBuilder, type AsciicastDocument, type AsciicastEvent, type AsciicastHeader, type AsciicastTheme, type AssistantMessage, BOLD, BOX, type BuilderConfig, type BurstTypingConfig, CATPPUCCIN_MOCHA, type ClipOptions, type CommandRenderConfig, type ContentCategory, type ContentItem, type ConvertOptions, type ConvertResult, type ConvertStats, DEFAULT_BUILDER_CONFIG, DEFAULT_BURST_TYPING_CONFIG, DEFAULT_INPUT_UI_CONFIG, DEFAULT_MARKER_CONFIG, DEFAULT_MARKER_OPTIONS, DEFAULT_RENDER_CONFIG, DIM, DRACULA, type FileHistorySnapshotMessage, type FormattedToolName, ITALIC, type ImageContent, type InputAnimationResult, type InputAreaRows, type InputTypedSegment, type InputUIConfig, type MarkerConfig, type MarkerEvent, type MarkerMode, type MarkerOptions, NORD, type OutputEvent, type ParsedBashCommand, type ParsedCommand, type QueueOperationMessage, RENDER_THEMES, RESET, RESET_BOLD, RESET_DIM, RESET_ITALIC, RESET_STRIKETHROUGH, RESET_UNDERLINE, type RenderConfig, type RenderTheme, type ResizeEvent, STRIKETHROUGH, type SemanticColors, type SessionInfo, type SummaryMessage, type SystemMessage, THEMES, TIMING_PRESETS, TOKYO_NIGHT, TOKYO_NIGHT_SEMANTIC, TOKYO_STORM, type TextContent, type ThinkingContent, TimingCalculator, type TimingConfig, type TimingOptions, type TodoItem, type TokenUsage, type ToolResultContent, type ToolUseContent, type ToolUseResult, type ToolUseResultObject, type TranscriptEntry, type TypedSegment, UNDERLINE, type UserMessage, bg, box, classifyContent, colorize, convertToAsciicast, convertWithPreset, eraseLine, eraseToEndOfLine, extractClip, extractText, extractTextContent, extractThinking, extractToolUse, fg, formatToolArgs, formatToolInputSummary, formatToolName, generateBurstTypingSegments, generateInputAnimation, generateInputAreaSetup, generateLineSegments, generateMarkerLabel, generateTitle, generateTypingSegments, getAssistantMessageLabel, getClipSummary, getCursorColumn, getInputAreaRows, getMessageType, getSessionInfo, getTheme, getTimestamp, getUserMessageLabel, getUuid, hasThinking, hasToolUse, hexToRgb, horizontalRule, indent, interleaveToolCallsAndResults, isAssistantMessage, isBashInputMessage, isBashMessage, isCommandMessage, isFileHistorySnapshotMessage, isQueueOperationMessage, isRenderableMessage, isSummaryMessage, isSystemMessage, isUserMessage, loadTranscript, moveTo, moveToCol, parseBashInput, parseBashOutput, parseCast, parseCommandTags, parseLine, parseLocalCommandStdout, quickConvert, redrawInputFrame, renderBashInput, renderBashOutput, renderInputFrame, renderLocalStdout, renderMessage, renderSlashCommand, renderToolResult, resetScrollRegion, resolveTimingConfig, restoreCursor, saveCursor, serializeCast, setScrollRegion, shouldHaveMarker, sortByTimestamp, splitIntoWords, stripAnsi, style, toAsciicastTheme, truncate, truncateOutput, visibleLength, wordWrap, wrapInputText };
