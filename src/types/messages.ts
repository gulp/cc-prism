/**
 * Type definitions for Claude Code session JSONL messages
 * Based on claude-code-log models and real session analysis
 */

// =============================================================================
// Content Types (used in both user and assistant messages)
// =============================================================================

export interface TextContent {
  type: "text";
  text: string;
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export type ContentItem =
  | TextContent
  | ThinkingContent
  | ToolUseContent
  | ImageContent;

// =============================================================================
// Token Usage
// =============================================================================

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// =============================================================================
// Tool Result (embedded in user messages)
// =============================================================================

/** A single todo item from TodoWrite tool */
export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

/**
 * Tool use result object - shape varies by tool type.
 */
export interface ToolUseResultObject {
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
  agentId?: string; // References agent-{agentId}.jsonl
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
  results?: Array<{ title?: string; url?: string; snippet?: string } | string>;
  durationSeconds?: number;
  /** For Task/Agent results - content array with text items */
  // Note: content can be string (standard) or array (Task result)
}

/** Tool result can be an object or a plain error string */
export type ToolUseResult = ToolUseResultObject | string;

// =============================================================================
// Message Types
// =============================================================================

/** Base fields present in most message types */
interface BaseMessage {
  timestamp: string;
  sessionId: string;
  uuid: string;
  parentUuid: string | null;
  isSidechain?: boolean;
}

/** User message - human prompts and tool results */
export interface UserMessage extends BaseMessage {
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
export interface AssistantMessage extends BaseMessage {
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
export interface SystemMessage {
  type: "system";
  timestamp: string;
  content: string | null;
  level?: "warning" | "info" | "error";
}

/** Summary message - auto-generated session summaries */
export interface SummaryMessage {
  type: "summary";
  summary: string;
  leafUuid: string;
  cwd?: string;
}

/** Queue operation message - internal message queueing */
export interface QueueOperationMessage {
  type: "queue-operation";
  operation: "enqueue" | "dequeue" | "remove" | "popAll";
  timestamp: string;
  sessionId?: string;
  content?: string | ContentItem[];
}

/** File history snapshot - internal file backup metadata (skip rendering) */
export interface FileHistorySnapshotMessage {
  type: "file-history-snapshot";
  [key: string]: unknown;
}

/** Union of all message types */
export type TranscriptEntry =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | SummaryMessage
  | QueueOperationMessage
  | FileHistorySnapshotMessage;

/** Get the type-safe message type */
export function getMessageType(
  entry: TranscriptEntry
): TranscriptEntry["type"] {
  return entry.type;
}

/** Type guard for user messages */
export function isUserMessage(entry: TranscriptEntry): entry is UserMessage {
  return entry.type === "user";
}

/** Type guard for assistant messages */
export function isAssistantMessage(
  entry: TranscriptEntry
): entry is AssistantMessage {
  return entry.type === "assistant";
}

/** Type guard for system messages */
export function isSystemMessage(
  entry: TranscriptEntry
): entry is SystemMessage {
  return entry.type === "system";
}

/** Type guard for summary messages */
export function isSummaryMessage(
  entry: TranscriptEntry
): entry is SummaryMessage {
  return entry.type === "summary";
}

/** Type guard for queue operation messages */
export function isQueueOperationMessage(
  entry: TranscriptEntry
): entry is QueueOperationMessage {
  return entry.type === "queue-operation";
}

/** Type guard for file history snapshot messages */
export function isFileHistorySnapshotMessage(
  entry: TranscriptEntry
): entry is FileHistorySnapshotMessage {
  return entry.type === "file-history-snapshot";
}

/** Check if message should be rendered (skip internal types) */
export function isRenderableMessage(
  entry: TranscriptEntry
): entry is UserMessage | AssistantMessage | SystemMessage {
  return (
    entry.type === "user" ||
    entry.type === "assistant" ||
    (entry.type === "system" && entry.content !== null)
  );
}
