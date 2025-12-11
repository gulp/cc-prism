// src/types/messages.ts
function getMessageType(entry) {
  return entry.type;
}
function isUserMessage(entry) {
  return entry.type === "user";
}
function isAssistantMessage(entry) {
  return entry.type === "assistant";
}
function isSystemMessage(entry) {
  return entry.type === "system";
}
function isSummaryMessage(entry) {
  return entry.type === "summary";
}
function isQueueOperationMessage(entry) {
  return entry.type === "queue-operation";
}
function isFileHistorySnapshotMessage(entry) {
  return entry.type === "file-history-snapshot";
}
function isRenderableMessage(entry) {
  return entry.type === "user" || entry.type === "assistant" || entry.type === "system" && entry.content !== null;
}

// src/types/asciicast.ts
var THEMES = {
  "tokyo-night": {
    fg: "#a9b1d6",
    bg: "#1a1b26",
    palette: "#15161e:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#a9b1d6:#414868:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#c0caf5"
  },
  "tokyo-storm": {
    fg: "#a9b1d6",
    bg: "#24283b",
    palette: "#1d202f:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#a9b1d6:#414868:#f7768e:#9ece6a:#e0af68:#7aa2f7:#bb9af7:#7dcfff:#c0caf5"
  },
  dracula: {
    fg: "#f8f8f2",
    bg: "#282a36",
    palette: "#21222c:#ff5555:#50fa7b:#f1fa8c:#bd93f9:#ff79c6:#8be9fd:#f8f8f2:#6272a4:#ff6e6e:#69ff94:#ffffa5:#d6acff:#ff92df:#a4ffff:#ffffff"
  },
  nord: {
    fg: "#d8dee9",
    bg: "#2e3440",
    palette: "#3b4252:#bf616a:#a3be8c:#ebcb8b:#81a1c1:#b48ead:#88c0d0:#e5e9f0:#4c566a:#bf616a:#a3be8c:#ebcb8b:#81a1c1:#b48ead:#8fbcbb:#eceff4"
  },
  "catppuccin-mocha": {
    fg: "#cdd6f4",
    bg: "#1e1e2e",
    palette: "#45475a:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#bac2de:#585b70:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#a6adc8"
  }
};
var TOKYO_NIGHT_SEMANTIC = {
  userPrompt: "#7aa2f7",
  // Blue
  assistantText: "#a9b1d6",
  // Foreground
  toolName: "#e0af68",
  // Yellow
  toolBulletSuccess: "#9ece6a",
  // Green
  toolBulletError: "#f7768e",
  // Red
  thinking: "#565f89",
  // Comment
  boxDrawing: "#414868",
  // Bright black
  filePath: "#7dcfff"
  // Cyan
};
var TIMING_PRESETS = {
  speedrun: {
    maxWait: 2,
    thinkingPause: 0.3,
    typingEffect: false,
    typingSpeed: 80
  },
  default: {
    maxWait: 3,
    thinkingPause: 0.8,
    typingEffect: true,
    typingSpeed: 60
  },
  realtime: {
    maxWait: Infinity,
    thinkingPause: 0,
    typingEffect: false,
    typingSpeed: 0
  }
};
var DEFAULT_MARKER_CONFIG = {
  mode: "all",
  labelLength: 30,
  pauseOnMarkers: false
};

// src/parser/loader.ts
import { readFile } from "fs/promises";
import { dirname, join } from "path";
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed;
  } catch {
    return null;
  }
}
async function loadTranscript(filePath, options = {}) {
  const { loadAgents = true, agentCache = /* @__PURE__ */ new Map() } = options;
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const entries = [];
  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) {
      entries.push(entry);
      if (loadAgents && entry.type === "user" && entry.toolUseResult && typeof entry.toolUseResult !== "string" && entry.toolUseResult.agentId) {
        const agentId = entry.toolUseResult.agentId;
        if (!agentCache.has(agentId)) {
          const agentPath = join(dirname(filePath), `agent-${agentId}.jsonl`);
          try {
            const agentEntries2 = await loadTranscript(agentPath, {
              loadAgents: true,
              agentCache
            });
            agentCache.set(agentId, agentEntries2);
          } catch {
            agentCache.set(agentId, []);
          }
        }
        const agentEntries = agentCache.get(agentId) ?? [];
        for (const agentEntry of agentEntries) {
          if ("isSidechain" in agentEntry) {
            agentEntry.isSidechain = true;
          }
          entries.push(agentEntry);
        }
      }
    }
  }
  return interleaveToolCallsAndResults(entries);
}
function sortByTimestamp(entries) {
  return [...entries].sort((a, b) => {
    const aTime = getTimestamp(a)?.getTime() ?? 0;
    const bTime = getTimestamp(b)?.getTime() ?? 0;
    return aTime - bTime;
  });
}
function getTimestamp(entry) {
  if ("timestamp" in entry && typeof entry.timestamp === "string" && entry.timestamp) {
    return new Date(entry.timestamp);
  }
  return null;
}
function getUuid(entry) {
  if ("uuid" in entry && typeof entry.uuid === "string" && entry.uuid) {
    return entry.uuid;
  }
  return null;
}
function isToolCallMessage(entry) {
  if (entry.type !== "assistant") return false;
  const content = entry.message?.content;
  if (!Array.isArray(content)) return false;
  return content.some((item) => item.type === "tool_use");
}
function isToolResultMessage(entry) {
  if (entry.type !== "user") return false;
  return entry.toolUseResult !== void 0;
}
function interleaveToolCallsAndResults(entries) {
  const result = [];
  let i = 0;
  while (i < entries.length) {
    const toolCalls = [];
    while (i < entries.length && isToolCallMessage(entries[i])) {
      toolCalls.push(entries[i]);
      i++;
    }
    const toolResults = [];
    while (i < entries.length && isToolResultMessage(entries[i])) {
      toolResults.push(entries[i]);
      i++;
    }
    if (toolCalls.length > 0 && toolResults.length > 0) {
      const maxPairs = Math.min(toolCalls.length, toolResults.length);
      for (let j = 0; j < maxPairs; j++) {
        result.push(toolCalls[j]);
        result.push(toolResults[j]);
      }
      for (let j = maxPairs; j < toolCalls.length; j++) {
        result.push(toolCalls[j]);
      }
      for (let j = maxPairs; j < toolResults.length; j++) {
        result.push(toolResults[j]);
      }
    } else {
      for (const call of toolCalls) {
        result.push(call);
      }
      for (const res of toolResults) {
        result.push(res);
      }
    }
    if (toolCalls.length === 0 && toolResults.length === 0 && i < entries.length) {
      result.push(entries[i]);
      i++;
    }
  }
  return result;
}

// src/parser/clip.ts
function extractClip(entries, options = {}) {
  const { startUuid, endUuid, startTime, endTime, last } = options;
  let sorted = sortByTimestamp(entries);
  if (last !== void 0) {
    if (last <= 0) {
      return [];
    }
    const renderable = sorted.filter(isRenderableForClip);
    const startIndex = Math.max(0, renderable.length - last);
    return renderable.slice(startIndex);
  }
  if (startUuid || endUuid) {
    sorted = filterByUuidRange(sorted, startUuid, endUuid);
  }
  if (startTime || endTime) {
    sorted = filterByTimeRange(sorted, startTime, endTime);
  }
  return sorted;
}
function filterByUuidRange(entries, startUuid, endUuid) {
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
      endIndex = idx + 1;
    }
  }
  return entries.slice(startIndex, endIndex);
}
function filterByTimeRange(entries, startTime, endTime) {
  const startDate = startTime ? new Date(startTime) : null;
  const endDate = endTime ? new Date(endTime) : null;
  return entries.filter((entry) => {
    const timestamp = getTimestamp(entry);
    if (!timestamp) return true;
    if (startDate && timestamp < startDate) return false;
    if (endDate && timestamp > endDate) return false;
    return true;
  });
}
function isRenderableForClip(entry) {
  switch (entry.type) {
    case "user":
    case "assistant":
      return true;
    case "system":
      return entry.content !== null;
    case "queue-operation":
      return entry.operation === "remove";
    case "summary":
    case "file-history-snapshot":
      return false;
    default:
      return false;
  }
}
function getClipSummary(entries) {
  let user = 0;
  let assistant = 0;
  let tools = 0;
  let startTime = null;
  let endTime = null;
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
    endTime
  };
}

// src/renderer/ansi.ts
var ESC = "\x1B";
var CSI = `${ESC}[`;
var RESET = `${CSI}0m`;
var BOLD = `${CSI}1m`;
var DIM = `${CSI}2m`;
var ITALIC = `${CSI}3m`;
var UNDERLINE = `${CSI}4m`;
var STRIKETHROUGH = `${CSI}9m`;
var RESET_BOLD = `${CSI}22m`;
var RESET_DIM = `${CSI}22m`;
var RESET_ITALIC = `${CSI}23m`;
var RESET_UNDERLINE = `${CSI}24m`;
var RESET_STRIKETHROUGH = `${CSI}29m`;
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}
function fg(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `${CSI}38;2;${r};${g};${b}m`;
}
function bg(hex) {
  const [r, g, b] = hexToRgb(hex);
  return `${CSI}48;2;${r};${g};${b}m`;
}
function colorize(text, hex) {
  return `${fg(hex)}${text}${RESET}`;
}
function style(text, options) {
  let prefix = "";
  const suffix = RESET;
  if (options.bold) prefix += BOLD;
  if (options.dim) prefix += DIM;
  if (options.italic) prefix += ITALIC;
  if (options.fg) prefix += fg(options.fg);
  if (options.bg) prefix += bg(options.bg);
  return `${prefix}${text}${suffix}`;
}
var BOX = {
  // Single line
  horizontal: "\u2500",
  vertical: "\u2502",
  topLeft: "\u250C",
  topRight: "\u2510",
  bottomLeft: "\u2514",
  bottomRight: "\u2518",
  teeRight: "\u251C",
  teeLeft: "\u2524",
  teeDown: "\u252C",
  teeUp: "\u2534",
  cross: "\u253C",
  // Rounded corners
  roundTopLeft: "\u256D",
  roundTopRight: "\u256E",
  roundBottomLeft: "\u2570",
  roundBottomRight: "\u256F",
  // Double line
  doubleHorizontal: "\u2550",
  doubleVertical: "\u2551",
  // Bullets and markers
  bullet: "\u25CF",
  bulletHollow: "\u25CB",
  check: "\u2713",
  crossMark: "\u2717",
  arrow: "\u2192",
  arrowDown: "\u2193",
  arrowSubagent: "\u2935",
  indent: "\u23BF"
};
function wordWrap(text, width) {
  if (width <= 0) return [text];
  const lines = [];
  const paragraphs = text.split("\n");
  for (const paragraph of paragraphs) {
    if (paragraph.length <= width) {
      lines.push(paragraph);
      continue;
    }
    const words = paragraph.split(/\s+/);
    let currentLine = "";
    for (const word of words) {
      if (word.length > width) {
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = "";
        }
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
        continue;
      }
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= width) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }
  return lines;
}
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + "\u2026";
}
function indent(text, spaces) {
  const prefix = " ".repeat(spaces);
  return text.split("\n").map((line) => prefix + line).join("\n");
}
function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
function visibleLength(text) {
  return stripAnsi(text).length;
}
function horizontalRule(width, color) {
  const line = BOX.horizontal.repeat(width);
  return color ? colorize(line, color) : line;
}
function saveCursor() {
  return `${CSI}s`;
}
function restoreCursor() {
  return `${CSI}u`;
}
function moveTo(row, col = 1) {
  return `${CSI}${row};${col}H`;
}
function moveToCol(col) {
  return `${CSI}${col}G`;
}
function eraseToEndOfLine() {
  return `${CSI}K`;
}
function eraseLine() {
  return `${CSI}2K`;
}
function setScrollRegion(top, bottom) {
  return `${CSI}${top};${bottom}r`;
}
function resetScrollRegion() {
  return `${CSI}r`;
}
function box(content, options = {}) {
  const { width = 80, borderColor, rounded = false } = options;
  const lines = content.split("\n");
  const innerWidth = width - 4;
  const tl = rounded ? BOX.roundTopLeft : BOX.topLeft;
  const tr = rounded ? BOX.roundTopRight : BOX.topRight;
  const bl = rounded ? BOX.roundBottomLeft : BOX.bottomLeft;
  const br = rounded ? BOX.roundBottomRight : BOX.bottomRight;
  const colorFn = borderColor ? (s) => colorize(s, borderColor) : (s) => s;
  const top = colorFn(tl + BOX.horizontal.repeat(width - 2) + tr);
  const bottom = colorFn(bl + BOX.horizontal.repeat(width - 2) + br);
  const wrappedLines = [];
  for (const line of lines) {
    const wrapped = wordWrap(line, innerWidth);
    wrappedLines.push(...wrapped);
  }
  const middle = wrappedLines.map((line) => {
    const padding = " ".repeat(Math.max(0, innerWidth - visibleLength(line)));
    return colorFn(BOX.vertical) + " " + line + padding + " " + colorFn(BOX.vertical);
  });
  return [top, ...middle, bottom].join("\n");
}

// src/renderer/theme.ts
var TOKYO_NIGHT = {
  fg: "#a9b1d6",
  bg: "#1a1b26",
  userPrompt: "#7aa2f7",
  userPromptBg: "#373737",
  assistantText: "#a9b1d6",
  toolName: "#e0af68",
  toolBulletSuccess: "#9ece6a",
  toolBulletError: "#f7768e",
  thinking: "#565f89",
  boxDrawing: "#414868",
  filePath: "#7dcfff",
  muted: "#565f89",
  agent: "#bb9af7",
  diffAddLineBg: "#225c2b",
  diffAddCharBg: "#38a660",
  diffRemoveLineBg: "#5c2b2b",
  diffRemoveCharBg: "#a63838"
};
var TOKYO_STORM = {
  ...TOKYO_NIGHT,
  bg: "#24283b"
};
var DRACULA = {
  fg: "#f8f8f2",
  bg: "#282a36",
  userPrompt: "#8be9fd",
  userPromptBg: "#373737",
  assistantText: "#f8f8f2",
  toolName: "#f1fa8c",
  toolBulletSuccess: "#50fa7b",
  toolBulletError: "#ff5555",
  thinking: "#6272a4",
  boxDrawing: "#44475a",
  filePath: "#ff79c6",
  muted: "#6272a4",
  agent: "#bd93f9",
  diffAddLineBg: "#1e4620",
  diffAddCharBg: "#2e7d32",
  diffRemoveLineBg: "#4a1e1e",
  diffRemoveCharBg: "#8b2e2e"
};
var NORD = {
  fg: "#d8dee9",
  bg: "#2e3440",
  userPrompt: "#81a1c1",
  userPromptBg: "#373737",
  assistantText: "#d8dee9",
  toolName: "#ebcb8b",
  toolBulletSuccess: "#a3be8c",
  toolBulletError: "#bf616a",
  thinking: "#4c566a",
  boxDrawing: "#3b4252",
  filePath: "#88c0d0",
  muted: "#4c566a",
  agent: "#b48ead",
  diffAddLineBg: "#2e4a3a",
  diffAddCharBg: "#4a7a5c",
  diffRemoveLineBg: "#4a2e2e",
  diffRemoveCharBg: "#7a4a4a"
};
var CATPPUCCIN_MOCHA = {
  fg: "#cdd6f4",
  bg: "#1e1e2e",
  userPrompt: "#89b4fa",
  userPromptBg: "#373737",
  assistantText: "#cdd6f4",
  toolName: "#f9e2af",
  toolBulletSuccess: "#a6e3a1",
  toolBulletError: "#f38ba8",
  thinking: "#585b70",
  boxDrawing: "#45475a",
  filePath: "#94e2d5",
  muted: "#585b70",
  agent: "#f5c2e7",
  diffAddLineBg: "#264a35",
  diffAddCharBg: "#40a060",
  diffRemoveLineBg: "#4a2635",
  diffRemoveCharBg: "#a04050"
};
var RENDER_THEMES = {
  "tokyo-night": TOKYO_NIGHT,
  "tokyo-storm": TOKYO_STORM,
  dracula: DRACULA,
  nord: NORD,
  "catppuccin-mocha": CATPPUCCIN_MOCHA
};
function getTheme(name) {
  return RENDER_THEMES[name] ?? TOKYO_NIGHT;
}
function toAsciicastTheme(theme) {
  const name = Object.entries(RENDER_THEMES).find(
    ([, t]) => t === theme
  )?.[0];
  if (name && THEMES[name]) {
    return THEMES[name];
  }
  const palette = [
    theme.bg,
    // black (background)
    theme.toolBulletError,
    // red
    theme.toolBulletSuccess,
    // green
    theme.toolName,
    // yellow
    theme.userPrompt,
    // blue
    theme.agent,
    // magenta
    theme.filePath,
    // cyan
    theme.fg,
    // white (foreground)
    theme.muted,
    // bright black
    theme.toolBulletError,
    // bright red
    theme.toolBulletSuccess,
    // bright green
    theme.toolName,
    // bright yellow
    theme.userPrompt,
    // bright blue
    theme.agent,
    // bright magenta
    theme.filePath,
    // bright cyan
    theme.assistantText
    // bright white
  ].join(":");
  return {
    fg: theme.fg,
    bg: theme.bg,
    palette
  };
}

// src/renderer/content.ts
function extractText(content) {
  if (typeof content === "string") {
    return content;
  }
  return content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
}
function extractThinking(content) {
  return content.filter((item) => item.type === "thinking").map((item) => item.thinking);
}
function extractToolUse(content) {
  return content.filter(
    (item) => item.type === "tool_use"
  );
}
function hasToolUse(content) {
  return content.some((item) => item.type === "tool_use");
}
function hasThinking(content) {
  return content.some((item) => item.type === "thinking");
}
function classifyContent(content) {
  const types = new Set(content.map((item) => item.type));
  if (types.size === 0) return "text";
  if (types.size === 1) {
    if (types.has("text")) return "text";
    if (types.has("thinking")) return "thinking";
    if (types.has("tool_use")) return "tool-call";
  }
  return "mixed";
}
function getUserMessageLabel(msg, maxLength = 30) {
  if (msg.toolUseResult) {
    if (typeof msg.toolUseResult === "string") {
      return "Tool error";
    }
    return msg.toolUseResult.is_error ? "Tool error" : "Tool result";
  }
  const text = extractText(msg.message.content);
  if (text.length <= maxLength) {
    return text.replace(/\n/g, " ");
  }
  return text.substring(0, maxLength - 1).replace(/\n/g, " ") + "\u2026";
}
function getAssistantMessageLabel(msg, maxLength = 30) {
  const content = msg.message.content;
  const tools = extractToolUse(content);
  if (tools.length > 0) {
    const firstTool = tools[0];
    if (tools.length === 1) {
      return `${firstTool.name}`;
    }
    return `${firstTool.name} (+${tools.length - 1} more)`;
  }
  const text = extractText(content);
  if (text.length <= maxLength) {
    return text.replace(/\n/g, " ");
  }
  return text.substring(0, maxLength - 1).replace(/\n/g, " ") + "\u2026";
}
function formatToolInputSummary(tool) {
  const { name, input } = tool;
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      if (typeof input["file_path"] === "string") {
        return input["file_path"];
      }
      break;
    case "Bash":
      if (typeof input["command"] === "string") {
        const cmd = input["command"];
        return cmd.length > 50 ? cmd.substring(0, 49) + "\u2026" : cmd;
      }
      break;
    case "Glob":
      if (typeof input["pattern"] === "string") {
        return input["pattern"];
      }
      break;
    case "Grep":
      if (typeof input["pattern"] === "string") {
        return `/${input["pattern"]}/`;
      }
      break;
    case "Task":
      if (typeof input["description"] === "string") {
        return input["description"];
      }
      if (typeof input["prompt"] === "string") {
        const prompt = input["prompt"];
        return prompt.length > 50 ? prompt.substring(0, 49) + "\u2026" : prompt;
      }
      break;
    case "WebFetch":
      if (typeof input["url"] === "string") {
        return input["url"];
      }
      break;
    case "WebSearch":
      if (typeof input["query"] === "string") {
        return input["query"];
      }
      break;
    case "TodoWrite":
      if (Array.isArray(input["todos"])) {
        return `${input["todos"].length} items`;
      }
      break;
  }
  return "";
}
function truncateOutput(text, maxLines, maxLineLength = 200) {
  const lines = text.split("\n");
  const truncatedLines = lines.map(
    (line) => line.length > maxLineLength ? line.substring(0, maxLineLength - 1) + "\u2026" : line
  );
  if (truncatedLines.length <= maxLines) {
    return {
      text: truncatedLines.join("\n"),
      truncated: false,
      hiddenLines: 0
    };
  }
  return {
    text: truncatedLines.slice(0, maxLines).join("\n"),
    truncated: true,
    hiddenLines: truncatedLines.length - maxLines
  };
}

// src/renderer/todos.ts
var TODO_CHARS = {
  /** Unchecked ballot box (pending/in_progress) */
  unchecked: "\u2610",
  // ☐
  /** Checked ballot box with X (completed) */
  checked: "\u2612",
  // ☒
  /** Tree connector for first item */
  treeConnector: "\u23BF"
  // ⎿
};
function isTodoWriteToolResult(result) {
  if (typeof result !== "object" || result === null) return false;
  const r = result;
  return Array.isArray(r.newTodos) && r.newTodos.length > 0;
}
function renderTodosFromInput(input, cfg) {
  if (!Array.isArray(input.todos) || input.todos.length === 0) {
    return null;
  }
  return renderTodos(input.todos, cfg);
}
function renderTodos(todos, cfg) {
  const { theme, indentSize, width } = cfg;
  const output = [];
  const prefixLen = 3;
  const checkboxLen = 2;
  const contentWidth = width - indentSize - prefixLen - checkboxLen;
  for (let i = 0; i < todos.length; i++) {
    const todo = todos[i];
    const isFirst = i === 0;
    const prefix = isFirst ? `${TODO_CHARS.treeConnector}  ` : "   ";
    const itemLines = renderTodoItem(todo, theme, contentWidth);
    for (let j = 0; j < itemLines.length; j++) {
      const linePrefix = j === 0 ? prefix : "   ";
      output.push(indent(linePrefix + itemLines[j], indentSize));
    }
  }
  return output.join("\n");
}
function renderTodoItem(todo, theme, contentWidth) {
  switch (todo.status) {
    case "completed":
      return renderCompletedTodo(todo, theme, contentWidth);
    case "in_progress":
      return renderInProgressTodo(todo, theme, contentWidth);
    case "pending":
    default:
      return renderPendingTodo(todo, theme, contentWidth);
  }
}
function renderPendingTodo(todo, _theme, contentWidth) {
  const lines = wordWrap(todo.content, contentWidth);
  return lines.map(
    (line, i) => i === 0 ? `${TODO_CHARS.unchecked} ${line}` : `  ${line}`
  );
}
function renderInProgressTodo(todo, _theme, contentWidth) {
  const lines = wordWrap(todo.content, contentWidth);
  return lines.map(
    (line, i) => i === 0 ? `${TODO_CHARS.unchecked} ${BOLD}${line}${RESET_BOLD}` : `  ${BOLD}${line}${RESET_BOLD}`
  );
}
function renderCompletedTodo(todo, theme, contentWidth) {
  const grayFg = fg(theme.muted);
  const lines = wordWrap(todo.content, contentWidth);
  return lines.map(
    (line, i) => i === 0 ? `${grayFg}${TODO_CHARS.checked} ${STRIKETHROUGH}${line}${RESET_STRIKETHROUGH}${RESET}` : `${grayFg}  ${STRIKETHROUGH}${line}${RESET_STRIKETHROUGH}${RESET}`
  );
}

// src/renderer/markdown.ts
function renderMarkdown(text, cfg) {
  const { theme, width } = cfg;
  const inputLines = text.split("\n");
  const outputLines = [];
  let i = 0;
  while (i < inputLines.length) {
    const line = inputLines[i];
    if (line.trimStart().startsWith("```")) {
      const indent2 = line.match(/^(\s*)/)?.[1] || "";
      const codeLines = [];
      i++;
      while (i < inputLines.length && !inputLines[i].trimStart().startsWith("```")) {
        codeLines.push(inputLines[i]);
        i++;
      }
      i++;
      const rendered = renderCodeBlock(codeLines, indent2, cfg);
      outputLines.push(...rendered);
      continue;
    }
    if (/^(\s*)[-*_]{3,}\s*$/.test(line)) {
      const rule = "\u2500".repeat(Math.min(width, 40));
      outputLines.push(colorize(rule, theme.muted));
      i++;
      continue;
    }
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const content = headerMatch[2];
      const formatted = parseInlineFormatting(content, cfg);
      outputLines.push(`${BOLD}${formatted}${RESET_BOLD}`);
      i++;
      continue;
    }
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (unorderedMatch) {
      const indent2 = unorderedMatch[1];
      const content = unorderedMatch[3];
      const formatted = parseInlineFormatting(content, cfg);
      outputLines.push(`${indent2}\u2022 ${formatted}`);
      i++;
      continue;
    }
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const indent2 = orderedMatch[1];
      const num = orderedMatch[2];
      const content = orderedMatch[3];
      const formatted = parseInlineFormatting(content, cfg);
      outputLines.push(`${indent2}${num}. ${formatted}`);
      i++;
      continue;
    }
    if (isTableRow(line)) {
      const tableLines = [];
      while (i < inputLines.length && isTableRow(inputLines[i])) {
        tableLines.push(inputLines[i]);
        i++;
      }
      const renderedTable = renderTable(tableLines, cfg);
      outputLines.push(...renderedTable);
    } else {
      const formatted = parseInlineFormatting(line, cfg);
      const wrapped = wordWrapAnsi(formatted, width, cfg);
      outputLines.push(...wrapped);
      i++;
    }
  }
  return outputLines.join("\n");
}
function isTableRow(line) {
  return line.includes("|") && line.trim().length > 0;
}
function renderTable(lines, cfg) {
  const { theme } = cfg;
  const rows = [];
  const separatorIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\|?[\s\-:|]+\|?$/.test(line)) {
      separatorIndices.push(i);
      rows.push([]);
      continue;
    }
    const cells = line.split("|").map((c) => c.trim()).filter((c, idx, arr) => {
      if (idx === 0 && c === "") return false;
      if (idx === arr.length - 1 && c === "") return false;
      return true;
    });
    rows.push(cells);
  }
  const formattedRows = [];
  const colWidths = [];
  for (let i = 0; i < rows.length; i++) {
    if (separatorIndices.includes(i)) {
      formattedRows.push([]);
      continue;
    }
    const formattedCells = rows[i].map((cell) => parseInlineFormatting(cell, cfg));
    formattedRows.push(formattedCells);
    for (let col = 0; col < formattedCells.length; col++) {
      const cellWidth = visibleLength(formattedCells[col]);
      if (colWidths[col] === void 0 || cellWidth > colWidths[col]) {
        colWidths[col] = cellWidth;
      }
    }
  }
  const output = [];
  for (let i = 0; i < formattedRows.length; i++) {
    if (separatorIndices.includes(i)) {
      const sep = colWidths.map((w) => "-".repeat(w)).join(" | ");
      output.push(colorize(sep, theme.muted));
    } else {
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
function renderCodeBlock(lines, indent2, cfg) {
  const { theme } = cfg;
  return lines.map((line) => {
    const content = indent2 + line;
    return style(content, { dim: true, fg: theme.muted });
  });
}
function parseInlineFormatting(text, cfg) {
  const { theme } = cfg;
  const codePlaceholders = [];
  let result = text.replace(/`([^`]+)`/g, (_, code) => {
    const rendered = colorize(code, theme.agent);
    const placeholder = `\0CODE${codePlaceholders.length}\0`;
    codePlaceholders.push(rendered);
    return placeholder;
  });
  result = result.replace(/\\\*/g, "\0ESCSTAR\0");
  result = result.replace(/\\_/g, "\0ESCUNDER\0");
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text2, url) => {
    return `${UNDERLINE}${text2}${RESET_UNDERLINE} (${colorize(url, theme.muted)})`;
  });
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, content) => {
    return `${BOLD}${content}${RESET_BOLD}`;
  });
  result = result.replace(/__([^_]+)__/g, (_, content) => {
    return `${BOLD}${content}${RESET_BOLD}`;
  });
  result = result.replace(/\*([^*]+)\*/g, (_, content) => {
    return `${ITALIC}${content}${RESET_ITALIC}`;
  });
  result = result.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, (_, content) => {
    return `${ITALIC}${content}${RESET_ITALIC}`;
  });
  result = result.replace(/\x00ESCSTAR\x00/g, "*");
  result = result.replace(/\x00ESCUNDER\x00/g, "_");
  for (let i = 0; i < codePlaceholders.length; i++) {
    result = result.replace(`\0CODE${i}\0`, codePlaceholders[i]);
  }
  return colorize(result, theme.assistantText);
}
function wordWrapAnsi(text, width, _cfg) {
  if (width <= 0) return [text];
  const words = text.split(/(\s+)/);
  const lines = [];
  let currentLine = "";
  let currentWidth = 0;
  for (const word of words) {
    const wordWidth = visibleLength(word);
    if (currentWidth === 0) {
      currentLine = word;
      currentWidth = wordWidth;
    } else if (currentWidth + wordWidth <= width) {
      currentLine += word;
      currentWidth += wordWidth;
    } else if (word.match(/^\s+$/)) {
      continue;
    } else {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = word.trimStart();
      currentWidth = visibleLength(currentLine);
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  if (lines.length === 0) {
    lines.push("");
  }
  return lines;
}

// src/renderer/diff.ts
var LINE_PREFIX_WIDTH = 9;
function isEditToolResult(result) {
  if (typeof result !== "object" || result === null) return false;
  const r = result;
  return typeof r.filePath === "string" && Array.isArray(r.structuredPatch) && r.structuredPatch.length > 0;
}
function renderEditDiff(result, cfg) {
  const { theme, indentSize } = cfg;
  const output = [];
  let additions = 0;
  let removals = 0;
  for (const hunk of result.structuredPatch ?? []) {
    for (const line of hunk.lines) {
      if (line[0] === "+") additions++;
      if (line[0] === "-") removals++;
    }
  }
  const statsText = `${additions} addition${additions !== 1 ? "s" : ""} and ${removals} removal${removals !== 1 ? "s" : ""}`;
  const header = colorize(`Updated ${result.filePath} with ${statsText}`, theme.muted);
  output.push(indent(header, indentSize));
  const contentWidth = cfg.width - indentSize - LINE_PREFIX_WIDTH;
  for (const hunk of result.structuredPatch ?? []) {
    const hunkLines = renderHunk(hunk, theme, contentWidth);
    for (const line of hunkLines) {
      output.push(indent(line, indentSize));
    }
  }
  return output.join("\n");
}
function renderHunk(hunk, theme, contentWidth) {
  const output = [];
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
        output.push(...renderContextLine(newLineNum, content, theme, contentWidth));
        oldLineNum++;
        newLineNum++;
        i++;
        break;
      case "-": {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine[0] === "+") {
          const oldContent = content;
          const newContent = nextLine.slice(1);
          const { oldSegments, newSegments } = diffWords(oldContent, newContent);
          output.push(...renderRemovalLineWithHighlight(oldLineNum, oldSegments, theme, contentWidth));
          output.push(...renderAdditionLineWithHighlight(newLineNum, newSegments, theme, contentWidth));
          oldLineNum++;
          newLineNum++;
          i += 2;
        } else {
          output.push(...renderRemovalLine(oldLineNum, content, theme, contentWidth));
          oldLineNum++;
          i++;
        }
        break;
      }
      case "+":
        output.push(...renderAdditionLine(newLineNum, content, theme, contentWidth));
        newLineNum++;
        i++;
        break;
      default:
        output.push(...renderContextLine(newLineNum, line, theme, contentWidth));
        newLineNum++;
        i++;
    }
  }
  return output;
}
function diffWords(oldLine, newLine) {
  const oldTokens = tokenize(oldLine);
  const newTokens = tokenize(newLine);
  const lcs = longestCommonSubsequence(oldTokens, newTokens);
  const oldSegments = buildSegments(oldTokens, lcs, "old");
  const newSegments = buildSegments(newTokens, lcs, "new");
  return { oldSegments, newSegments };
}
function tokenize(line) {
  const tokens = [];
  let current = "";
  let inWhitespace = null;
  for (const char of line) {
    const isWs = /\s/.test(char);
    if (inWhitespace === null) {
      current = char;
      inWhitespace = isWs;
    } else if (isWs === inWhitespace) {
      current += char;
    } else {
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
function longestCommonSubsequence(oldTokens, newTokens) {
  const m = oldTokens.length;
  const n = newTokens.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i2 = 1; i2 <= m; i2++) {
    for (let j2 = 1; j2 <= n; j2++) {
      if (oldTokens[i2 - 1] === newTokens[j2 - 1]) {
        dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;
      } else {
        dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);
      }
    }
  }
  const oldLcsIndices = /* @__PURE__ */ new Set();
  const newLcsIndices = /* @__PURE__ */ new Set();
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
  return /* @__PURE__ */ new Map([
    ["old", oldLcsIndices],
    ["new", newLcsIndices]
  ]);
}
function buildSegments(tokens, lcs, side) {
  const lcsIndices = lcs.get(side) ?? /* @__PURE__ */ new Set();
  const segments = [];
  for (let i = 0; i < tokens.length; i++) {
    const changed = !lcsIndices.has(i);
    const text = tokens[i];
    if (segments.length > 0 && segments[segments.length - 1].changed === changed) {
      segments[segments.length - 1].text += text;
    } else {
      segments.push({ text, changed });
    }
  }
  return segments;
}
function renderContextLine(lineNum, content, theme, contentWidth) {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     ";
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
function renderRemovalLine(lineNum, content, theme, contentWidth) {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     ";
  if (contentWidth > 0 && content.length > contentWidth) {
    const wrapped = wordWrap(content, contentWidth);
    return wrapped.map((line, idx) => {
      const styledContent2 = style(` - ${line}`, {
        fg: "#ffffff",
        bg: theme.diffRemoveLineBg
      });
      if (idx === 0) {
        return `${lineNumStr} ${styledContent2}`;
      }
      return `${lineNumPadding} ${styledContent2}`;
    });
  }
  const styledContent = style(` - ${content}`, {
    fg: "#ffffff",
    bg: theme.diffRemoveLineBg
  });
  return [`${lineNumStr} ${styledContent}`];
}
function renderAdditionLine(lineNum, content, theme, contentWidth) {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     ";
  if (contentWidth > 0 && content.length > contentWidth) {
    const wrapped = wordWrap(content, contentWidth);
    return wrapped.map((line, idx) => {
      const styledContent2 = style(` + ${line}`, {
        fg: "#ffffff",
        bg: theme.diffAddLineBg
      });
      if (idx === 0) {
        return `${lineNumStr} ${styledContent2}`;
      }
      return `${lineNumPadding} ${styledContent2}`;
    });
  }
  const styledContent = style(` + ${content}`, {
    fg: "#ffffff",
    bg: theme.diffAddLineBg
  });
  return [`${lineNumStr} ${styledContent}`];
}
function renderRemovalLineWithHighlight(lineNum, segments, theme, contentWidth) {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     ";
  const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);
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
function renderAdditionLineWithHighlight(lineNum, segments, theme, contentWidth) {
  const lineNumStr = colorize(String(lineNum).padStart(5), theme.muted);
  const lineNumPadding = "     ";
  const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);
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
function wrapSegmentedLine(lineNumStr, lineNumPadding, prefixText, segments, lineBg, charBg, contentWidth) {
  const outputLines = [];
  let currentLineContent = "";
  let currentLineWidth = 0;
  let isFirstLine = true;
  for (const seg of segments) {
    const segBg = seg.changed ? charBg : lineBg;
    let remaining = seg.text;
    while (remaining.length > 0) {
      const spaceLeft = contentWidth - currentLineWidth;
      if (remaining.length <= spaceLeft) {
        currentLineContent += style(remaining, { fg: "#ffffff", bg: segBg });
        currentLineWidth += remaining.length;
        remaining = "";
      } else {
        let splitPoint = spaceLeft;
        const lastSpace = remaining.lastIndexOf(" ", spaceLeft);
        if (lastSpace > 0) {
          splitPoint = lastSpace + 1;
        }
        if (splitPoint <= 0) {
          if (currentLineContent) {
            const prefix2 = style(prefixText, { fg: "#ffffff", bg: lineBg });
            if (isFirstLine) {
              outputLines.push(`${lineNumStr} ${prefix2}${currentLineContent}${RESET}`);
              isFirstLine = false;
            } else {
              outputLines.push(`${lineNumPadding} ${prefix2}${currentLineContent}${RESET}`);
            }
            currentLineContent = "";
            currentLineWidth = 0;
          }
          const chunk2 = remaining.slice(0, 1);
          currentLineContent += style(chunk2, { fg: "#ffffff", bg: segBg });
          currentLineWidth += 1;
          remaining = remaining.slice(1);
          continue;
        }
        const chunk = remaining.slice(0, splitPoint);
        currentLineContent += style(chunk, { fg: "#ffffff", bg: segBg });
        remaining = remaining.slice(splitPoint);
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
    }
  }
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

// src/renderer/tool-results.ts
function renderToolResult(result, cfg) {
  const { theme, maxToolOutputLines } = cfg;
  if (isEditToolResult(result)) {
    return renderEditDiff(result, {
      theme,
      indentSize: cfg.indentSize,
      width: cfg.width
    });
  }
  if (isTodoWriteToolResult(result)) {
    return "";
  }
  let contentText = "";
  if (Array.isArray(result.content)) {
    const parts = [];
    let hasImage = false;
    for (const item of result.content) {
      if (item && typeof item.text === "string") {
        parts.push(item.text);
      } else if (item && item.type === "image") {
        hasImage = true;
      }
    }
    if (hasImage) {
      parts.push("[Screenshot captured]");
    }
    contentText = parts.join("\n");
  } else if (typeof result.content === "string") {
    contentText = result.content;
  } else if (typeof result.result === "string") {
    contentText = result.result;
  } else if (Array.isArray(result.results)) {
    const parts = [];
    if (result.query) {
      parts.push(`Query: ${result.query}`);
    }
    for (const item of result.results) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (item && typeof item.title === "string") {
        parts.push(`\u2022 ${item.title}`);
        if (item.url) parts.push(`  ${item.url}`);
        if (item.snippet) parts.push(`  ${item.snippet}`);
      }
    }
    contentText = parts.join("\n");
  } else if (result.file && typeof result.file.content === "string") {
    contentText = result.file.content;
  } else if (result.stdout || result.stderr) {
    const parts = [];
    if (typeof result.stdout === "string") parts.push(result.stdout);
    if (typeof result.stderr === "string") parts.push(result.stderr);
    contentText = parts.join("\n");
  } else if (Array.isArray(result.filenames)) {
    if (result.filenames.length === 0) {
      contentText = "(no matches)";
    } else {
      contentText = result.filenames.join("\n");
    }
  } else if (result.oldTodos || result.newTodos) {
    const count = Array.isArray(result.newTodos) ? result.newTodos.length : 0;
    contentText = `Updated ${count} todos`;
  }
  if (!contentText) {
    const bullet2 = result.is_error ? BOX.crossMark : BOX.check;
    const bulletColor2 = result.is_error ? theme.toolBulletError : theme.toolBulletSuccess;
    return colorize(`  ${BOX.indent} `, theme.muted) + colorize(bullet2, bulletColor2);
  }
  const treePrefix = "  ";
  const contentIndent = 5;
  const wrapWidth = cfg.width - contentIndent;
  const rawLines = contentText.split("\n");
  const lines = [];
  for (const rawLine of rawLines) {
    const wrapped = wordWrap(rawLine, wrapWidth);
    lines.push(...wrapped);
  }
  const truncated = lines.length > maxToolOutputLines;
  const displayLines = truncated ? lines.slice(0, maxToolOutputLines) : lines;
  const bulletColor = result.is_error ? theme.toolBulletError : theme.toolBulletSuccess;
  const bullet = result.is_error ? BOX.crossMark : BOX.check;
  const treeConnector = "\u23BF";
  const output = [];
  for (let i = 0; i < displayLines.length; i++) {
    const line = displayLines[i] ?? "";
    if (i === 0) {
      output.push(treePrefix + colorize(treeConnector, theme.muted) + "  " + line);
    } else {
      output.push(indent(line, contentIndent));
    }
  }
  if (truncated) {
    output.push(
      indent(
        colorize(`\u2026 +${lines.length - maxToolOutputLines} lines (ctrl+o to expand)`, theme.muted),
        contentIndent
      )
    );
  }
  if (output.length === 0) {
    return treePrefix + colorize(bullet, bulletColor);
  }
  return output.join("\n");
}

// src/renderer/tool-formatting.ts
function formatToolName(name) {
  if (name.startsWith("mcp__")) {
    const parts = name.slice(5).split("__");
    if (parts.length >= 2) {
      const server = parts[0];
      const tool = parts.slice(1).join("__");
      return { displayName: `${server} - ${tool}`, isMcp: true };
    }
  }
  return { displayName: name, isMcp: false };
}
function formatToolArgs(tool, theme, isMcp = false) {
  const input = tool.input;
  if (isMcp && input && typeof input === "object") {
    const keys = Object.keys(input);
    if (keys.length > 0) {
      const key = keys[0];
      const value = input[key];
      if (typeof value === "string") {
        const truncated = truncate(value, 40);
        return `(${key}: "${colorize(truncated, theme.muted)}")`;
      }
    }
    return "";
  }
  switch (tool.name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      if (typeof input["file_path"] === "string") {
        return `(${colorize(input["file_path"], theme.filePath)})`;
      }
      break;
    case "Bash":
      if (typeof input["command"] === "string") {
        const cmd = truncate(input["command"], 60);
        return `(${colorize(cmd, theme.muted)})`;
      }
      break;
    case "Glob":
      if (typeof input["pattern"] === "string") {
        return `(${colorize(input["pattern"], theme.filePath)})`;
      }
      break;
    case "Grep":
      if (typeof input["pattern"] === "string") {
        const pattern = truncate(input["pattern"], 40);
        return `(${colorize(pattern, theme.muted)})`;
      }
      break;
    case "Task":
      if (typeof input["description"] === "string") {
        const desc = truncate(input["description"], 50);
        return `(${colorize(desc, theme.agent)})`;
      }
      if (typeof input["prompt"] === "string") {
        const prompt = truncate(input["prompt"], 50);
        return `(${colorize(prompt, theme.agent)})`;
      }
      break;
    case "TodoWrite":
      return colorize(" (updating todos)", theme.muted);
    case "WebFetch":
    case "WebSearch":
      if (typeof input["url"] === "string") {
        const url = truncate(input["url"], 50);
        return `(${colorize(url, theme.filePath)})`;
      }
      if (typeof input["query"] === "string") {
        const query = truncate(input["query"], 50);
        return `(${colorize(query, theme.muted)})`;
      }
      break;
  }
  return "";
}

// src/renderer/commands.ts
function parseCommandTags(content) {
  const nameMatch = content.match(/<command-name>([^<]*)<\/command-name>/);
  if (!nameMatch) {
    return null;
  }
  const name = nameMatch[1] || "";
  const messageMatch = content.match(/<command-message>([^<]*)<\/command-message>/);
  const argsMatch = content.match(/<command-args>([^<]*)<\/command-args>/);
  const stdoutMatch = content.match(/<local-command-stdout>([^<]*)<\/local-command-stdout>/);
  return {
    name,
    message: messageMatch?.[1] || "",
    args: argsMatch?.[1] || "",
    stdout: stdoutMatch?.[1] || ""
  };
}
function parseLocalCommandStdout(content) {
  const match = content.match(/<local-command-stdout>([^<]*)<\/local-command-stdout>/);
  return match ? match[1] || "" : null;
}
function isCommandMessage(content) {
  const trimmed = content.trim();
  return trimmed.startsWith("<command-name>") || trimmed.startsWith("<local-command-stdout>");
}
function isBashMessage(content) {
  return content.includes("<bash-input>") || content.includes("<bash-stdout>") || content.includes("<bash-stderr>");
}
function isBashInputMessage(content) {
  return content.includes("<bash-input>");
}
function parseBashInput(content) {
  const match = content.match(/<bash-input>([\s\S]*?)<\/bash-input>/);
  return match ? (match[1] ?? "").trim() : null;
}
function parseBashOutput(content) {
  const stdoutMatch = content.match(/<bash-stdout>([\s\S]*?)<\/bash-stdout>/);
  const stderrMatch = content.match(/<bash-stderr>([\s\S]*?)<\/bash-stderr>/);
  if (!stdoutMatch && !stderrMatch) {
    return null;
  }
  return {
    stdout: (stdoutMatch?.[1] || "").trim(),
    stderr: (stderrMatch?.[1] || "").trim()
  };
}
function renderSlashCommand(command, cfg) {
  const { theme } = cfg;
  let line = `${BOX.arrow} ${command.name}`;
  if (command.args.trim()) {
    line += ` (${command.args})`;
  }
  line += " ";
  const result = style(line, { fg: "#ffffff", bg: "#373737" });
  if (command.stdout.trim()) {
    const stdoutLine = colorize(`  ${command.stdout}`, theme.muted);
    return `${result}
${stdoutLine}`;
  }
  return result;
}
function renderLocalStdout(stdout, cfg) {
  const { theme } = cfg;
  if (!stdout.trim() || stdout === "...") {
    return "";
  }
  return colorize(`  ${stdout}`, theme.muted);
}
var BASH_MODE_PINK = "#fd5db1";
var BASH_COMMAND_BG = "#413c41";
var BASH_COMMAND_TEXT = "#ffffff";
var BASH_STDERR_COLOR = "#ff6b80";
function renderBashInput(command, cfg) {
  const prefix = style("!", { fg: BASH_MODE_PINK, bg: BASH_COMMAND_BG });
  const cmdText = style(` ${command} `, { fg: BASH_COMMAND_TEXT, bg: BASH_COMMAND_BG });
  return prefix + cmdText;
}
function renderBashOutput(output, cfg) {
  const { theme, maxOutputLines = 5 } = cfg;
  const lines = [];
  const renderLines = (rawLines, color, useConnector) => {
    const truncated = rawLines.length > maxOutputLines;
    const displayLines = truncated ? rawLines.slice(0, maxOutputLines) : rawLines;
    for (let i = 0; i < displayLines.length; i++) {
      const line = displayLines[i];
      const prefix = i === 0 && useConnector ? `  ${BOX.indent}  ` : "     ";
      const formatted = `${prefix}${line}`;
      lines.push(color ? colorize(formatted, color) : formatted);
    }
    if (truncated) {
      const hiddenCount = rawLines.length - maxOutputLines;
      lines.push(
        colorize(`     \u2026 +${hiddenCount} lines (ctrl+o to expand)`, theme.muted)
      );
    }
    return displayLines.length;
  };
  if (output.stderr.trim()) {
    const stderrLines = output.stderr.split("\n");
    renderLines(stderrLines, BASH_STDERR_COLOR, true);
  }
  if (output.stdout.trim()) {
    const stdoutLines = output.stdout.split("\n");
    const startWithConnector = lines.length === 0;
    renderLines(stdoutLines, null, startWithConnector);
  }
  return lines.join("\n");
}

// src/renderer/messages.ts
var DEFAULT_RENDER_CONFIG = {
  theme: TOKYO_NIGHT,
  width: 100,
  maxToolOutputLines: 5,
  // Matches Claude Code's compact display (wrapped lines counted)
  showThinking: true,
  indentSize: 2
};
function renderMessage(entry, config = {}) {
  const cfg = { ...DEFAULT_RENDER_CONFIG, ...config };
  switch (entry.type) {
    case "user":
      if (entry.isMeta) {
        return "";
      }
      return renderUserMessage(entry, cfg);
    case "assistant":
      return renderAssistantMessage(entry, cfg);
    case "system":
      return renderSystemMessage(entry, cfg);
    case "summary":
      return "";
    // Skip rendering
    case "queue-operation":
      if (entry.operation === "remove") {
        return renderQueueRemove(entry.content, cfg);
      }
      return "";
    case "file-history-snapshot":
      return "";
    // Skip rendering
    default:
      return "";
  }
}
function renderUserMessage(msg, cfg) {
  const { theme } = cfg;
  if (msg.toolUseResult) {
    if (typeof msg.toolUseResult === "string") {
      return renderToolResult({ content: msg.toolUseResult, is_error: true }, cfg);
    }
    if (Array.isArray(msg.toolUseResult)) {
      return renderToolResult({ content: msg.toolUseResult }, cfg);
    }
    return renderToolResult(msg.toolUseResult, cfg);
  }
  const content = extractTextContent(msg.message.content);
  if (!content.trim()) return "";
  if (content.includes("[Request interrupted by user]")) {
    return renderInterruptMessage(content, { theme, width: cfg.width });
  }
  if (isCommandMessage(content)) {
    const command = parseCommandTags(content);
    if (command) {
      return renderSlashCommand(command, { theme, width: cfg.width });
    }
    const stdout = parseLocalCommandStdout(content);
    if (stdout !== null) {
      return renderLocalStdout(stdout, { theme, width: cfg.width });
    }
  }
  if (isBashMessage(content)) {
    const bashInput = parseBashInput(content);
    const bashOutput = parseBashOutput(content);
    const cmdCfg = { theme, width: cfg.width };
    if (bashInput !== null && bashOutput) {
      return renderBashInput(bashInput, cmdCfg) + "\n" + renderBashOutput(bashOutput, cmdCfg);
    }
    if (bashInput !== null) {
      return renderBashInput(bashInput, cmdCfg);
    }
    if (bashOutput) {
      return renderBashOutput(bashOutput, cmdCfg);
    }
  }
  const lines = wordWrap(content, cfg.width - 4);
  return lines.map((line, i) => {
    const text = i === 0 ? `${BOX.arrow} ${line}` : `  ${line}`;
    return style(text, { fg: theme.userPrompt, bg: theme.userPromptBg });
  }).join("\n");
}
function renderInterruptMessage(content, cfg) {
  const { theme } = cfg;
  const TREE_CONNECTOR = "\u23BF";
  const parts = [];
  parts.push(colorize(TREE_CONNECTOR, theme.muted));
  parts.push(colorize("Interrupted", theme.toolBulletError));
  parts.push(colorize("\xB7 What should Claude do instead?", theme.muted));
  return parts.join(" ");
}
function renderAssistantMessage(msg, cfg) {
  const output = [];
  for (const item of msg.message.content) {
    const rendered = renderContentItem(item, cfg);
    if (rendered) {
      output.push(rendered);
    }
  }
  return output.join("\n\n");
}
function renderContentItem(item, cfg) {
  const { theme } = cfg;
  switch (item.type) {
    case "text":
      return renderTextContent(item.text, cfg);
    case "thinking":
      if (!cfg.showThinking) return "";
      return renderThinkingContent(item.thinking, cfg);
    case "tool_use":
      return renderToolUse(item, cfg);
    case "image":
      return colorize("[Image]", theme.muted);
    default:
      return "";
  }
}
function renderTextContent(text, cfg) {
  return renderMarkdown(text, cfg);
}
function renderThinkingContent(thinking, cfg) {
  const { theme, width } = cfg;
  const lines = wordWrap(thinking, width - 2);
  const header = colorize("\u2234 Thinking\u2026", theme.thinking);
  const content = lines.map((line) => "  " + style(line, { fg: theme.thinking, italic: true })).join("\n");
  return header + "\n\n" + content;
}
function renderToolUse(tool, cfg) {
  const { theme } = cfg;
  const bullet = colorize(BOX.bullet, theme.toolBulletSuccess);
  const { displayName, isMcp } = formatToolName(tool.name);
  const name = style(displayName, { bold: true });
  const mcpSuffix = isMcp ? colorize(" (MCP)", theme.muted) : "";
  const args = formatToolArgs(tool, theme, isMcp);
  const header = `${bullet} ${name}${mcpSuffix}${args}`;
  if (tool.name === "TodoWrite") {
    const todosOutput = renderTodosFromInput(tool.input, {
      theme,
      indentSize: cfg.indentSize,
      width: cfg.width
    });
    if (todosOutput) {
      return header + "\n" + todosOutput;
    }
  }
  return header;
}
function renderSystemMessage(msg, cfg) {
  const { theme } = cfg;
  if (!msg.content) return "";
  const levelColors = {
    info: theme.muted,
    warning: theme.toolName,
    error: theme.toolBulletError
  };
  const color = levelColors[msg.level ?? "info"] ?? theme.muted;
  return colorize(`[${msg.level ?? "system"}] ${msg.content}`, color);
}
function renderQueueRemove(content, cfg) {
  const { theme } = cfg;
  const text = typeof content === "string" ? content : extractTextContent(content ?? []);
  if (!text.trim()) return "";
  return style(`${BOX.arrow} ${text}`, { fg: theme.userPrompt, bg: theme.userPromptBg });
}
function extractTextContent(content) {
  if (typeof content === "string") {
    return content;
  }
  const texts = [];
  for (const item of content) {
    if (item.type === "text") {
      texts.push(item.text);
    }
  }
  return texts.join("\n");
}

// src/renderer/input.ts
function getInputAreaRows(height) {
  return {
    scrollEnd: height - 4,
    // 36 for height=40
    spinnerRow: height - 3,
    // 37 for height=40
    topLine: height - 2,
    // 38 for height=40
    input: height - 1,
    // 39 for height=40
    bottomLine: height
    // 40 for height=40
  };
}
var DEFAULT_INPUT_UI_CONFIG = {
  width: 100,
  height: 40,
  textColumn: 2
  // After "→ " (arrow + space)
};
function getCursorColumn(config) {
  return config.textColumn + 1;
}
var DEFAULT_BURST_TYPING_CONFIG = {
  initialGapMs: 200,
  minGapMs: 30,
  decayFactor: 0.75
};
function renderInputFrame(config) {
  const { theme, width } = config;
  const lineColor = theme.muted;
  return {
    topLine: horizontalRule(width, lineColor),
    promptPrefix: colorize(`${BOX.arrow} `, theme.userPrompt),
    bottomLine: horizontalRule(width, lineColor)
  };
}
function wrapInputText(text, config) {
  const { width, textColumn } = config;
  const textWidth = width - textColumn - 1;
  const paragraphs = text.split("\n");
  const allLines = [];
  for (const para of paragraphs) {
    const wrapped = wordWrap(para, textWidth);
    allLines.push(...wrapped.length > 0 ? wrapped : [""]);
  }
  return allLines;
}
function splitIntoWords(text) {
  const tokens = [];
  let current = "";
  for (const char of text) {
    if (char === " " || char === "\n") {
      if (current) {
        tokens.push(current);
        current = "";
      }
      tokens.push(char);
    } else {
      current += char;
    }
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}
function generateBurstTypingSegments(text, startTime, config = DEFAULT_BURST_TYPING_CONFIG) {
  const words = splitIntoWords(text);
  if (words.length === 0) {
    return [];
  }
  const segments = [];
  let currentTime = startTime;
  let currentGap = config.initialGapMs / 1e3;
  for (const word of words) {
    segments.push({ text: word, time: currentTime });
    if (word.trim()) {
      currentTime += currentGap;
      currentGap = Math.max(
        config.minGapMs / 1e3,
        currentGap * config.decayFactor
      );
    }
  }
  return segments;
}
function generateInputAreaSetup(config) {
  const rows = getInputAreaRows(config.height);
  const frame = renderInputFrame(config);
  return setScrollRegion(1, rows.scrollEnd) + moveTo(rows.topLine) + frame.topLine + moveTo(rows.input) + frame.promptPrefix + moveTo(rows.bottomLine) + frame.bottomLine + moveTo(rows.input, config.textColumn + 1);
}
function redrawInputFrame(config) {
  const rows = getInputAreaRows(config.height);
  const frame = renderInputFrame(config);
  return (
    // Clear and redraw top line
    moveTo(rows.topLine) + eraseLine() + frame.topLine + // Clear and redraw input line with prompt
    moveTo(rows.input) + eraseLine() + frame.promptPrefix + // Clear and redraw bottom line
    moveTo(rows.bottomLine) + eraseLine() + frame.bottomLine + // Position cursor after "→ "
    moveTo(rows.input, config.textColumn + 1)
  );
}
function generateInputAnimation(text, startTime, uiConfig, typingConfig = DEFAULT_BURST_TYPING_CONFIG) {
  const { theme, width, textColumn } = uiConfig;
  const rows = getInputAreaRows(uiConfig.height);
  const frame = renderInputFrame(uiConfig);
  const segments = [];
  let currentTime = startTime;
  const cursorCol = textColumn + 1;
  segments.push({
    text: moveTo(rows.input, cursorCol),
    time: currentTime
  });
  currentTime += 0.05;
  const maxDisplayLength = width - textColumn - 1;
  let displayText = text.replace(/\n/g, " ");
  let extraDelay = 0;
  if (displayText.length > maxDisplayLength) {
    displayText = displayText.slice(0, maxDisplayLength - 1) + "\u2026";
    extraDelay = 0.4;
  }
  const typingSegments = generateBurstTypingSegments(displayText, currentTime, typingConfig);
  segments.push(...typingSegments);
  if (typingSegments.length > 0) {
    const lastSegment = typingSegments[typingSegments.length - 1];
    currentTime = lastSegment.time + 0.2 + extraDelay;
  }
  segments.push({
    text: moveTo(rows.input) + eraseLine() + frame.promptPrefix + moveTo(rows.input, cursorCol),
    // Cursor back to input position
    time: currentTime
  });
  currentTime += 0.1;
  segments.push({
    text: moveTo(rows.scrollEnd) + "\r\n",
    // Move to scroll area, newline to scroll
    time: currentTime
  });
  const wrappedLines = wrapInputText(text, uiConfig);
  const indent2 = " ".repeat(textColumn + 1);
  const scrollLines = wrappedLines.map((line, i) => {
    const styledLine = colorize(line, theme.userPrompt);
    return i === 0 ? frame.promptPrefix + styledLine : indent2 + styledLine;
  });
  const scrollOutput = scrollLines.join("\r\n") + "\r\n";
  return {
    segments,
    scrollOutput,
    duration: currentTime - startTime
  };
}

// src/generator/builder.ts
var DEFAULT_BUILDER_CONFIG = {
  cols: 100,
  rows: 40,
  termType: "xterm-256color",
  theme: THEMES["tokyo-night"],
  title: "Claude Code Session"
};
var AsciicastBuilder = class {
  config;
  events = [];
  currentTime = 0;
  lastEventTime = 0;
  constructor(config = {}) {
    this.config = { ...DEFAULT_BUILDER_CONFIG, ...config };
  }
  /** Get the current timestamp */
  get time() {
    return this.currentTime;
  }
  /** Set the current timestamp */
  set time(t) {
    this.currentTime = t;
  }
  /** Add time to current timestamp */
  addTime(seconds) {
    this.currentTime += seconds;
    return this;
  }
  /** Add an output event (ANSI text) */
  output(text) {
    if (text.length > 0) {
      const interval = Math.max(0, this.currentTime - this.lastEventTime);
      const event = [interval, "o", text];
      this.events.push(event);
      this.lastEventTime = this.currentTime;
    }
    return this;
  }
  /** Add output with a newline */
  outputLine(text) {
    return this.output(text + "\n");
  }
  /** Add multiple lines of output */
  outputLines(lines) {
    for (const line of lines) {
      this.outputLine(line);
    }
    return this;
  }
  /** Add a marker event for navigation */
  marker(label) {
    const interval = Math.max(0, this.currentTime - this.lastEventTime);
    const event = [interval, "m", label];
    this.events.push(event);
    return this;
  }
  /** Add output and marker at the same time */
  outputWithMarker(text, markerLabel) {
    this.marker(markerLabel);
    this.output(text);
    return this;
  }
  /** Add a blank line */
  blank() {
    return this.output("\n");
  }
  /** Add multiple blank lines */
  blanks(count) {
    for (let i = 0; i < count; i++) {
      this.blank();
    }
    return this;
  }
  /** Clear the screen (ANSI escape sequence) */
  clear() {
    return this.output("\x1B[2J\x1B[H");
  }
  /** Build the header */
  buildHeader() {
    return {
      version: 3,
      term: {
        cols: this.config.cols,
        rows: this.config.rows,
        type: this.config.termType,
        theme: this.config.theme
      },
      timestamp: this.config.timestamp ?? Math.floor(Date.now() / 1e3),
      title: this.config.title
    };
  }
  /** Build the complete document */
  build() {
    return {
      header: this.buildHeader(),
      events: [...this.events]
    };
  }
  /** Get current event count */
  get eventCount() {
    return this.events.length;
  }
  /** Reset builder state (keeps config) */
  reset() {
    this.events = [];
    this.currentTime = 0;
    this.lastEventTime = 0;
    return this;
  }
};
function serializeCast(doc) {
  const lines = [];
  lines.push(JSON.stringify(doc.header));
  for (const event of doc.events) {
    lines.push(JSON.stringify(event));
  }
  return lines.join("\n") + "\n";
}
function parseCast(content) {
  const lines = content.trim().split("\n");
  if (lines.length === 0) {
    throw new Error("Empty cast file");
  }
  const header = JSON.parse(lines[0]);
  const events = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      events.push(JSON.parse(line));
    }
  }
  return { header, events };
}

// src/generator/timing.ts
function resolveTimingConfig(options) {
  const presetName = options.preset;
  if (presetName) {
    const presetConfig = TIMING_PRESETS[presetName];
    if (presetConfig) {
      return {
        ...presetConfig,
        // Allow overrides
        maxWait: options.maxWait ?? presetConfig.maxWait,
        thinkingPause: options.thinkingPause ?? presetConfig.thinkingPause,
        typingEffect: options.typingEffect ?? presetConfig.typingEffect,
        typingSpeed: options.typingSpeed ?? presetConfig.typingSpeed
      };
    }
  }
  return {
    ...TIMING_PRESETS["default"],
    ...options
  };
}
var TimingCalculator = class {
  config;
  lastTimestamp = null;
  currentTime = 0;
  constructor(config) {
    this.config = config;
  }
  /** Get the current playback time */
  get time() {
    return this.currentTime;
  }
  /** Set the current playback time (for syncing with external animation) */
  set time(value) {
    this.currentTime = value;
  }
  /** Reset the calculator */
  reset() {
    this.lastTimestamp = null;
    this.currentTime = 0;
  }
  /** Calculate time for next entry */
  nextEntry(entry) {
    const timestamp = getTimestamp(entry);
    if (this.config.maxWait === Infinity && timestamp && this.lastTimestamp) {
      const realDelta = (timestamp.getTime() - this.lastTimestamp.getTime()) / 1e3;
      this.lastTimestamp = timestamp;
      this.currentTime += Math.max(0, realDelta);
      return this.currentTime;
    }
    let delta = 0;
    if (timestamp && this.lastTimestamp) {
      const realDelta = (timestamp.getTime() - this.lastTimestamp.getTime()) / 1e3;
      delta = Math.min(realDelta, this.config.maxWait);
    } else {
      delta = this.getDefaultPause(entry);
    }
    if (timestamp) {
      this.lastTimestamp = timestamp;
    }
    this.currentTime += delta;
    return this.currentTime;
  }
  /** Add pause for assistant response (thinking time) */
  addThinkingPause() {
    this.currentTime += this.config.thinkingPause;
  }
  /** Add a fixed pause */
  addPause(seconds) {
    this.currentTime += Math.min(seconds, this.config.maxWait);
  }
  /** Calculate typing duration for text */
  getTypingDuration(text) {
    if (!this.config.typingEffect || this.config.typingSpeed <= 0) {
      return 0;
    }
    return text.length / this.config.typingSpeed;
  }
  /** Check if typing effect is enabled */
  get hasTypingEffect() {
    return this.config.typingEffect && this.config.typingSpeed > 0;
  }
  /** Get the timing config */
  getConfig() {
    return { ...this.config };
  }
  // =============================================================================
  // Private Helpers
  // =============================================================================
  getDefaultPause(entry) {
    switch (entry.type) {
      case "user":
        if ("toolUseResult" in entry && entry.toolUseResult) {
          return 0.1;
        }
        return 0.3;
      // User typing
      case "assistant":
        return this.config.thinkingPause;
      case "system":
        return 0.2;
      default:
        return 0.1;
    }
  }
};
function generateTypingSegments(text, startTime, charsPerSecond, chunkSize = 3) {
  if (charsPerSecond <= 0) {
    return [{ text, time: startTime }];
  }
  const segments = [];
  const timePerChar = 1 / charsPerSecond;
  let currentTime = startTime;
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.substring(i, Math.min(i + chunkSize, text.length));
    segments.push({ text: chunk, time: currentTime });
    currentTime += chunk.length * timePerChar;
  }
  return segments;
}
function generateLineSegments(text, startTime, lineDelay) {
  const lines = text.split("\n");
  const segments = [];
  let currentTime = startTime;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const output = i < lines.length - 1 ? line + "\n" : line;
    segments.push({ text: output, time: currentTime });
    currentTime += lineDelay;
  }
  return segments;
}

// src/generator/markers.ts
var DEFAULT_MARKER_OPTIONS = {
  mode: "all",
  labelLength: 30
};
function shouldHaveMarker(entry, mode) {
  if (mode === "none") return false;
  switch (entry.type) {
    case "user":
      if (entry.toolUseResult) {
        return mode === "all" || mode === "tools";
      }
      return mode === "all" || mode === "user";
    case "assistant":
      if (hasToolCalls(entry)) {
        return mode === "all" || mode === "tools";
      }
      return mode === "all";
    default:
      return false;
  }
}
function generateMarkerLabel(entry, maxLength = 30) {
  switch (entry.type) {
    case "user":
      return generateUserMarkerLabel(entry, maxLength);
    case "assistant":
      return generateAssistantMarkerLabel(entry, maxLength);
    default:
      return null;
  }
}
function generateUserMarkerLabel(msg, maxLength) {
  if (msg.toolUseResult) {
    const isError = typeof msg.toolUseResult === "string" || msg.toolUseResult.is_error;
    if (isError) {
      return "\u2717 Tool error";
    }
    return "\u2713 Tool result";
  }
  const text = extractText(msg.message.content).trim();
  if (!text) return "> (empty prompt)";
  if (isCommandMessage(text)) {
    const command = parseCommandTags(text);
    if (command) {
      let marker = `> ${command.name}`;
      if (command.args.trim()) {
        marker += ` (${command.args})`;
      }
      return marker;
    }
    const stdout = parseLocalCommandStdout(text);
    if (stdout !== null) {
      return stdout ? "> (command output)" : "> (command)";
    }
  }
  const firstLine = text.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength - 2) {
    return `> ${cleaned}`;
  }
  return `> ${cleaned.substring(0, maxLength - 3)}\u2026`;
}
function generateAssistantMarkerLabel(msg, maxLength) {
  const tools = extractToolUse(msg.message.content);
  if (tools.length > 0) {
    const firstTool = tools[0];
    const toolInfo = formatToolForMarker(firstTool.name, firstTool.input);
    if (tools.length === 1) {
      return truncateMarker(`\u25CF ${toolInfo}`, maxLength);
    }
    return truncateMarker(`\u25CF ${toolInfo} (+${tools.length - 1})`, maxLength);
  }
  const text = extractText(msg.message.content).trim();
  if (!text) return "Claude: (empty)";
  const firstLine = text.split("\n")[0] ?? "";
  const cleaned = firstLine.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength - 8) {
    return `Claude: ${cleaned}`;
  }
  return `Claude: ${cleaned.substring(0, maxLength - 9)}\u2026`;
}
function formatToolForMarker(name, input) {
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      if (typeof input["file_path"] === "string") {
        const path = input["file_path"];
        const filename = path.split("/").pop() ?? path;
        return `${name}(${filename})`;
      }
      return name;
    case "Bash":
      if (typeof input["command"] === "string") {
        const cmd = input["command"];
        const short = cmd.length > 20 ? cmd.substring(0, 19) + "\u2026" : cmd;
        return `Bash(${short})`;
      }
      return "Bash";
    case "Glob":
      if (typeof input["pattern"] === "string") {
        return `Glob(${input["pattern"]})`;
      }
      return "Glob";
    case "Grep":
      if (typeof input["pattern"] === "string") {
        const pattern = input["pattern"];
        const short = pattern.length > 15 ? pattern.substring(0, 14) + "\u2026" : pattern;
        return `Grep(${short})`;
      }
      return "Grep";
    case "Task":
      if (typeof input["description"] === "string") {
        return `\u2935 Task(${input["description"]})`;
      }
      return "\u2935 Task";
    case "TodoWrite":
      return "TodoWrite";
    case "WebFetch":
    case "WebSearch":
      return name;
    default:
      return name;
  }
}
function hasToolCalls(msg) {
  return msg.message.content.some((item) => item.type === "tool_use");
}
function truncateMarker(label, maxLength) {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 1) + "\u2026";
}

// src/renderer/verbs.json
var verbs_default = {
  verbs: [
    "Accomplishing",
    "Flamb\xE9ing",
    "Perusing",
    "Wandering",
    "Concocting",
    "Julienning",
    "Smooshing",
    "Baking",
    "Forging",
    "Pontificating",
    "Whisking",
    "Crafting",
    "Manifesting",
    "Stewing",
    "Bootstrapping",
    "Galloping",
    "Puttering",
    "Zesting",
    "Deciphering",
    "Misting",
    "Swooping",
    "Caramelizing",
    "Gusting",
    "Reticulating",
    "Doing",
    "Mustering",
    "Tomfoolering",
    "Channelling",
    "Herding",
    "Schlepping",
    "Elucidating",
    "Nucleating",
    "Unfurling",
    "Coalescing",
    "Imagining",
    "Shimmying",
    "Finagling",
    "Percolating",
    "Waiting",
    "Computing",
    "Ionizing",
    "Slithering",
    "Architecting",
    "Flummoxing",
    "Pondering",
    "Whirring",
    "Cooking",
    "Lollygagging",
    "Sprouting",
    "Booping",
    "Gallivanting",
    "Proofing",
    "Wrangling",
    "Crystallizing",
    "Metamorphosing",
    "Swirling",
    "Canoodling",
    "Germinating",
    "Razzmatazzing",
    "Discombobulating",
    "Musing",
    "Tinkering",
    "Channeling",
    "Hatching",
    "Scheming",
    "Effecting",
    "Noodling",
    "Undulating",
    "Clauding",
    "Ideating",
    "Shenaniganing",
    "Fermenting",
    "Perambulating",
    "Waddling",
    "Composing",
    "Infusing",
    "Sketching",
    "Actualizing",
    "Flowing",
    "Photosynthesizing",
    "Whatchamacalliting",
    "Contemplating",
    "Levitating",
    "Spinning",
    "Boogieing",
    "Frolicking",
    "Processing",
    "Working",
    "Crunching",
    "Meandering",
    "Sussing",
    "Calculating",
    "Generating",
    "Quantumizing",
    "Determining",
    "Mulling",
    "Synthesizing",
    "Cerebrating",
    "Hashing",
    "Scampering",
    "Drizzling",
    "Nesting",
    "Twisting",
    "Churning",
    "Honking",
    "Seasoning",
    "Envisioning",
    "Osmosing",
    "Vibing",
    "Combobulating",
    "Inferring",
    "Skedaddling",
    "Actioning",
    "Flibbertigibbeting",
    "Philosophising",
    "Warping",
    "Considering",
    "Kneading",
    "Spelunking",
    "Beaming",
    "Forming",
    "Precipitating",
    "Wibbling",
    "Creating",
    "Marinating",
    "Sublimating",
    "Brewing",
    "Garnishing",
    "Puzzling",
    "Deliberating",
    "Moseying",
    "Symbioting",
    "Catapulting",
    "Harmonizing",
    "Ruminating",
    "Doodling",
    "Nebulizing",
    "Transmuting",
    "Choreographing",
    "Hibernating",
    "Scurrying",
    "Enchanting",
    "Orbiting",
    "Unravelling",
    "Cogitating",
    "Incubating",
    "Simmering"
  ]
};

// src/renderer/spinner.ts
var SPINNER_CHARS = ["\xB7", "\u2722", "\u2733", "\u273B", "\u273D", "\u273B", "\u2733", "\u2722"];
var SHIMMER_BASE_COLOR = "#d77757";
var SHIMMER_HIGHLIGHT_COLOR = "#eb9f7f";
var DEFAULT_FRAME_INTERVAL_MS = 200;
var DEFAULT_SHIMMER_WINDOW_SIZE = 3;
var VERBS = verbs_default.verbs;
var DEFAULT_SPINNER_CONFIG = {
  frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
  shimmerWindowSize: DEFAULT_SHIMMER_WINDOW_SIZE,
  baseColor: SHIMMER_BASE_COLOR,
  highlightColor: SHIMMER_HIGHLIGHT_COLOR
};
function createSpinnerState() {
  return {
    mode: "off" /* OFF */,
    verb: null,
    row: null
  };
}
function selectVerb(verbs, seed) {
  if (verbs.length === 0) {
    return "Processing";
  }
  const hash = Math.abs((seed + 1) * 2654435761 | 0);
  const index = hash % verbs.length;
  return verbs[index];
}
function getShimmerWindow(frameIndex, textLength, windowSize) {
  const totalPositions = textLength + windowSize;
  const position = frameIndex % totalPositions;
  const start = Math.max(0, position - windowSize + 1);
  const end = Math.min(textLength, position + 1);
  return [start, end];
}
function applyShimmer(text, frameIndex, config) {
  const [windowStart, windowEnd] = getShimmerWindow(
    frameIndex,
    text.length,
    config.shimmerWindowSize
  );
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isHighlighted = i >= windowStart && i < windowEnd;
    const color = isHighlighted ? config.highlightColor : config.baseColor;
    result += fg(color) + char;
  }
  return result + RESET;
}
function renderSpinnerFrame(verb, frameIndex, config) {
  const spinnerChar = SPINNER_CHARS[frameIndex % SPINNER_CHARS.length];
  const shimmeredVerb = applyShimmer(verb + "\u2026", frameIndex, config);
  return fg(config.baseColor) + spinnerChar + RESET + " " + shimmeredVerb;
}
function generateStatusSpinnerSegments(verb, startTime, duration, config, row) {
  const segments = [];
  const frameIntervalSec = config.frameIntervalMs / 1e3;
  const totalFrames = Math.max(1, Math.floor(duration / frameIntervalSec));
  for (let i = 0; i < totalFrames; i++) {
    const time = startTime + i * frameIntervalSec;
    const frameContent = renderSpinnerFrame(verb, i, config);
    let text = "";
    if (row !== void 0) {
      text = moveTo(row, 1) + eraseLine() + frameContent;
    } else {
      text = "\r" + eraseLine() + frameContent;
    }
    segments.push({ text, time });
  }
  return segments;
}
function generateSpinnerClear(row) {
  if (row !== void 0) {
    return moveTo(row, 1) + eraseLine();
  }
  return "\r" + eraseLine();
}

// src/generator/convert.ts
function convertToAsciicast(entries, options = {}) {
  const renderConfig = { ...DEFAULT_RENDER_CONFIG, ...options.render };
  const markerOptions = { ...DEFAULT_MARKER_OPTIONS, ...options.markers };
  const timingConfig = resolveTimingConfig(options.timing ?? {});
  const inputAnimation = options.inputAnimation ?? false;
  const burstConfig = {
    ...DEFAULT_BURST_TYPING_CONFIG,
    ...options.inputAnimationConfig
  };
  const asciicastTheme = toAsciicastTheme(renderConfig.theme);
  const builder = new AsciicastBuilder({
    ...options.builder,
    theme: asciicastTheme
  });
  const termRows = options.builder?.rows ?? 40;
  const termCols = options.builder?.cols ?? 100;
  const timing = new TimingCalculator(timingConfig);
  let entriesRendered = 0;
  let markersGenerated = 0;
  const inputConfig = {
    theme: renderConfig.theme,
    width: termCols,
    height: termRows,
    textColumn: 2
  };
  if (inputAnimation) {
    builder.output(generateInputAreaSetup(inputConfig));
  }
  const statusSpinner = options.statusSpinner ?? false;
  let currentActiveForm = null;
  const firstTimestamp = entries[0] && "timestamp" in entries[0] ? new Date(entries[0].timestamp).getTime() : Date.now();
  let messageIndex = Math.abs(firstTimestamp | 0) % 1e3;
  const MIN_VERB_INTERVAL = 2;
  let lastVerbChangeTime = 0;
  let lastVerb = null;
  const spinner = createSpinnerState();
  const spinnerConfig = {
    ...DEFAULT_SPINNER_CONFIG,
    theme: renderConfig.theme
  };
  const rows = getInputAreaRows(termRows);
  const spinnerRow = inputAnimation ? rows.spinnerRow : void 0;
  const startSpinner = (verb) => {
    if (spinner.mode !== "off" /* OFF */) {
      builder.output(generateSpinnerClear(spinner.row ?? void 0));
    }
    const segments = generateStatusSpinnerSegments(
      verb,
      builder.time,
      0.2,
      // Single frame
      spinnerConfig,
      spinnerRow
    );
    const firstSegment = segments[0];
    if (firstSegment) {
      builder.output(firstSegment.text);
    }
    spinner.verb = verb;
    spinner.row = spinnerRow ?? null;
    spinner.mode = spinnerRow !== void 0 ? "fixed" /* FIXED */ : "inline" /* INLINE */;
  };
  const continueSpinner = (duration) => {
    if (spinner.mode === "off" /* OFF */ || !spinner.verb) return;
    if (duration <= 0) return;
    const segments = generateStatusSpinnerSegments(
      spinner.verb,
      builder.time,
      duration,
      spinnerConfig,
      spinner.row ?? void 0
    );
    for (const segment of segments) {
      builder.time = segment.time;
      builder.output(segment.text);
    }
  };
  const clearSpinner = () => {
    if (spinner.mode === "off" /* OFF */) return;
    builder.output(generateSpinnerClear(spinner.row ?? void 0));
    if (spinner.row !== null && inputAnimation) {
    } else if (spinner.row === null) {
      builder.output("\r\n");
    }
    spinner.mode = "off" /* OFF */;
    spinner.verb = null;
    spinner.row = null;
  };
  const getThrottledVerb = () => {
    const elapsed = builder.time - lastVerbChangeTime;
    if (lastVerb !== null && elapsed < MIN_VERB_INTERVAL) {
      messageIndex++;
      return lastVerb;
    }
    const verb = currentActiveForm ?? selectVerb(VERBS, messageIndex);
    messageIndex++;
    lastVerbChangeTime = builder.time;
    lastVerb = verb;
    return verb;
  };
  for (const entry of entries) {
    if (!isRenderableMessage(entry)) {
      continue;
    }
    if (statusSpinner && entry.type === "user" && "toolUseResult" in entry && entry.toolUseResult) {
      if (isTodoWriteToolResult(entry.toolUseResult)) {
        const inProgressTodo = entry.toolUseResult.newTodos.find(
          (t) => t.status === "in_progress"
        );
        currentActiveForm = inProgressTodo?.activeForm ?? null;
      }
    }
    const isBashOutput = entry.type === "user" && typeof entry.message?.content === "string" && (entry.message.content.includes("<bash-stdout>") || entry.message.content.includes("<bash-stderr>"));
    const isInterruptMessage = entry.type === "user" && !("toolUseResult" in entry && entry.toolUseResult) && // String content
    (typeof entry.message?.content === "string" && entry.message.content.includes("[Request interrupted by user]") || // Array content
    Array.isArray(entry.message?.content) && entry.message.content.some(
      (item) => item.type === "text" && item.text?.includes("[Request interrupted by user]")
    ));
    const isSystemInfoMessage = entry.type === "system" && "level" in entry && entry.level === "info";
    const isMetaMessage = entry.type === "user" && "isMeta" in entry && entry.isMeta;
    const isUserPrompt = entry.type === "user" && !("toolUseResult" in entry && entry.toolUseResult) && !isMetaMessage && !isBashOutput && !isInterruptMessage;
    const useInputAnimation = inputAnimation && isUserPrompt;
    const isAssistantWithText = entry.type === "assistant" && entry.message.content.some((item) => item.type === "text" && item.text.trim() !== "");
    const isToolCall = entry.type === "assistant" && entry.message.content.some((item) => item.type === "tool_use");
    const isSimpleToolCall = isToolCall && entry.type === "assistant" && !entry.message.content.some(
      (item) => item.type === "tool_use" && item.name === "TodoWrite"
    );
    const isToolResult = entry.type === "user" && "toolUseResult" in entry && entry.toolUseResult;
    const isAgenticContent = (
      // Assistant with thinking or tool_use
      entry.type === "assistant" && entry.message.content.some(
        (item) => item.type === "thinking" || item.type === "tool_use"
      ) || // Tool result (user message with toolUseResult)
      isToolResult
    );
    const shouldClearSpinner = isMetaMessage || isSystemInfoMessage || isInterruptMessage;
    if (!useInputAnimation) {
      const previousTime = builder.time;
      const entryTime = timing.nextEntry(entry);
      if (statusSpinner && spinner.mode !== "off" /* OFF */) {
        const timeDelta = entryTime - previousTime;
        if (timeDelta > 0) {
          continueSpinner(timeDelta);
        }
      }
      builder.time = entryTime;
    } else if (statusSpinner && spinner.mode !== "off" /* OFF */) {
      const previousTime = builder.time;
      const entryTime = timing.nextEntry(entry);
      const timeDelta = entryTime - previousTime;
      if (timeDelta > 0) {
        continueSpinner(timeDelta);
      }
      builder.time = entryTime;
    }
    if (statusSpinner && spinner.mode !== "off" /* OFF */ && shouldClearSpinner) {
      clearSpinner();
    }
    if (statusSpinner && spinner.mode === "inline" /* INLINE */ && isAssistantWithText) {
      spinner.mode = "off" /* OFF */;
      spinner.verb = null;
      spinner.row = null;
    }
    if (shouldHaveMarker(entry, markerOptions.mode)) {
      const label = generateMarkerLabel(entry, markerOptions.labelLength);
      if (label) {
        builder.marker(label);
        markersGenerated++;
      }
    }
    const entryText = "message" in entry ? extractTextContent(entry.message.content) : "";
    const isCommand = entryText.trim().startsWith("<command-name>") || entryText.trim().startsWith("<local-command-stdout>");
    if (useInputAnimation && !isCommand) {
      const isBashInput = typeof entry.message?.content === "string" && isBashInputMessage(entry.message.content);
      const text = isBashInput ? `! ${parseBashInput(entry.message.content)}` : entryText;
      if (!text.trim()) continue;
      const inputConfig2 = {
        theme: renderConfig.theme,
        width: termCols,
        height: termRows,
        textColumn: 2
      };
      const animation = generateInputAnimation(
        text,
        builder.time,
        inputConfig2,
        burstConfig
      );
      for (const segment of animation.segments) {
        builder.time = segment.time;
        builder.output(segment.text);
      }
      if (isBashInput) {
        const bashCmd = parseBashInput(entry.message.content);
        const bashOutput = renderBashInput(bashCmd, { theme: renderConfig.theme, width: termCols });
        builder.output(bashOutput.replace(/\n/g, "\r\n") + "\r\n");
      } else {
        builder.output(animation.scrollOutput);
      }
      builder.output(redrawInputFrame(inputConfig2));
      timing.time = builder.time;
      if (statusSpinner) {
        startSpinner(getThrottledVerb());
      }
    } else {
      const rendered = renderMessage(entry, renderConfig);
      if (!rendered) continue;
      const isBashInput = entry.type === "user" && typeof entry.message?.content === "string" && entry.message.content.includes("<bash-input>");
      const trailing = isSimpleToolCall || isBashInput || isBashOutput ? "\r\n" : "\r\n\r\n";
      const output = rendered.replace(/\n/g, "\r\n") + trailing;
      if (inputAnimation) {
        builder.output(moveTo(rows.scrollEnd - 1, 1) + "\r\n");
      }
      builder.output(output);
      if (inputAnimation) {
        builder.output(redrawInputFrame(inputConfig));
      }
      if (statusSpinner) {
        if (isUserPrompt) {
          startSpinner(getThrottledVerb());
        } else if (isAgenticContent && spinner.mode === "off" /* OFF */) {
          startSpinner(getThrottledVerb());
        }
      }
    }
    entriesRendered++;
  }
  const document = builder.build();
  return {
    document,
    stats: {
      entriesProcessed: entries.length,
      entriesRendered,
      eventsGenerated: document.events.length,
      markersGenerated,
      duration: builder.time
    }
  };
}
function convertWithPreset(entries, preset, theme) {
  return convertToAsciicast(entries, {
    timing: { preset },
    render: theme ? { theme } : void 0
  });
}
function quickConvert(entries) {
  return convertToAsciicast(entries).document;
}
function getSessionInfo(entries) {
  let startTime = null;
  let endTime = null;
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let hasAgents = false;
  for (const entry of entries) {
    if ("timestamp" in entry && typeof entry.timestamp === "string") {
      const timestamp = new Date(entry.timestamp);
      if (!startTime || timestamp < startTime) startTime = timestamp;
      if (!endTime || timestamp > endTime) endTime = timestamp;
    }
    if ("isSidechain" in entry && entry.isSidechain) {
      hasAgents = true;
    }
    if (entry.type === "user") {
      if (!entry.toolUseResult) {
        userMessages++;
      }
    } else if (entry.type === "assistant") {
      assistantMessages++;
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
    hasAgents
  };
}
function generateTitle(info) {
  const parts = ["Claude Code Session"];
  if (info.toolCalls > 0) {
    parts.push(`(${info.toolCalls} tool calls)`);
  }
  return parts.join(" ");
}
export {
  AsciicastBuilder,
  BOLD,
  BOX,
  CATPPUCCIN_MOCHA,
  DEFAULT_BUILDER_CONFIG,
  DEFAULT_BURST_TYPING_CONFIG,
  DEFAULT_INPUT_UI_CONFIG,
  DEFAULT_MARKER_CONFIG,
  DEFAULT_MARKER_OPTIONS,
  DEFAULT_RENDER_CONFIG,
  DIM,
  DRACULA,
  ITALIC,
  NORD,
  RENDER_THEMES,
  RESET,
  RESET_BOLD,
  RESET_DIM,
  RESET_ITALIC,
  RESET_STRIKETHROUGH,
  RESET_UNDERLINE,
  STRIKETHROUGH,
  THEMES,
  TIMING_PRESETS,
  TOKYO_NIGHT,
  TOKYO_NIGHT_SEMANTIC,
  TOKYO_STORM,
  TimingCalculator,
  UNDERLINE,
  bg,
  box,
  classifyContent,
  colorize,
  convertToAsciicast,
  convertWithPreset,
  eraseLine,
  eraseToEndOfLine,
  extractClip,
  extractText,
  extractTextContent,
  extractThinking,
  extractToolUse,
  fg,
  formatToolArgs,
  formatToolInputSummary,
  formatToolName,
  generateBurstTypingSegments,
  generateInputAnimation,
  generateInputAreaSetup,
  generateLineSegments,
  generateMarkerLabel,
  generateTitle,
  generateTypingSegments,
  getAssistantMessageLabel,
  getClipSummary,
  getCursorColumn,
  getInputAreaRows,
  getMessageType,
  getSessionInfo,
  getTheme,
  getTimestamp,
  getUserMessageLabel,
  getUuid,
  hasThinking,
  hasToolUse,
  hexToRgb,
  horizontalRule,
  indent,
  interleaveToolCallsAndResults,
  isAssistantMessage,
  isBashInputMessage,
  isBashMessage,
  isCommandMessage,
  isFileHistorySnapshotMessage,
  isQueueOperationMessage,
  isRenderableMessage,
  isSummaryMessage,
  isSystemMessage,
  isUserMessage,
  loadTranscript,
  moveTo,
  moveToCol,
  parseBashInput,
  parseBashOutput,
  parseCast,
  parseCommandTags,
  parseLine,
  parseLocalCommandStdout,
  quickConvert,
  redrawInputFrame,
  renderBashInput,
  renderBashOutput,
  renderInputFrame,
  renderLocalStdout,
  renderMessage,
  renderSlashCommand,
  renderToolResult,
  resetScrollRegion,
  resolveTimingConfig,
  restoreCursor,
  saveCursor,
  serializeCast,
  setScrollRegion,
  shouldHaveMarker,
  sortByTimestamp,
  splitIntoWords,
  stripAnsi,
  style,
  toAsciicastTheme,
  truncate,
  truncateOutput,
  visibleLength,
  wordWrap,
  wrapInputText
};
//# sourceMappingURL=index.js.map