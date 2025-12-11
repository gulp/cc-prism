#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
var init_loader = __esm({
  "src/parser/loader.ts"() {
    "use strict";
  }
});

// src/types/asciicast.ts
var THEMES, TIMING_PRESETS;
var init_asciicast = __esm({
  "src/types/asciicast.ts"() {
    "use strict";
    THEMES = {
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
    TIMING_PRESETS = {
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
  }
});

// src/generator/builder.ts
function serializeCast(doc) {
  const lines = [];
  lines.push(JSON.stringify(doc.header));
  for (const event of doc.events) {
    lines.push(JSON.stringify(event));
  }
  return lines.join("\n") + "\n";
}
var DEFAULT_BUILDER_CONFIG, AsciicastBuilder;
var init_builder = __esm({
  "src/generator/builder.ts"() {
    "use strict";
    init_asciicast();
    DEFAULT_BUILDER_CONFIG = {
      cols: 100,
      rows: 40,
      termType: "xterm-256color",
      theme: THEMES["tokyo-night"],
      title: "Claude Code Session"
    };
    AsciicastBuilder = class {
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
  }
});

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
var TimingCalculator;
var init_timing = __esm({
  "src/generator/timing.ts"() {
    "use strict";
    init_asciicast();
    init_loader();
    TimingCalculator = class {
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
  }
});

// src/renderer/content.ts
function extractText(content) {
  if (typeof content === "string") {
    return content;
  }
  return content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
}
function extractToolUse(content) {
  return content.filter(
    (item) => item.type === "tool_use"
  );
}
var init_content = __esm({
  "src/renderer/content.ts"() {
    "use strict";
  }
});

// src/renderer/ansi.ts
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
function moveTo(row, col = 1) {
  return `${CSI}${row};${col}H`;
}
function eraseLine() {
  return `${CSI}2K`;
}
function setScrollRegion(top, bottom) {
  return `${CSI}${top};${bottom}r`;
}
var ESC, CSI, RESET, BOLD, DIM, ITALIC, UNDERLINE, STRIKETHROUGH, RESET_BOLD, RESET_DIM, RESET_ITALIC, RESET_UNDERLINE, RESET_STRIKETHROUGH, BOX;
var init_ansi = __esm({
  "src/renderer/ansi.ts"() {
    "use strict";
    ESC = "\x1B";
    CSI = `${ESC}[`;
    RESET = `${CSI}0m`;
    BOLD = `${CSI}1m`;
    DIM = `${CSI}2m`;
    ITALIC = `${CSI}3m`;
    UNDERLINE = `${CSI}4m`;
    STRIKETHROUGH = `${CSI}9m`;
    RESET_BOLD = `${CSI}22m`;
    RESET_DIM = `${CSI}22m`;
    RESET_ITALIC = `${CSI}23m`;
    RESET_UNDERLINE = `${CSI}24m`;
    RESET_STRIKETHROUGH = `${CSI}29m`;
    BOX = {
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
  }
});

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
var BASH_MODE_PINK, BASH_COMMAND_BG, BASH_COMMAND_TEXT, BASH_STDERR_COLOR;
var init_commands = __esm({
  "src/renderer/commands.ts"() {
    "use strict";
    init_ansi();
    BASH_MODE_PINK = "#fd5db1";
    BASH_COMMAND_BG = "#413c41";
    BASH_COMMAND_TEXT = "#ffffff";
    BASH_STDERR_COLOR = "#ff6b80";
  }
});

// src/generator/markers.ts
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
var DEFAULT_MARKER_OPTIONS;
var init_markers = __esm({
  "src/generator/markers.ts"() {
    "use strict";
    init_content();
    init_commands();
    DEFAULT_MARKER_OPTIONS = {
      mode: "all",
      labelLength: 30
    };
  }
});

// src/renderer/todos.ts
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
var TODO_CHARS;
var init_todos = __esm({
  "src/renderer/todos.ts"() {
    "use strict";
    init_ansi();
    TODO_CHARS = {
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
  }
});

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
var init_markdown = __esm({
  "src/renderer/markdown.ts"() {
    "use strict";
    init_ansi();
  }
});

// src/renderer/theme.ts
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
var TOKYO_NIGHT, TOKYO_STORM, DRACULA, NORD, CATPPUCCIN_MOCHA, RENDER_THEMES;
var init_theme = __esm({
  "src/renderer/theme.ts"() {
    "use strict";
    init_asciicast();
    TOKYO_NIGHT = {
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
    TOKYO_STORM = {
      ...TOKYO_NIGHT,
      bg: "#24283b"
    };
    DRACULA = {
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
    NORD = {
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
    CATPPUCCIN_MOCHA = {
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
    RENDER_THEMES = {
      "tokyo-night": TOKYO_NIGHT,
      "tokyo-storm": TOKYO_STORM,
      dracula: DRACULA,
      nord: NORD,
      "catppuccin-mocha": CATPPUCCIN_MOCHA
    };
  }
});

// src/renderer/diff.ts
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
var LINE_PREFIX_WIDTH;
var init_diff = __esm({
  "src/renderer/diff.ts"() {
    "use strict";
    init_ansi();
    LINE_PREFIX_WIDTH = 9;
  }
});

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
var init_tool_results = __esm({
  "src/renderer/tool-results.ts"() {
    "use strict";
    init_ansi();
    init_diff();
    init_todos();
  }
});

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
var init_tool_formatting = __esm({
  "src/renderer/tool-formatting.ts"() {
    "use strict";
    init_ansi();
  }
});

// src/renderer/messages.ts
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
var DEFAULT_RENDER_CONFIG;
var init_messages = __esm({
  "src/renderer/messages.ts"() {
    "use strict";
    init_ansi();
    init_todos();
    init_markdown();
    init_theme();
    init_tool_results();
    init_tool_formatting();
    init_commands();
    DEFAULT_RENDER_CONFIG = {
      theme: TOKYO_NIGHT,
      width: 100,
      maxToolOutputLines: 5,
      // Matches Claude Code's compact display (wrapped lines counted)
      showThinking: true,
      indentSize: 2
    };
  }
});

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
var DEFAULT_BURST_TYPING_CONFIG;
var init_input = __esm({
  "src/renderer/input.ts"() {
    "use strict";
    init_ansi();
    DEFAULT_BURST_TYPING_CONFIG = {
      initialGapMs: 200,
      minGapMs: 30,
      decayFactor: 0.75
    };
  }
});

// src/types/messages.ts
function isRenderableMessage(entry) {
  return entry.type === "user" || entry.type === "assistant" || entry.type === "system" && entry.content !== null;
}
var init_messages2 = __esm({
  "src/types/messages.ts"() {
    "use strict";
  }
});

// src/renderer/verbs.json
var verbs_default;
var init_verbs = __esm({
  "src/renderer/verbs.json"() {
    verbs_default = {
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
  }
});

// src/renderer/spinner.ts
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
var SPINNER_CHARS, SHIMMER_BASE_COLOR, SHIMMER_HIGHLIGHT_COLOR, DEFAULT_FRAME_INTERVAL_MS, DEFAULT_SHIMMER_WINDOW_SIZE, VERBS, DEFAULT_SPINNER_CONFIG;
var init_spinner = __esm({
  "src/renderer/spinner.ts"() {
    "use strict";
    init_ansi();
    init_verbs();
    SPINNER_CHARS = ["\xB7", "\u2722", "\u2733", "\u273B", "\u273D", "\u273B", "\u2733", "\u2722"];
    SHIMMER_BASE_COLOR = "#d77757";
    SHIMMER_HIGHLIGHT_COLOR = "#eb9f7f";
    DEFAULT_FRAME_INTERVAL_MS = 200;
    DEFAULT_SHIMMER_WINDOW_SIZE = 3;
    VERBS = verbs_default.verbs;
    DEFAULT_SPINNER_CONFIG = {
      frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
      shimmerWindowSize: DEFAULT_SHIMMER_WINDOW_SIZE,
      baseColor: SHIMMER_BASE_COLOR,
      highlightColor: SHIMMER_HIGHLIGHT_COLOR
    };
  }
});

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
var init_convert = __esm({
  "src/generator/convert.ts"() {
    "use strict";
    init_builder();
    init_timing();
    init_markers();
    init_messages();
    init_theme();
    init_input();
    init_ansi();
    init_messages2();
    init_todos();
    init_commands();
    init_spinner();
  }
});

// src/cli/upload.ts
var upload_exports = {};
__export(upload_exports, {
  checkAsciinema: () => checkAsciinema,
  uploadToAsciinema: () => uploadToAsciinema
});
import { spawn } from "child_process";
async function uploadToAsciinema(filePath) {
  return new Promise((resolve3) => {
    const proc = spawn("asciinema", ["upload", filePath], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("error", (error) => {
      if (error.code === "ENOENT") {
        resolve3({
          success: false,
          error: "asciinema CLI not found. Install with: pip install asciinema"
        });
      } else {
        resolve3({
          success: false,
          error: error.message
        });
      }
    });
    proc.on("close", (code) => {
      if (code === 0) {
        const url = extractUrl(stdout) || extractUrl(stderr);
        if (url) {
          resolve3({ success: true, url });
        } else {
          resolve3({
            success: true,
            url: stdout.trim() || "Upload successful (URL not found in output)"
          });
        }
      } else {
        const output = stdout + stderr;
        if (output.includes("auth") || output.includes("token") || output.includes("API")) {
          resolve3({
            success: false,
            error: "Authentication required. Run 'asciinema auth' first."
          });
        } else {
          resolve3({
            success: false,
            error: stderr.trim() || stdout.trim() || `Exit code: ${code}`
          });
        }
      }
    });
  });
}
async function checkAsciinema() {
  return new Promise((resolve3) => {
    const proc = spawn("asciinema", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    proc.on("error", () => {
      resolve3(false);
    });
    proc.on("close", (code) => {
      resolve3(code === 0);
    });
  });
}
function extractUrl(text) {
  const match = text.match(/https?:\/\/asciinema\.org\/a\/[a-zA-Z0-9]+/);
  return match ? match[0] : null;
}
var init_upload = __esm({
  "src/cli/upload.ts"() {
    "use strict";
  }
});

// src/cli/sessions.ts
import { readdir, stat } from "fs/promises";
import { join as join2 } from "path";
import { homedir } from "os";
function getClaudeProjectPath(cwd) {
  const mangled = cwd.replace(/\//g, "-");
  return join2(homedir(), ".claude/projects", mangled);
}
async function listSessions(projectPath) {
  const sessions = [];
  try {
    const files = await readdir(projectPath);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      if (file.startsWith("agent-")) continue;
      const filePath = join2(projectPath, file);
      const stats = await stat(filePath);
      sessions.push({
        path: filePath,
        name: file.replace(".jsonl", ""),
        modified: stats.mtime,
        size: stats.size
      });
    }
  } catch {
  }
  return sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}
async function getLatestSession(cwd) {
  const projectPath = getClaudeProjectPath(cwd);
  const sessions = await listSessions(projectPath);
  return sessions[0]?.path ?? null;
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
async function loadProfile(cwd = process.cwd()) {
  const profilePath = join2(cwd, PROFILE_FILENAME);
  try {
    const { readFile: readFile2 } = await import("fs/promises");
    const content = await readFile2(profilePath, "utf-8");
    const config = JSON.parse(content);
    return config;
  } catch {
    return null;
  }
}
async function saveProfile(config, cwd = process.cwd()) {
  const profilePath = join2(cwd, PROFILE_FILENAME);
  const { writeFile: writeFile3 } = await import("fs/promises");
  const content = JSON.stringify(config, null, 2);
  await writeFile3(profilePath, content, "utf-8");
}
var PROFILE_FILENAME;
var init_sessions = __esm({
  "src/cli/sessions.ts"() {
    "use strict";
    PROFILE_FILENAME = "cc-prism.profile";
  }
});

// src/cli/interactive.tsx
var interactive_exports = {};
__export(interactive_exports, {
  runInteractiveForm: () => runInteractiveForm
});
import { useState, useMemo, useEffect } from "react";
import { render, Box, Text, useApp, useInput, useStdout } from "ink";
import { jsx, jsxs } from "react/jsx-runtime";
function getVisibleFields(expanded) {
  const fields = [];
  for (const section of ["output", "appearance", "timing", "features"]) {
    fields.push(`section:${section}`);
    if (expanded.has(section)) {
      fields.push(...SECTION_FIELDS[section]);
    }
  }
  fields.push("generate", "saveProfile", "cancel");
  return fields;
}
function getDefaultConfig(defaultOutput) {
  return {
    output: defaultOutput,
    upload: false,
    theme: "tokyo-night",
    cols: 100,
    rows: 40,
    title: "",
    // Empty = show placeholder, CLI uses defaultTitle if empty
    preset: "default",
    maxWait: null,
    thinkingPause: null,
    typingEffect: true,
    statusSpinner: false,
    spinnerDuration: 3,
    markers: "all"
  };
}
function validateConfig(config) {
  const errors = {};
  if (config.cols <= 0 || config.cols > 500) {
    errors.cols = "Must be 1-500";
  }
  if (config.rows <= 0 || config.rows > 200) {
    errors.rows = "Must be 1-200";
  }
  if (config.spinnerDuration <= 0 || config.spinnerDuration > 60) {
    errors.spinnerDuration = "Must be 0.1-60";
  }
  if (config.maxWait !== null && config.maxWait < 0) {
    errors.maxWait = "Must be >= 0";
  }
  if (config.thinkingPause !== null && config.thinkingPause < 0) {
    errors.thinkingPause = "Must be >= 0";
  }
  return errors;
}
function formToProfile(config) {
  return {
    output: config.output,
    upload: config.upload,
    theme: config.theme,
    cols: config.cols,
    rows: config.rows,
    title: config.title,
    preset: config.preset,
    max_wait: config.maxWait,
    thinking_pause: config.thinkingPause,
    typing_effect: config.typingEffect,
    status_spinner: config.statusSpinner,
    spinner_duration: config.spinnerDuration,
    markers: config.markers
  };
}
function profileToForm(profile, defaults) {
  return {
    output: profile.output ?? defaults.output,
    upload: profile.upload ?? defaults.upload,
    theme: profile.theme ?? defaults.theme,
    cols: profile.cols ?? defaults.cols,
    rows: profile.rows ?? defaults.rows,
    title: profile.title ?? defaults.title,
    preset: profile.preset ?? defaults.preset,
    maxWait: profile.max_wait !== void 0 ? profile.max_wait : defaults.maxWait,
    thinkingPause: profile.thinking_pause !== void 0 ? profile.thinking_pause : defaults.thinkingPause,
    typingEffect: profile.typing_effect ?? defaults.typingEffect,
    statusSpinner: profile.status_spinner ?? defaults.statusSpinner,
    spinnerDuration: profile.spinner_duration ?? defaults.spinnerDuration,
    markers: profile.markers ?? defaults.markers
  };
}
function InteractiveForm({ sessionPath, defaultOutput, defaultTitle, onSubmit, onCancel }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [config, setConfig] = useState(() => getDefaultConfig(defaultOutput));
  const [focusedField, setFocusedField] = useState("section:output");
  const [editMode, setEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [expandedSections, setExpandedSections] = useState(() => /* @__PURE__ */ new Set(["output", "appearance"]));
  useEffect(() => {
    loadProfile().then((profile) => {
      if (profile) {
        const defaults = getDefaultConfig(defaultOutput);
        setConfig(profileToForm(profile, defaults));
        setProfileLoaded(true);
        setStatusMessage("Loaded: cc-prism.profile");
        setTimeout(() => setStatusMessage(null), 2e3);
      }
    });
  }, [defaultOutput]);
  const errors = useMemo(() => validateConfig(config), [config]);
  const hasErrors = Object.keys(errors).length > 0;
  const visibleFields = useMemo(() => getVisibleFields(expandedSections), [expandedSections]);
  const focusIndex = visibleFields.indexOf(focusedField);
  const moveFocus = (delta) => {
    const newIndex = Math.max(0, Math.min(visibleFields.length - 1, focusIndex + delta));
    setFocusedField(visibleFields[newIndex]);
  };
  const isSection = (field) => field.startsWith("section:");
  const getSectionName = (field) => isSection(field) ? field.replace("section:", "") : null;
  const isTextField = (field) => ["output", "title"].includes(field);
  const isNumberField = (field) => ["cols", "rows", "maxWait", "thinkingPause", "spinnerDuration"].includes(field);
  const isSelectField = (field) => ["theme", "preset", "markers"].includes(field);
  const isCheckbox = (field) => ["upload", "typingEffect", "statusSpinner"].includes(field);
  const isButton = (field) => ["generate", "saveProfile", "cancel"].includes(field);
  const getSelectOptions = (field) => {
    if (field === "theme") return THEMES2;
    if (field === "preset") return PRESETS;
    if (field === "markers") return MARKERS;
    return [];
  };
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onCancel();
      exit();
      return;
    }
    if (editMode) {
      if (key.escape) {
        setEditMode(false);
        setEditBuffer("");
        return;
      }
      if (key.return) {
        if (isTextField(focusedField)) {
          setConfig((c) => ({ ...c, [focusedField]: editBuffer }));
        } else if (isNumberField(focusedField)) {
          const num = parseFloat(editBuffer);
          if (editBuffer === "" && ["maxWait", "thinkingPause"].includes(focusedField)) {
            setConfig((c) => ({ ...c, [focusedField]: null }));
          } else if (!isNaN(num)) {
            setConfig((c) => ({ ...c, [focusedField]: num }));
          }
        }
        setEditMode(false);
        setEditBuffer("");
        return;
      }
      if (key.backspace || key.delete) {
        setEditBuffer((b) => b.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta && input.length === 1) {
        setEditBuffer((b) => b + input);
        return;
      }
      return;
    }
    if (key.downArrow || input === "j") {
      moveFocus(1);
      return;
    }
    if (key.upArrow || input === "k") {
      moveFocus(-1);
      return;
    }
    if (key.tab && !key.shift) {
      moveFocus(1);
      return;
    }
    if (key.tab && key.shift) {
      moveFocus(-1);
      return;
    }
    if (input === "g") {
      setFocusedField(visibleFields[0]);
      return;
    }
    if (input === "G") {
      setFocusedField(visibleFields[visibleFields.length - 1]);
      return;
    }
    if (key.return || input === " ") {
      const sectionName = getSectionName(focusedField);
      if (sectionName) {
        setExpandedSections((s) => {
          const next = new Set(s);
          if (next.has(sectionName)) next.delete(sectionName);
          else next.add(sectionName);
          return next;
        });
        return;
      }
      if (isCheckbox(focusedField)) {
        setConfig((c) => ({ ...c, [focusedField]: !c[focusedField] }));
        return;
      }
      if (isSelectField(focusedField)) {
        const options = getSelectOptions(focusedField);
        const current = config[focusedField];
        const idx = options.indexOf(current);
        const next = options[(idx + 1) % options.length];
        setConfig((c) => ({ ...c, [focusedField]: next }));
        return;
      }
      if (isTextField(focusedField) || isNumberField(focusedField)) {
        const currentValue = config[focusedField];
        setEditBuffer(currentValue === null ? "" : String(currentValue));
        setEditMode(true);
        return;
      }
      if (focusedField === "generate") {
        if (hasErrors) {
          setStatusMessage("Fix validation errors first");
          setTimeout(() => setStatusMessage(null), 2e3);
          return;
        }
        onSubmit(config);
        exit();
        return;
      }
      if (focusedField === "saveProfile") {
        saveProfile(formToProfile(config)).then(() => {
          setStatusMessage("Profile saved: cc-prism.profile");
          setTimeout(() => setStatusMessage(null), 2e3);
        }).catch((err) => {
          setStatusMessage(`Save failed: ${err.message}`);
          setTimeout(() => setStatusMessage(null), 3e3);
        });
        return;
      }
      if (focusedField === "cancel") {
        onCancel();
        exit();
        return;
      }
    }
    if (isSelectField(focusedField) && (input === "h" || input === "l")) {
      const options = getSelectOptions(focusedField);
      const current = config[focusedField];
      const idx = options.indexOf(current);
      const delta = input === "l" ? 1 : -1;
      const next = options[(idx + delta + options.length) % options.length];
      setConfig((c) => ({ ...c, [focusedField]: next }));
      return;
    }
  });
  const renderTextField = (field, label, width = 40, placeholder) => {
    const value = config[field];
    const isFocused = focusedField === field;
    const isEditing = isFocused && editMode;
    const displayValue = isEditing ? editBuffer : value;
    const showPlaceholder = !displayValue && placeholder && !isEditing;
    const content = (showPlaceholder ? placeholder : displayValue).padEnd(width - 2).slice(0, width - 2);
    return /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { color: isFocused ? "cyan" : void 0, children: isFocused ? "\u25B8 " : "  " }),
      /* @__PURE__ */ jsxs(Text, { children: [
        label,
        ": "
      ] }),
      /* @__PURE__ */ jsx(Text, { backgroundColor: isEditing ? "blue" : isFocused ? "gray" : void 0, children: "[" }),
      /* @__PURE__ */ jsx(
        Text,
        {
          backgroundColor: isEditing ? "blue" : isFocused ? "gray" : void 0,
          color: isEditing ? "white" : showPlaceholder ? "gray" : void 0,
          children: content
        }
      ),
      /* @__PURE__ */ jsx(Text, { backgroundColor: isEditing ? "blue" : isFocused ? "gray" : void 0, children: "]" }),
      isEditing && /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2588" })
    ] });
  };
  const renderNumberField = (field, label, defaultVal, width = 8, labelWidth = 12) => {
    const value = config[field];
    const isFocused = focusedField === field;
    const isEditing = isFocused && editMode;
    const displayValue = isEditing ? editBuffer : value === null ? "" : String(value);
    const error = errors[field];
    const hint = defaultVal !== void 0 ? `(default: ${defaultVal})` : "";
    return /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { color: isFocused ? "cyan" : void 0, children: isFocused ? "\u25B8 " : "  " }),
      /* @__PURE__ */ jsxs(Text, { children: [
        label.padEnd(labelWidth),
        ": "
      ] }),
      /* @__PURE__ */ jsxs(
        Text,
        {
          backgroundColor: isEditing ? "blue" : isFocused ? "gray" : void 0,
          color: isEditing ? "white" : void 0,
          children: [
            "[",
            displayValue.padEnd(width - 2).slice(0, width - 2),
            "]"
          ]
        }
      ),
      isEditing && /* @__PURE__ */ jsx(Text, { color: "gray", children: "\u2588" }),
      hint && /* @__PURE__ */ jsxs(Text, { dimColor: true, children: [
        " ",
        hint
      ] }),
      error && /* @__PURE__ */ jsxs(Text, { color: "red", children: [
        " ",
        error
      ] })
    ] });
  };
  const renderSelectField = (field, label, labelWidth = 0) => {
    const value = config[field];
    const options = getSelectOptions(field);
    const isFocused = focusedField === field;
    const displayLabel = labelWidth > 0 ? label.padEnd(labelWidth) : label;
    return /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { color: isFocused ? "cyan" : void 0, children: isFocused ? "\u25B8 " : "  " }),
      /* @__PURE__ */ jsxs(Text, { children: [
        displayLabel,
        ": "
      ] }),
      /* @__PURE__ */ jsxs(Text, { backgroundColor: isFocused ? "gray" : void 0, children: [
        "[",
        value,
        "]"
      ] }),
      isFocused && /* @__PURE__ */ jsx(Text, { dimColor: true, children: " (h/l or Space to cycle)" })
    ] });
  };
  const renderCheckbox = (field, label) => {
    const value = config[field];
    const isFocused = focusedField === field;
    return /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { color: isFocused ? "cyan" : void 0, children: isFocused ? "\u25B8 " : "  " }),
      /* @__PURE__ */ jsxs(Text, { children: [
        "(",
        value ? "\u25CF" : " ",
        ") ",
        label
      ] })
    ] });
  };
  const renderSectionHeader = (section, label) => {
    const isFocused = focusedField === `section:${section}`;
    const isExpanded = expandedSections.has(section);
    return /* @__PURE__ */ jsxs(Box, { children: [
      /* @__PURE__ */ jsx(Text, { color: isFocused ? "cyan" : void 0, children: isFocused ? "\u25B8 " : "  " }),
      /* @__PURE__ */ jsx(Text, { bold: isExpanded, color: isFocused ? "yellow" : isExpanded ? "yellow" : "gray", children: label }),
      isFocused && /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
        "  ",
        isExpanded ? "collapse" : "expand"
      ] })
    ] });
  };
  const renderButton = (field, label, color) => {
    const isFocused = focusedField === field;
    return /* @__PURE__ */ jsx(Box, { marginRight: 2, children: /* @__PURE__ */ jsxs(
      Text,
      {
        backgroundColor: isFocused ? color || "cyan" : void 0,
        color: isFocused ? "black" : color || "cyan",
        bold: isFocused,
        children: [
          "[",
          label,
          "]"
        ]
      }
    ) });
  };
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs(Box, { marginBottom: 1, children: [
      /* @__PURE__ */ jsx(Text, { bold: true, color: "cyan", children: "Cast Options" }),
      /* @__PURE__ */ jsxs(Text, { dimColor: true, children: [
        " - ",
        sessionPath.split("/").pop()
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
      renderSectionHeader("output", "Output"),
      expandedSections.has("output") && /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [
        renderTextField("output", "File", 45),
        renderCheckbox("upload", "Upload to asciinema.org")
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
      renderSectionHeader("appearance", "Appearance"),
      expandedSections.has("appearance") && /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [
        renderSelectField("theme", "Theme"),
        renderNumberField("cols", "Cols", 100, 6, 5),
        renderNumberField("rows", "Rows", 40, 6, 5),
        renderTextField("title", "Title", 45, defaultTitle)
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
      renderSectionHeader("timing", "Timing"),
      expandedSections.has("timing") && /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [
        renderSelectField("preset", "Preset"),
        renderNumberField("maxWait", "Max wait", 3, 8, 12),
        renderNumberField("thinkingPause", "Think pause", 0.8, 8, 12)
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Box, { flexDirection: "column", children: [
      renderSectionHeader("features", "Features"),
      expandedSections.has("features") && /* @__PURE__ */ jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [
        renderCheckbox("typingEffect", "Typing effect"),
        renderCheckbox("statusSpinner", "Status spinner"),
        renderNumberField("spinnerDuration", "Duration", 3, 6, 8),
        renderSelectField("markers", "Markers", 8)
      ] })
    ] }),
    /* @__PURE__ */ jsx(Box, { marginTop: 1, borderStyle: "single", borderColor: "gray", paddingX: 1, children: /* @__PURE__ */ jsxs(Box, { children: [
      renderButton("generate", "Generate", hasErrors ? "gray" : "green"),
      renderButton("saveProfile", "Save Profile", "blue"),
      renderButton("cancel", "Cancel", "red")
    ] }) }),
    statusMessage && /* @__PURE__ */ jsx(Box, { marginTop: 1, children: /* @__PURE__ */ jsx(Text, { color: "yellow", children: statusMessage }) })
  ] });
}
async function runInteractiveForm(sessionPath, defaultOutput, defaultTitle) {
  return new Promise((resolve3) => {
    const { unmount, waitUntilExit } = render(
      /* @__PURE__ */ jsx(
        InteractiveForm,
        {
          sessionPath,
          defaultOutput,
          defaultTitle,
          onSubmit: (config) => resolve3(config),
          onCancel: () => resolve3(null)
        }
      )
    );
    waitUntilExit().then(() => {
      unmount();
    });
  });
}
var THEMES2, PRESETS, MARKERS, SECTION_FIELDS;
var init_interactive = __esm({
  "src/cli/interactive.tsx"() {
    "use strict";
    init_sessions();
    THEMES2 = ["tokyo-night", "dracula", "nord", "catppuccin-mocha"];
    PRESETS = ["speedrun", "default", "realtime"];
    MARKERS = ["all", "user", "tools", "none"];
    SECTION_FIELDS = {
      output: ["output", "upload"],
      appearance: ["theme", "cols", "rows", "title"],
      timing: ["preset", "maxWait", "thinkingPause"],
      features: ["typingEffect", "statusSpinner", "spinnerDuration", "markers"]
    };
  }
});

// src/cli/picker.tsx
var picker_exports = {};
__export(picker_exports, {
  runPicker: () => runPicker
});
import { useState as useState2, useMemo as useMemo2 } from "react";
import { render as render2, Box as Box2, Text as Text2, useInput as useInput2, useApp as useApp2, useStdout as useStdout2 } from "ink";
import Fuse from "fuse.js";
import clipboard from "clipboardy";
import { writeFile } from "fs/promises";
import { resolve } from "path";
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function extractPreviewText(entry) {
  if (entry.type === "user") {
    if (entry.toolUseResult) {
      const isError = typeof entry.toolUseResult === "string" || entry.toolUseResult.is_error;
      return isError ? "error" : "success";
    }
    const content = entry.message.content;
    if (typeof content === "string") {
      return content;
    }
    const textItems = content.filter((c) => c.type === "text");
    return textItems.map((t) => t.type === "text" ? t.text : "").join("\n");
  }
  if (entry.type === "assistant") {
    const tools = entry.message.content.filter((c) => c.type === "tool_use");
    if (tools.length > 0) {
      const toolNames = tools.map((t) => t.type === "tool_use" ? t.name : "").join(", ");
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
function extractFullContent(entry) {
  if (entry.type === "user") {
    if (entry.toolUseResult) {
      const result = entry.toolUseResult;
      if (typeof result === "string") {
        return `Tool Result (error):
${result}`;
      }
      const status = result.is_error ? "error" : "success";
      const content2 = typeof result.content === "string" ? result.content : JSON.stringify(result.content, null, 2);
      return `Tool Result (${status}):
${content2}`;
    }
    const content = entry.message.content;
    if (typeof content === "string") {
      return content;
    }
    const textItems = content.filter((c) => c.type === "text");
    return textItems.map((t) => t.type === "text" ? t.text : "").join("\n");
  }
  if (entry.type === "assistant") {
    const parts = [];
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
        parts.push(`[Thinking]
${item.thinking}`);
      }
    }
    return parts.join("\n");
  }
  if (entry.type === "system" && entry.content) {
    return entry.content;
  }
  return "";
}
function getSelectionRanges(selected, renderableEntries) {
  if (selected.size === 0) return [];
  const sortedSelected = Array.from(selected).sort((a, b) => a - b);
  const ranges = [];
  let rangeStartIdx = sortedSelected[0];
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
          endIdx: rangeEndIdx
        });
      }
      if (current !== void 0) {
        rangeStartIdx = current;
        rangeEndIdx = current;
      }
    }
  }
  return ranges;
}
function generateCommandString(range, sessionPath) {
  return `cc-prism cast "${sessionPath}" --start-uuid ${range.startUuid} --end-uuid ${range.endUuid}`;
}
function generateUuidPair(range) {
  return `${range.startUuid} ${range.endUuid}`;
}
function generateJsonlContent(selectedEntries) {
  return selectedEntries.map((e) => JSON.stringify(e)).join("\n");
}
function getSelectedEntries(selected, renderableEntries) {
  const sortedSelected = Array.from(selected).sort((a, b) => a - b);
  return sortedSelected.map((idx) => renderableEntries[idx]).filter((e) => e !== void 0);
}
function generateSuggestedFilename(ranges) {
  if (ranges.length === 0) return "export";
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  const startUuid = first.startUuid.slice(0, 8);
  const endUuid = last.endUuid.slice(0, 8);
  const now = /* @__PURE__ */ new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${startUuid}-${endUuid}-${timestamp}`;
}
function wrapText(text, width) {
  const lines = [];
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
function formatEntry(entry, displayIdx, cursor, selected, matchIndices, currentMatchIdx, rangeStart, originalIdx, visualRangeAddsNew) {
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
  const isSelected = selected.has(originalIdx);
  const matchIdx = matchIndices.indexOf(originalIdx);
  const isMatch = matchIdx !== -1;
  const isCurrentMatch = isMatch && matchIdx === currentMatchIdx;
  let isVisualPreview = false;
  if (rangeStart !== null) {
    const [start, end] = rangeStart <= cursor ? [rangeStart, cursor] : [cursor, rangeStart];
    isVisualPreview = displayIdx >= start && displayIdx <= end;
  }
  const visualColor = isVisualPreview ? visualRangeAddsNew ? "green" : "red" : void 0;
  let prefix = "  ";
  if ((isSelected || isVisualPreview) && isCursor) prefix = "\u25B8\u25CF";
  else if (isSelected || isVisualPreview) prefix = " \u25CF";
  else if (isCursor) prefix = "\u25B8 ";
  return { prefix, uuid: uuidShort, time: timeStr, type: typeStr, preview, isCursor, isSelected, isVisualPreview, isMatch, isCurrentMatch, visualColor, isToolResult: !!isToolResult };
}
function Picker({ entries, sessionPath, onExit, onInteractiveExport }) {
  const { exit } = useApp2();
  const { stdout } = useStdout2();
  const terminalRows = stdout?.rows ?? 24;
  const VISIBLE_LINES = Math.max(5, terminalRows - HEADER_FOOTER_LINES);
  const EXPORT_VISIBLE_LINES = Math.max(5, terminalRows - EXPORT_HEADER_FOOTER_LINES);
  const renderableEntries = useMemo2(
    () => entries.filter(isRenderableMessage),
    [entries]
  );
  const [cursor, setCursor] = useState2(0);
  const [selected, setSelected] = useState2(/* @__PURE__ */ new Set());
  const [rangeStart, setRangeStart] = useState2(null);
  const [cherrypickMode, setCherrypickMode] = useState2(false);
  const [searchMode, setSearchMode] = useState2(false);
  const [searchQuery, setSearchQuery] = useState2("");
  const [searchedNoMatches, setSearchedNoMatches] = useState2(false);
  const [matchIndices, setMatchIndices] = useState2([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState2(0);
  const [scrollOffset, setScrollOffset] = useState2(0);
  const [statusMessage, setStatusMessage] = useState2(null);
  const [selectionHistory, setSelectionHistory] = useState2([]);
  const [redoHistory, setRedoHistory] = useState2([]);
  const [focusedPane, setFocusedPane] = useState2("history");
  const [previewScrollOffset, setPreviewScrollOffset] = useState2(0);
  const [historyFilter, setHistoryFilter] = useState2("all");
  const [filterSnapshot, setFilterSnapshot] = useState2(/* @__PURE__ */ new Set());
  const [exportPreviewMode, setExportPreviewMode] = useState2(false);
  const [exportContent, setExportContent] = useState2("");
  const [exportContentLines, setExportContentLines] = useState2([]);
  const [exportScrollOffset, setExportScrollOffset] = useState2(0);
  const [exportCursor, setExportCursor] = useState2(0);
  const [dialogScreen, setDialogScreen] = useState2(null);
  const [exportMode, setExportMode] = useState2("single");
  const [dialogCursor, setDialogCursor] = useState2(0);
  const [filenameInput, setFilenameInput] = useState2("");
  const [multiExportCast, setMultiExportCast] = useState2(true);
  const [multiExportJsonl, setMultiExportJsonl] = useState2(false);
  const fuse = useMemo2(() => {
    const searchable = renderableEntries.map((entry, idx) => ({
      idx,
      uuid: getUuid(entry),
      text: extractFullContent(entry),
      type: entry.type
    }));
    return new Fuse(searchable, {
      keys: ["text"],
      threshold: 0.3,
      includeMatches: true
    });
  }, [renderableEntries]);
  const performSearch = (query) => {
    if (!query) {
      setMatchIndices([]);
      setCurrentMatchIdx(0);
      return;
    }
    const results = fuse.search(query);
    let indices = results.map((r) => r.item.idx);
    if (historyFilter === "selected") {
      indices = indices.filter((idx) => filterSnapshot.has(idx));
    }
    setMatchIndices(indices);
    setCurrentMatchIdx(0);
    if (indices.length > 0 && indices[0] !== void 0) {
      setCursor(indices[0]);
      updateScrollForCursor(indices[0]);
    }
  };
  const updateScrollForCursor = (newCursor) => {
    if (newCursor < scrollOffset) {
      setScrollOffset(newCursor);
    } else if (newCursor >= scrollOffset + VISIBLE_LINES) {
      setScrollOffset(newCursor - VISIBLE_LINES + 1);
    }
  };
  const generateExportContent = () => {
    if (selected.size === 0) return "No messages selected";
    const sortedSelected = Array.from(selected).sort((a, b) => a - b);
    const parts = [];
    for (const idx of sortedSelected) {
      const entry = renderableEntries[idx];
      if (!entry) continue;
      const uuid = getUuid(entry);
      const timestamp = getTimestamp(entry);
      const timeStr = timestamp ? timestamp.toISOString().substring(11, 19) : "unknown";
      const uuidShort = uuid ? uuid.substring(0, 8) : "unknown";
      let typeStr = entry.type;
      if (entry.type === "user" && entry.toolUseResult) {
        typeStr = "tool-result";
      }
      parts.push(`[${typeStr} ${timeStr} ${uuidShort}]`);
      const content = extractFullContent(entry);
      parts.push(content);
      parts.push(" ");
    }
    return parts.join("\n").trimEnd();
  };
  const executeExport = async (format, filename) => {
    const ranges = getSelectionRanges(selected, renderableEntries);
    if (ranges.length === 0) return;
    try {
      switch (format) {
        case "command": {
          const commands = ranges.map((r) => generateCommandString(r, sessionPath)).join("\n");
          try {
            await clipboard.write(commands);
            setStatusMessage(`${ranges.length} command${ranges.length > 1 ? "s" : ""} copied`);
          } catch {
            setStatusMessage("Clipboard unavailable");
          }
          break;
        }
        case "uuids": {
          const uuids = ranges.map((r) => generateUuidPair(r)).join("\n");
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
              render: { theme, width: 100 }
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
    setTimeout(() => setStatusMessage(null), 3e3);
    setDialogScreen(null);
    setFilenameInput("");
    setDialogCursor(0);
  };
  const executeBothExports = async (filename) => {
    const selectedEntries = getSelectedEntries(selected, renderableEntries);
    const baseName = filename.replace(/\.(cast|jsonl)$/, "");
    try {
      const theme = getTheme("tokyo-night");
      const result = convertToAsciicast(selectedEntries, {
        builder: { cols: 100, rows: 40 },
        timing: { preset: "default" },
        markers: { mode: "all" },
        render: { theme, width: 100 }
      });
      const castContent = serializeCast(result.document);
      const castPath = resolve(process.cwd(), `${baseName}.cast`);
      await writeFile(castPath, castContent, "utf-8");
      const jsonlContent = generateJsonlContent(selectedEntries);
      const jsonlPath = resolve(process.cwd(), `${baseName}.jsonl`);
      await writeFile(jsonlPath, jsonlContent, "utf-8");
      setStatusMessage(`Written: ${baseName}.cast and .jsonl`);
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setTimeout(() => setStatusMessage(null), 3e3);
    setDialogScreen(null);
    setFilenameInput("");
    setDialogCursor(0);
  };
  const executeAdvancedExport = async () => {
    const selectedEntries = getSelectedEntries(selected, renderableEntries);
    const ranges = getSelectionRanges(selected, renderableEntries);
    const suggestedName = generateSuggestedFilename(ranges);
    try {
      const jsonlContent = generateJsonlContent(selectedEntries);
      const jsonlPath = resolve(process.cwd(), `${suggestedName}.jsonl`);
      await writeFile(jsonlPath, jsonlContent, "utf-8");
      setStatusMessage(`Exported: ${suggestedName}.jsonl`);
      setTimeout(() => {
        if (onInteractiveExport) {
          onInteractiveExport({ jsonlPath, sessionPath });
        }
        onExit([]);
        exit();
      }, 500);
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setTimeout(() => setStatusMessage(null), 3e3);
    }
  };
  useInput2((input, key) => {
    if (dialogScreen !== null) {
      if (key.escape) {
        setDialogScreen(null);
        setFilenameInput("");
        setDialogCursor(0);
        return;
      }
      if (dialogScreen === "filename") {
        if (key.return) {
          const ranges = getSelectionRanges(selected, renderableEntries);
          const filename = filenameInput.trim() || generateSuggestedFilename(ranges);
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
          setFilenameInput((s) => s.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta && input.length === 1) {
          setFilenameInput((s) => s + input);
          return;
        }
        return;
      }
      if (dialogScreen === "format") {
        const formatOptions = 3;
        const showAdvanced = multiExportCast;
        const actionCount = showAdvanced ? 3 : 2;
        if (key.upArrow || input === "k") {
          setDialogCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow || input === "j") {
          setDialogCursor((c) => Math.min(formatOptions + actionCount - 1, c + 1));
          return;
        }
        if (dialogCursor < formatOptions) {
          if (key.return || input === " ") {
            if (dialogCursor === 0) {
              setMultiExportCast(true);
              setMultiExportJsonl(false);
            } else if (dialogCursor === 1) {
              setMultiExportCast(false);
              setMultiExportJsonl(true);
            } else {
              setMultiExportCast(true);
              setMultiExportJsonl(true);
            }
            return;
          }
        }
        if (dialogCursor === formatOptions) {
          if (key.return) {
            setDialogScreen("filename");
            setDialogCursor(0);
            return;
          }
        }
        if (showAdvanced && dialogCursor === formatOptions + 1) {
          if (key.return) {
            executeAdvancedExport();
            return;
          }
        }
        const cancelIdx = showAdvanced ? formatOptions + 2 : formatOptions + 1;
        if (dialogCursor === cancelIdx) {
          if (key.return) {
            setDialogScreen(null);
            setDialogCursor(0);
            return;
          }
        }
        if (input === "y") {
          if (statusMessage) return;
          const ranges = getSelectionRanges(selected, renderableEntries);
          if (ranges.length > 0) {
            const commands = ranges.map((r) => generateCommandString(r, sessionPath)).join("\n");
            setStatusMessage("Command copied");
            setTimeout(() => setStatusMessage(null), 2e3);
            clipboard.write(commands).catch(() => {
              setStatusMessage("Clipboard unavailable");
              setTimeout(() => setStatusMessage(null), 2e3);
            });
          }
          return;
        }
        return;
      }
      if (dialogScreen === "multimode") {
        const ranges = getSelectionRanges(selected, renderableEntries);
        const modeOptions = 2;
        const formatOptions = 3;
        const showAdvanced = multiExportCast;
        let actionCount = 2;
        if (showAdvanced) actionCount++;
        if (exportMode === "multiple") actionCount++;
        if (key.upArrow || input === "k") {
          setDialogCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow || input === "j") {
          setDialogCursor((c) => Math.min(modeOptions + formatOptions + actionCount - 1, c + 1));
          return;
        }
        if (dialogCursor < modeOptions) {
          if (key.return || input === " ") {
            setExportMode(dialogCursor === 0 ? "single" : "multiple");
            return;
          }
        }
        if (dialogCursor >= modeOptions && dialogCursor < modeOptions + formatOptions) {
          if (key.return || input === " ") {
            const formatIdx = dialogCursor - modeOptions;
            if (formatIdx === 0) {
              setMultiExportJsonl(true);
              setMultiExportCast(false);
            } else if (formatIdx === 1) {
              setMultiExportJsonl(false);
              setMultiExportCast(true);
            } else {
              setMultiExportJsonl(true);
              setMultiExportCast(true);
            }
            return;
          }
        }
        const actionStart = modeOptions + formatOptions;
        let currentAction = actionStart;
        if (dialogCursor === currentAction) {
          if (key.return) {
            setDialogScreen("filename");
            setDialogCursor(0);
            return;
          }
        }
        currentAction++;
        if (showAdvanced && dialogCursor === currentAction) {
          if (key.return) {
            executeAdvancedExport();
            return;
          }
        }
        if (showAdvanced) currentAction++;
        if (exportMode === "multiple" && dialogCursor === currentAction) {
          if (key.return) {
            const commands = ranges.map((r) => generateCommandString(r, sessionPath)).join("\n");
            setStatusMessage(`${ranges.length} commands copied`);
            clipboard.write(commands).catch(() => {
              setStatusMessage("Clipboard unavailable");
              setTimeout(() => setStatusMessage(null), 2e3);
            });
            setTimeout(() => setStatusMessage(null), 2e3);
            setDialogScreen(null);
            setDialogCursor(0);
            return;
          }
        }
        if (exportMode === "multiple") currentAction++;
        if (dialogCursor === currentAction) {
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
    if (!searchMode && searchQuery) {
      if (input === "n" && matchIndices.length > 0) {
        const nextMatch = matchIndices.find((idx) => idx > cursor);
        const nextIdx = nextMatch !== void 0 ? matchIndices.indexOf(nextMatch) : 0;
        setCurrentMatchIdx(nextIdx);
        const newCursor = matchIndices[nextIdx];
        if (newCursor !== void 0) {
          setCursor(newCursor);
          updateScrollForCursor(newCursor);
          setPreviewScrollOffset(0);
        }
        return;
      }
      if (input === "N" && matchIndices.length > 0) {
        const prevMatches = matchIndices.filter((idx) => idx < cursor);
        const prevMatch = prevMatches.length > 0 ? prevMatches[prevMatches.length - 1] : void 0;
        const prevIdx = prevMatch !== void 0 ? matchIndices.indexOf(prevMatch) : matchIndices.length - 1;
        setCurrentMatchIdx(prevIdx);
        const newCursor = matchIndices[prevIdx];
        if (newCursor !== void 0) {
          setCursor(newCursor);
          updateScrollForCursor(newCursor);
          setPreviewScrollOffset(0);
        }
        return;
      }
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
      if (key.escape || input === "/") {
        setSearchMode(true);
        return;
      }
      return;
    }
    if (key.tab && key.shift) {
      if (focusedPane === "preview") {
        setFocusedPane("history");
        setHistoryFilter("selected");
        setFilterSnapshot(new Set(selected));
        setScrollOffset(0);
        setCursor(0);
      } else if (historyFilter === "selected") {
        setHistoryFilter("all");
        setFilterSnapshot(/* @__PURE__ */ new Set());
        setScrollOffset(0);
      } else {
        setFocusedPane("preview");
      }
      return;
    }
    if (key.tab) {
      if (focusedPane === "preview") {
        setFocusedPane("history");
        setHistoryFilter("all");
        setFilterSnapshot(/* @__PURE__ */ new Set());
        setScrollOffset(0);
      } else if (historyFilter === "all") {
        setHistoryFilter("selected");
        setFilterSnapshot(new Set(selected));
        setScrollOffset(0);
        setCursor(0);
      } else {
        setFocusedPane("preview");
      }
      return;
    }
    if (input === "1") {
      setFocusedPane("history");
      return;
    }
    if (input === "2") {
      setFocusedPane("preview");
      return;
    }
    if (exportPreviewMode) {
      if (key.escape) {
        setExportPreviewMode(false);
        return;
      }
      if (key.downArrow || input === "j") {
        const maxCursor = exportContentLines.length - 1;
        const newCursor = Math.min(maxCursor, exportCursor + 1);
        setExportCursor(newCursor);
        if (newCursor >= exportScrollOffset + EXPORT_VISIBLE_LINES) {
          setExportScrollOffset(newCursor - EXPORT_VISIBLE_LINES + 1);
        }
        return;
      }
      if (key.upArrow || input === "k") {
        const newCursor = Math.max(0, exportCursor - 1);
        setExportCursor(newCursor);
        if (newCursor < exportScrollOffset) {
          setExportScrollOffset(newCursor);
        }
        return;
      }
      const pageJump = Math.max(1, EXPORT_VISIBLE_LINES - 3);
      if (key.pageDown || key.ctrl && input === "d") {
        const maxCursor = exportContentLines.length - 1;
        const maxOffset = Math.max(0, exportContentLines.length - EXPORT_VISIBLE_LINES);
        const newScrollOffset = Math.min(maxOffset, exportScrollOffset + pageJump);
        const scrollDelta = newScrollOffset - exportScrollOffset;
        const newCursor = Math.min(maxCursor, exportCursor + scrollDelta);
        setExportScrollOffset(newScrollOffset);
        setExportCursor(newCursor);
        return;
      }
      if (key.pageUp || key.ctrl && input === "u") {
        const newScrollOffset = Math.max(0, exportScrollOffset - pageJump);
        const scrollDelta = exportScrollOffset - newScrollOffset;
        const newCursor = Math.max(0, exportCursor - scrollDelta);
        setExportScrollOffset(newScrollOffset);
        setExportCursor(newCursor);
        return;
      }
      if (input === "g") {
        setExportCursor(0);
        setExportScrollOffset(0);
        return;
      }
      if (input === "G") {
        const maxCursor = exportContentLines.length - 1;
        const maxOffset = Math.max(0, exportContentLines.length - EXPORT_VISIBLE_LINES);
        setExportCursor(maxCursor);
        setExportScrollOffset(maxOffset);
        return;
      }
      if (input === "y") {
        if (statusMessage) return;
        const lineCount = exportContentLines.length;
        setStatusMessage(`${lineCount} lines copied`);
        setTimeout(() => setStatusMessage(null), 2e3);
        clipboard.write(exportContent).catch(() => {
          setStatusMessage("Clipboard unavailable");
          setTimeout(() => setStatusMessage(null), 2e3);
        });
        return;
      }
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
      return;
    }
    if (searchMode) {
      if (key.return) {
        const results = fuse.search(searchQuery);
        let indices = results.map((r) => r.item.idx);
        if (historyFilter === "selected") {
          indices = indices.filter((idx) => filterSnapshot.has(idx));
        }
        performSearch(searchQuery);
        if (indices.length === 0) {
          setSearchedNoMatches(true);
          return;
        }
        setSearchedNoMatches(false);
        setSearchMode(false);
      } else if (key.escape) {
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
    const getFilteredLength = () => {
      if (historyFilter === "all") return renderableEntries.length;
      return Array.from(filterSnapshot).length;
    };
    if (key.upArrow || input === "k") {
      if (focusedPane === "history") {
        const newCursor = Math.max(0, cursor - 1);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0);
      } else {
        setPreviewScrollOffset(Math.max(0, previewScrollOffset - 1));
      }
    }
    if (key.downArrow || input === "j") {
      if (focusedPane === "history") {
        const maxCursor = getFilteredLength() - 1;
        const newCursor = Math.min(maxCursor, cursor + 1);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0);
      } else {
        setPreviewScrollOffset(previewScrollOffset + 1);
      }
    }
    if (key.pageUp || key.ctrl && input === "u") {
      if (focusedPane === "history") {
        const newCursor = Math.max(0, cursor - VISIBLE_LINES);
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
        setPreviewScrollOffset(0);
      } else {
        setPreviewScrollOffset(Math.max(0, previewScrollOffset - VISIBLE_LINES));
      }
    }
    if (key.pageDown || key.ctrl && input === "d") {
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
    if (input === " ") {
      const getOriginalIdx = (displayIdx) => {
        if (historyFilter === "all") return displayIdx;
        const snapshotArr = Array.from(filterSnapshot).sort((a, b) => a - b);
        return snapshotArr[displayIdx] ?? displayIdx;
      };
      if (cherrypickMode) {
        const origIdx = getOriginalIdx(cursor);
        setSelectionHistory((h) => [...h, new Set(selected)]);
        setSelected((s) => {
          const newSet = new Set(s);
          if (newSet.has(origIdx)) newSet.delete(origIdx);
          else newSet.add(origIdx);
          return newSet;
        });
      } else if (rangeStart === null) {
        setRangeStart(cursor);
      } else {
        const [start, end] = rangeStart <= cursor ? [rangeStart, cursor] : [cursor, rangeStart];
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
              newSet.add(origIdx);
            } else {
              newSet.delete(origIdx);
            }
          }
          return newSet;
        });
        setRangeStart(null);
      }
    }
    if (input === "c") {
      setCherrypickMode(!cherrypickMode);
      setRangeStart(null);
    }
    if (key.escape) {
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
    if (key.ctrl && input === "c") {
      onExit([]);
      exit();
      return;
    }
    if (input === "u") {
      if (selectionHistory.length > 0) {
        const prev = selectionHistory[selectionHistory.length - 1];
        if (prev) {
          setRedoHistory((h) => [...h, new Set(selected)]);
          setSelected(prev);
          setSelectionHistory((h) => h.slice(0, -1));
          setStatusMessage("Undone");
          setTimeout(() => setStatusMessage(null), 1e3);
        }
      }
    }
    if (key.ctrl && input === "r") {
      if (redoHistory.length > 0) {
        const next = redoHistory[redoHistory.length - 1];
        if (next) {
          setSelectionHistory((h) => [...h, new Set(selected)]);
          setSelected(next);
          setRedoHistory((h) => h.slice(0, -1));
          setStatusMessage("Redone");
          setTimeout(() => setStatusMessage(null), 1e3);
        }
      }
    }
    if (input === "/") {
      setFocusedPane("history");
      setSearchMode(true);
      setSearchQuery("");
    }
    if (input === "n" && matchIndices.length > 0) {
      const nextIdx = (currentMatchIdx + 1) % matchIndices.length;
      setCurrentMatchIdx(nextIdx);
      const newCursor = matchIndices[nextIdx];
      if (newCursor !== void 0) {
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
      }
    }
    if (input === "N" && matchIndices.length > 0) {
      const prevIdx = (currentMatchIdx - 1 + matchIndices.length) % matchIndices.length;
      setCurrentMatchIdx(prevIdx);
      const newCursor = matchIndices[prevIdx];
      if (newCursor !== void 0) {
        setCursor(newCursor);
        updateScrollForCursor(newCursor);
      }
    }
    if (input === "a") {
      const all = /* @__PURE__ */ new Set();
      for (let i = 0; i < renderableEntries.length; i++) all.add(i);
      setSelected(all);
    }
    if (key.return && rangeStart === null) {
      if (selected.size === 0) {
        setStatusMessage("No messages selected");
        setTimeout(() => setStatusMessage(null), 1500);
        return;
      }
      const content = generateExportContent();
      setExportContent(content);
      const columns = stdout?.columns ?? 80;
      const estLineCount = content.split("\n").length * 2;
      const estNumWidth = Math.max(2, String(estLineCount).length);
      const wrapWidth = columns - 6 - estNumWidth - 2;
      const wrapped = wrapText(content, wrapWidth);
      setExportContentLines(wrapped);
      const highlightedEntry = filteredEntries[cursor]?.entry;
      const highlightedUuid = highlightedEntry ? getUuid(highlightedEntry)?.substring(0, 8) : null;
      let targetLine = 0;
      if (highlightedUuid) {
        const headerPattern = new RegExp(`^\\[\\S+\\s+\\S+\\s+${highlightedUuid}\\]$`);
        targetLine = wrapped.findIndex((line) => headerPattern.test(line.text));
        if (targetLine === -1) targetLine = 0;
      }
      const centeredOffset = Math.max(0, targetLine - Math.floor(EXPORT_VISIBLE_LINES / 2));
      const maxOffset = Math.max(0, wrapped.length - EXPORT_VISIBLE_LINES);
      setExportScrollOffset(Math.min(centeredOffset, maxOffset));
      setExportCursor(targetLine);
      setExportPreviewMode(true);
    }
    if (input === "q") {
      onExit([]);
      exit();
    }
  });
  const filteredEntries = useMemo2(() => {
    if (historyFilter === "all") {
      return renderableEntries.map((entry, idx) => ({ entry, originalIdx: idx }));
    }
    return renderableEntries.map((entry, idx) => ({ entry, originalIdx: idx })).filter(({ originalIdx }) => filterSnapshot.has(originalIdx));
  }, [renderableEntries, historyFilter, filterSnapshot]);
  const maxScrollOffset = Math.max(0, filteredEntries.length - VISIBLE_LINES);
  const clampedScrollOffset = Math.min(scrollOffset, maxScrollOffset);
  const visibleEntries = filteredEntries.slice(clampedScrollOffset, clampedScrollOffset + VISIBLE_LINES);
  const visualRangeAddsNew = useMemo2(() => {
    if (rangeStart === null) return false;
    const [start, end] = rangeStart <= cursor ? [rangeStart, cursor] : [cursor, rangeStart];
    for (let displayIdx = start; displayIdx <= end; displayIdx++) {
      const item = filteredEntries[displayIdx];
      if (item && !selected.has(item.originalIdx)) {
        return true;
      }
    }
    return false;
  }, [rangeStart, cursor, filteredEntries, selected]);
  const PREVIEW_VISIBLE_LINES = VISIBLE_LINES;
  const PREVIEW_WIDTH = 60;
  const currentFilteredItem = filteredEntries[cursor];
  const currentEntry = currentFilteredItem?.entry;
  const previewContent = currentEntry ? extractFullContent(currentEntry) : "";
  const previewLines = wrapText(previewContent, PREVIEW_WIDTH - 4);
  const maxPreviewOffset = Math.max(0, previewLines.length - PREVIEW_VISIBLE_LINES);
  const clampedPreviewOffset = Math.min(previewScrollOffset, maxPreviewOffset);
  const visiblePreviewLines = previewLines.slice(
    clampedPreviewOffset,
    clampedPreviewOffset + PREVIEW_VISIBLE_LINES
  );
  const getTypeColor2 = (type) => {
    switch (type) {
      case "user":
        return "blue";
      case "assistant":
        return "magenta";
      case "system":
        return "yellow";
      case "tool-res":
        return "green";
      case "tool-result":
        return "green";
      default:
        return "white";
    }
  };
  const terminalCols = stdout?.columns ?? 80;
  const logicalLineCount = exportContentLines.filter((l) => !l.isContinuation).length;
  const numWidth = String(logicalLineCount).length;
  const lineWidth = terminalCols - 6 - numWidth - 2;
  const renderExportLine = (wrappedLine, key, lineNum, isCurrentLine = false) => {
    const { text: line, isContinuation } = wrappedLine;
    const bgColor = isCurrentLine ? "#333333" : void 0;
    const padLine = (text) => text.padEnd(lineWidth, " ");
    const lineNumCol = isContinuation ? " ".repeat(numWidth + 2) : String(lineNum).padStart(numWidth) + "  ";
    const headerMatch = line.match(/^\[(\S+)\s+(\S+)\s+(\S+)\]$/);
    if (headerMatch) {
      const [, type, time, uuid] = headerMatch;
      const headerText = `[${type} ${time} ${uuid}]`;
      const padding = " ".repeat(Math.max(0, lineWidth - headerText.length));
      return /* @__PURE__ */ jsxs2(Text2, { backgroundColor: bgColor, children: [
        /* @__PURE__ */ jsx2(Text2, { dimColor: !isCurrentLine, children: lineNumCol }),
        /* @__PURE__ */ jsx2(Text2, { children: "[" }),
        /* @__PURE__ */ jsx2(Text2, { color: getTypeColor2(type || ""), children: type }),
        /* @__PURE__ */ jsx2(Text2, { children: " " }),
        /* @__PURE__ */ jsxs2(Text2, { dimColor: true, children: [
          time,
          " ",
          uuid
        ] }),
        /* @__PURE__ */ jsxs2(Text2, { children: [
          "]",
          padding
        ] })
      ] }, key);
    }
    return /* @__PURE__ */ jsxs2(Text2, { backgroundColor: bgColor, children: [
      /* @__PURE__ */ jsx2(Text2, { dimColor: !isCurrentLine, children: lineNumCol }),
      /* @__PURE__ */ jsx2(Text2, { children: padLine(line || " ") })
    ] }, key);
  };
  return /* @__PURE__ */ jsxs2(Box2, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs2(Box2, { marginBottom: 1, width: "100%", children: [
      /* @__PURE__ */ jsx2(Text2, { bold: true, color: "cyan", children: "cc-prism pick" }),
      /* @__PURE__ */ jsx2(Text2, { children: " \u2502 " }),
      /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: sessionPath.split("/").pop() })
    ] }),
    dialogScreen !== null ? /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsx2(Box2, { children: (() => {
        const ranges = getSelectionRanges(selected, renderableEntries);
        const range = ranges[0];
        const startUuid = range?.startUuid.substring(0, 8) ?? "????????";
        const endUuid = range?.endUuid.substring(0, 8) ?? "????????";
        const msgCount = selected.size;
        return /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsx2(Text2, { color: "cyan", children: "Exporting range: " }),
          /* @__PURE__ */ jsxs2(Text2, { children: [
            startUuid,
            "-",
            endUuid
          ] }),
          /* @__PURE__ */ jsxs2(Text2, { dimColor: true, children: [
            " - ",
            msgCount,
            " message",
            msgCount !== 1 ? "s" : ""
          ] })
        ] });
      })() }),
      /* @__PURE__ */ jsxs2(
        Box2,
        {
          flexDirection: "column",
          borderStyle: "single",
          borderColor: "magenta",
          paddingX: 2,
          paddingY: 1,
          children: [
            dialogScreen === "format" && /* @__PURE__ */ (() => {
              const showAdvanced = multiExportCast;
              const cancelIdx = showAdvanced ? 5 : 4;
              return /* @__PURE__ */ jsxs2(Box2, { flexDirection: "column", children: [
                /* @__PURE__ */ jsx2(Text2, { bold: true, color: "cyan", children: "Select format:" }),
                /* @__PURE__ */ jsx2(Text2, { children: " " }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 0 ? "yellow" : void 0, children: [
                  dialogCursor === 0 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: multiExportCast && !multiExportJsonl ? "cyan" : void 0, children: [
                    "(",
                    multiExportCast && !multiExportJsonl ? "\u25CF" : " ",
                    ") .cast"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 1 ? "yellow" : void 0, children: [
                  dialogCursor === 1 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: multiExportJsonl && !multiExportCast ? "cyan" : void 0, children: [
                    "(",
                    multiExportJsonl && !multiExportCast ? "\u25CF" : " ",
                    ") .jsonl"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 2 ? "yellow" : void 0, children: [
                  dialogCursor === 2 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: multiExportCast && multiExportJsonl ? "cyan" : void 0, children: [
                    "(",
                    multiExportCast && multiExportJsonl ? "\u25CF" : " ",
                    ") Both"
                  ] })
                ] }),
                /* @__PURE__ */ jsx2(Text2, { children: " " }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 3 ? "green" : void 0, bold: dialogCursor === 3, children: [
                  dialogCursor === 3 ? "\u25B8" : " ",
                  " Confirm"
                ] }),
                showAdvanced && /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 4 ? "cyan" : void 0, children: [
                  dialogCursor === 4 ? "\u25B8" : " ",
                  " Advanced options"
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === cancelIdx ? "red" : void 0, children: [
                  dialogCursor === cancelIdx ? "\u25B8" : " ",
                  " Cancel"
                ] })
              ] });
            })(),
            dialogScreen === "multimode" && (() => {
              const ranges = getSelectionRanges(selected, renderableEntries);
              const showAdvanced = multiExportCast;
              const confirmIdx = 5;
              const advancedIdx = showAdvanced ? 6 : -1;
              const copyIdx = exportMode === "multiple" ? showAdvanced ? 7 : 6 : -1;
              const cancelIdx = showAdvanced ? exportMode === "multiple" ? 8 : 7 : exportMode === "multiple" ? 7 : 6;
              return /* @__PURE__ */ jsxs2(Box2, { flexDirection: "column", children: [
                /* @__PURE__ */ jsxs2(Text2, { bold: true, color: "cyan", children: [
                  "Export ",
                  ranges.length,
                  " Ranges"
                ] }),
                /* @__PURE__ */ jsx2(Text2, { children: " " }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 0 ? "yellow" : void 0, children: [
                  dialogCursor === 0 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: exportMode === "single" ? "cyan" : void 0, children: [
                    "(",
                    exportMode === "single" ? "\u25CF" : " ",
                    ") Single (Concatenated)"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 1 ? "yellow" : void 0, children: [
                  dialogCursor === 1 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: exportMode === "multiple" ? "cyan" : void 0, children: [
                    "(",
                    exportMode === "multiple" ? "\u25CF" : " ",
                    ") Multiple ranges"
                  ] })
                ] }),
                /* @__PURE__ */ jsx2(Text2, { children: " " }),
                /* @__PURE__ */ jsxs2(Text2, { dimColor: true, children: [
                  exportMode === "multiple" ? `Exporting ${ranges.length} ranges, c` : "C",
                  "hoose format:"
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 2 ? "yellow" : void 0, children: [
                  dialogCursor === 2 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: multiExportJsonl && !multiExportCast ? "cyan" : void 0, children: [
                    "(",
                    multiExportJsonl && !multiExportCast ? "\u25CF" : " ",
                    ") .jsonl"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 3 ? "yellow" : void 0, children: [
                  dialogCursor === 3 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: multiExportCast && !multiExportJsonl ? "cyan" : void 0, children: [
                    "(",
                    multiExportCast && !multiExportJsonl ? "\u25CF" : " ",
                    ") .cast"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === 4 ? "yellow" : void 0, children: [
                  dialogCursor === 4 ? "\u25B8" : " ",
                  /* @__PURE__ */ jsxs2(Text2, { color: multiExportCast && multiExportJsonl ? "cyan" : void 0, children: [
                    "(",
                    multiExportCast && multiExportJsonl ? "\u25CF" : " ",
                    ") both"
                  ] })
                ] }),
                /* @__PURE__ */ jsx2(Text2, { children: " " }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === confirmIdx ? "green" : void 0, bold: dialogCursor === confirmIdx, children: [
                  dialogCursor === confirmIdx ? "\u25B8" : " ",
                  " Confirm"
                ] }),
                showAdvanced && /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === advancedIdx ? "cyan" : void 0, children: [
                  dialogCursor === advancedIdx ? "\u25B8" : " ",
                  " Advanced options"
                ] }),
                exportMode === "multiple" && /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === copyIdx ? "cyan" : void 0, children: [
                  dialogCursor === copyIdx ? "\u25B8" : " ",
                  " Copy commands"
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { color: dialogCursor === cancelIdx ? "red" : void 0, children: [
                  dialogCursor === cancelIdx ? "\u25B8" : " ",
                  " Cancel"
                ] })
              ] });
            })(),
            dialogScreen === "filename" && (() => {
              const ranges = getSelectionRanges(selected, renderableEntries);
              const suggestedName = generateSuggestedFilename(ranges);
              return /* @__PURE__ */ jsxs2(Box2, { flexDirection: "column", children: [
                /* @__PURE__ */ jsx2(Text2, { bold: true, color: "cyan", children: "Enter filename" }),
                /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: "(extension will be added automatically)" }),
                /* @__PURE__ */ jsx2(Text2, { children: " " }),
                /* @__PURE__ */ jsxs2(Box2, { children: [
                  /* @__PURE__ */ jsx2(Text2, { color: "yellow", children: "Filename: " }),
                  filenameInput ? /* @__PURE__ */ jsxs2(Fragment, { children: [
                    /* @__PURE__ */ jsx2(Text2, { children: filenameInput }),
                    /* @__PURE__ */ jsx2(Text2, { color: "gray", children: "\u2588" })
                  ] }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
                    /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: suggestedName }),
                    /* @__PURE__ */ jsx2(Text2, { color: "gray", children: "\u2588" })
                  ] })
                ] }),
                /* @__PURE__ */ jsx2(Text2, { children: " " }),
                /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: "Press Enter to confirm, Esc to cancel" })
              ] });
            })()
          ]
        }
      ),
      /* @__PURE__ */ jsxs2(Box2, { marginTop: 1, justifyContent: "space-between", children: [
        /* @__PURE__ */ jsxs2(Box2, { children: [
          /* @__PURE__ */ jsx2(Text2, { backgroundColor: "#F97583", color: "black", bold: true, children: " EXPORT " }),
          /* @__PURE__ */ jsx2(Text2, { children: "  " }),
          /* @__PURE__ */ jsx2(Text2, { color: "#F97583", children: "y" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: ":copy command  " }),
          /* @__PURE__ */ jsx2(Text2, { color: "#F97583", children: "Esc" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: ":back" })
        ] }),
        statusMessage && /* @__PURE__ */ jsx2(Text2, { color: "cyan", children: statusMessage })
      ] })
    ] }) : exportPreviewMode ? /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsxs2(Box2, { children: [
        /* @__PURE__ */ jsx2(Text2, { color: "cyan", children: "Export preview" }),
        /* @__PURE__ */ jsxs2(Text2, { dimColor: true, children: [
          " - ",
          selected.size,
          " message",
          selected.size !== 1 ? "s" : ""
        ] })
      ] }),
      /* @__PURE__ */ jsxs2(
        Box2,
        {
          flexDirection: "column",
          borderStyle: "single",
          borderColor: "cyan",
          paddingX: 1,
          children: [
            /* @__PURE__ */ jsx2(Box2, { flexDirection: "column", children: (() => {
              let logicalLineNum = exportContentLines.slice(0, exportScrollOffset).filter((l) => !l.isContinuation).length;
              return exportContentLines.slice(exportScrollOffset, exportScrollOffset + EXPORT_VISIBLE_LINES).map((line, i) => {
                if (!line.isContinuation) logicalLineNum++;
                return renderExportLine(line, i, logicalLineNum, exportScrollOffset + i === exportCursor);
              });
            })() }),
            /* @__PURE__ */ jsxs2(Box2, { justifyContent: "space-between", children: [
              /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: exportContentLines.length === 0 ? "" : `${exportScrollOffset + 1}-${Math.min(exportScrollOffset + EXPORT_VISIBLE_LINES, exportContentLines.length)} of ${exportContentLines.length}` }),
              /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: "j/k:scroll  ^d/^u:pgup/pgdown" })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxs2(Box2, { marginTop: 1, justifyContent: "space-between", children: [
        /* @__PURE__ */ jsxs2(Box2, { children: [
          /* @__PURE__ */ jsx2(Text2, { backgroundColor: "#D4A843", color: "black", bold: true, children: " EXPORT " }),
          /* @__PURE__ */ jsx2(Text2, { children: "  " }),
          /* @__PURE__ */ jsx2(Text2, { color: "#D4A843", children: "Enter" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: ":proceed  " }),
          /* @__PURE__ */ jsx2(Text2, { color: "#D4A843", children: "Esc" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: ":back  " }),
          /* @__PURE__ */ jsx2(Text2, { color: "#D4A843", children: "y" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: ":copy" })
        ] }),
        statusMessage && /* @__PURE__ */ jsx2(Text2, { color: "cyan", children: statusMessage })
      ] })
    ] }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsxs2(Box2, { flexDirection: "row", children: [
        /* @__PURE__ */ jsxs2(Box2, { width: "40%", paddingLeft: 1, children: [
          /* @__PURE__ */ jsx2(Text2, { color: focusedPane === "history" ? "cyan" : void 0, bold: focusedPane === "history", children: "[1]" }),
          /* @__PURE__ */ jsx2(Text2, { children: " " }),
          /* @__PURE__ */ jsx2(Text2, { color: historyFilter === "all" ? "cyan" : void 0, children: "All" }),
          /* @__PURE__ */ jsx2(Text2, { children: " - " }),
          /* @__PURE__ */ jsxs2(Text2, { color: historyFilter === "selected" ? "cyan" : void 0, children: [
            "Selected (",
            selected.size,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ jsxs2(Box2, { flexGrow: 1, paddingLeft: 1, children: [
          /* @__PURE__ */ jsx2(Text2, { color: focusedPane === "preview" ? "cyan" : void 0, bold: focusedPane === "preview", children: "[2]" }),
          /* @__PURE__ */ jsx2(Text2, { color: focusedPane === "preview" ? "cyan" : void 0, children: " Preview" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs2(Box2, { flexDirection: "row", children: [
        /* @__PURE__ */ jsxs2(
          Box2,
          {
            flexDirection: "column",
            justifyContent: "space-between",
            borderStyle: "single",
            borderColor: focusedPane === "history" ? "cyan" : "gray",
            paddingX: 1,
            width: "40%",
            minHeight: VISIBLE_LINES + 3,
            children: [
              /* @__PURE__ */ jsx2(Box2, { flexDirection: "column", children: visibleEntries.map(({ entry, originalIdx }, i) => {
                const displayIdx = clampedScrollOffset + i;
                const uuid = getUuid(entry) ?? `idx-${originalIdx}`;
                const fmt = formatEntry(entry, displayIdx, cursor, selected, matchIndices, currentMatchIdx, rangeStart, originalIdx, visualRangeAddsNew);
                const prefixColor = fmt.isVisualPreview ? fmt.visualColor : fmt.isSelected ? "cyan" : void 0;
                return /* @__PURE__ */ jsxs2(Text2, { wrap: "truncate", children: [
                  /* @__PURE__ */ jsx2(Text2, { color: prefixColor, bold: fmt.isCursor, children: fmt.prefix }),
                  /* @__PURE__ */ jsxs2(Text2, { dimColor: true, children: [
                    fmt.uuid,
                    " "
                  ] }),
                  /* @__PURE__ */ jsxs2(Text2, { color: getTypeColor2(fmt.type), children: [
                    fmt.type.padEnd(9),
                    " "
                  ] }),
                  fmt.isToolResult && /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: "\u221F " }),
                  /* @__PURE__ */ jsx2(
                    Text2,
                    {
                      color: fmt.isCurrentMatch ? "yellow" : fmt.isMatch ? "cyan" : void 0,
                      inverse: fmt.isCursor,
                      children: fmt.preview
                    }
                  )
                ] }, `${uuid}-${originalIdx}`);
              }) }),
              /* @__PURE__ */ jsxs2(Box2, { justifyContent: "space-between", children: [
                /* @__PURE__ */ jsx2(Text2, { children: selected.size > 0 ? /* @__PURE__ */ jsxs2(Text2, { children: [
                  selected.size,
                  " selected"
                ] }) : /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: "No selection" }) }),
                /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: filteredEntries.length === 0 ? "" : `${clampedScrollOffset + 1}-${Math.min(clampedScrollOffset + VISIBLE_LINES, filteredEntries.length)} of ${filteredEntries.length}` })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs2(
          Box2,
          {
            flexDirection: "column",
            justifyContent: "space-between",
            borderStyle: "single",
            borderColor: focusedPane === "preview" ? "cyan" : "gray",
            paddingX: 1,
            flexGrow: 1,
            minHeight: VISIBLE_LINES + 3,
            children: [
              /* @__PURE__ */ jsx2(Box2, { flexDirection: "column", children: visiblePreviewLines.map((wrappedLine, i) => /* @__PURE__ */ jsx2(Text2, { wrap: "truncate", children: wrappedLine.text }, i)) }),
              /* @__PURE__ */ jsx2(Box2, { justifyContent: "flex-end", children: /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: previewLines.length === 0 ? "" : `${clampedPreviewOffset + 1}-${Math.min(clampedPreviewOffset + PREVIEW_VISIBLE_LINES, previewLines.length)} of ${previewLines.length}` }) })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx2(Box2, { marginTop: 1, justifyContent: "space-between", children: /* @__PURE__ */ jsxs2(Box2, { children: [
        searchMode || searchQuery ? /* @__PURE__ */ jsx2(Text2, { backgroundColor: "#D5B451", color: "black", bold: true, children: " SEARCH " }) : cherrypickMode ? /* @__PURE__ */ jsx2(Text2, { backgroundColor: "#55A3E0", color: "black", bold: true, children: " CHERRYPICK " }) : rangeStart !== null ? /* @__PURE__ */ jsx2(Text2, { backgroundColor: "#A6A8FA", color: "black", bold: true, children: " VISUAL " }) : /* @__PURE__ */ jsx2(Text2, { backgroundColor: "#8BB372", color: "black", bold: true, children: " NORMAL " }),
        /* @__PURE__ */ jsx2(Text2, { children: "  " }),
        statusMessage ? /* @__PURE__ */ jsx2(Text2, { color: "green", children: statusMessage }) : searchMode ? /* @__PURE__ */ jsxs2(Text2, { children: [
          /* @__PURE__ */ jsx2(Text2, { color: "green", children: "/" }),
          searchQuery ? /* @__PURE__ */ jsxs2(Fragment, { children: [
            /* @__PURE__ */ jsx2(Text2, { bold: true, children: searchQuery }),
            /* @__PURE__ */ jsx2(Text2, { color: "gray", children: "\u2588" }),
            searchedNoMatches ? /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: " No matches" }) : /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: " [Enter]" })
          ] }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
            /* @__PURE__ */ jsx2(Text2, { color: "gray", children: "\u2588" }),
            /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: " type keyword" })
          ] })
        ] }) : searchQuery && matchIndices.length > 0 ? /* @__PURE__ */ jsxs2(Text2, { children: [
          /* @__PURE__ */ jsx2(Text2, { color: "green", children: "/" }),
          /* @__PURE__ */ jsx2(Text2, { color: "green", bold: true, children: searchQuery }),
          /* @__PURE__ */ jsxs2(Text2, { color: "green", children: [
            " [",
            currentMatchIdx + 1,
            "/",
            matchIndices.length,
            "]"
          ] }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: " n/N:cycle" })
        ] }) : searchQuery && matchIndices.length === 0 ? /* @__PURE__ */ jsxs2(Text2, { children: [
          /* @__PURE__ */ jsx2(Text2, { color: "green", children: "/" }),
          /* @__PURE__ */ jsx2(Text2, { bold: true, children: searchQuery }),
          /* @__PURE__ */ jsx2(Text2, { color: "gray", children: "\u2588" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: " No matches" })
        ] }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsx2(Text2, { color: "#8BB372", children: "Space" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: ":select  " }),
          /* @__PURE__ */ jsx2(Text2, { color: "#8BB372", children: "Enter" }),
          /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: ":Export" })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx2(Box2, { marginTop: 1, children: /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: searchMode || searchQuery ? "Esc:back" : "Tab:tabs  c:cherrypick  u:undo  /:search  q:quit" }) })
    ] })
  ] });
}
async function runPicker(entries, sessionPath) {
  return new Promise((resolve3) => {
    let interactiveResult;
    const { waitUntilExit } = render2(
      /* @__PURE__ */ jsx2(
        Picker,
        {
          entries,
          sessionPath,
          onExit: (selections) => {
            resolve3({ selections, interactiveExport: interactiveResult });
          },
          onInteractiveExport: (result) => {
            interactiveResult = result;
          }
        }
      )
    );
    waitUntilExit().then(() => {
    });
  });
}
var HEADER_FOOTER_LINES, EXPORT_HEADER_FOOTER_LINES;
var init_picker = __esm({
  "src/cli/picker.tsx"() {
    "use strict";
    init_messages2();
    init_loader();
    init_convert();
    init_builder();
    init_theme();
    HEADER_FOOTER_LINES = 11;
    EXPORT_HEADER_FOOTER_LINES = 9;
  }
});

// src/cli.ts
init_loader();
import { Command } from "commander";
import { writeFile as writeFile2 } from "fs/promises";
import { resolve as resolve2 } from "path";
import chalk from "chalk";

// src/parser/clip.ts
init_loader();
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

// src/cli.ts
init_loader();
init_convert();
init_builder();
init_theme();
init_messages2();
init_upload();
init_sessions();
var program = new Command();
program.name("cc-prism").description("Convert Claude Code session JSONL files to asciicast v3").version("0.1.0");
program.command("cast").description("Generate asciicast from a session file").argument("[session]", "Path to session JSONL file (or use --latest)").option("--latest", "Use most recent session from current project").option("--start-uuid <uuid>", "Start from message UUID").option("--end-uuid <uuid>", "End at message UUID").option("--last <n>", "Last N messages", parseIntOption).option("--start-time <timestamp>", "Start from timestamp (ISO 8601)").option("--end-time <timestamp>", "End at timestamp (ISO 8601)").option("-o, --output <file>", "Output file path (default: stdout)").option("--theme <name>", "Theme name (tokyo-night, dracula, nord, catppuccin-mocha)", "tokyo-night").option("--preset <preset>", "Timing preset (speedrun, default, realtime)", "default").option("--max-wait <seconds>", "Maximum pause between events", parseFloatOption).option("--thinking-pause <seconds>", "Pause before assistant response", parseFloatOption).option("--typing-effect", "Enable typing effect for user input").option("--no-status-spinner", "Disable status spinner animation").option("--spinner-duration <seconds>", "Duration of spinner animation (default: 3.0)", parseFloatOption).option("--cols <n>", "Terminal width", parseIntOption, 100).option("--rows <n>", "Terminal height", parseIntOption, 40).option("--markers <mode>", "Marker mode (all, user, tools, none)", "all").option("--title <title>", "Recording title").option("--upload", "Upload to asciinema.org after generation").option("--no-agents", "Exclude agent/sub-assistant messages").option("-q, --quiet", "Suppress stats output").option("-I, --interactive", "Open interactive options form").action(async (sessionPath, options) => {
  try {
    let fullPath;
    if (options.latest) {
      const latest = await getLatestSession(process.cwd());
      if (!latest) {
        console.error(chalk.red("Error: No sessions found for current project"));
        console.error(chalk.gray(`  Looked in: ${getClaudeProjectPath(process.cwd())}`));
        process.exit(1);
      }
      fullPath = latest;
      if (!options.quiet) {
        console.error(chalk.gray(`Using: ${fullPath}`));
      }
    } else if (sessionPath) {
      fullPath = resolve2(sessionPath);
    } else {
      console.error(chalk.red("Error: Provide a session path or use --latest"));
      process.exit(1);
    }
    if (fullPath.endsWith(".cast")) {
      if (options.upload) {
        console.error(chalk.cyan("  Uploading existing cast file..."));
        const url = await uploadToAsciinema(fullPath);
        if (url) {
          console.error(chalk.green(`\u2713 Uploaded: ${url}`));
        }
        process.exit(0);
      } else {
        console.error(chalk.red("Error: Input is already a .cast file"));
        console.error(chalk.gray("  Use --upload to share it on asciinema.org"));
        console.error(chalk.gray("  Or provide a .jsonl session file to convert"));
        process.exit(1);
      }
    }
    const entries = await loadTranscript(fullPath, {
      loadAgents: options.agents !== false
    });
    if (entries.length === 0) {
      console.error(chalk.red("Error: No messages found in session file"));
      process.exit(1);
    }
    const clip = extractClip(entries, {
      startUuid: options.startUuid,
      endUuid: options.endUuid,
      startTime: options.startTime,
      endTime: options.endTime,
      last: options.last
    });
    if (clip.length === 0) {
      console.error(chalk.red("Error: No messages match the specified criteria"));
      process.exit(1);
    }
    if (options.interactive) {
      const { runInteractiveForm: runInteractiveForm2 } = await Promise.resolve().then(() => (init_interactive(), interactive_exports));
      const sessionBasename = fullPath.split("/").pop()?.replace(".jsonl", "") || "session";
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const defaultOutput = `${sessionBasename.slice(0, 8)}-${timestamp}.cast`;
      const sessionInfo2 = getSessionInfo(clip);
      const defaultTitle = generateTitle(sessionInfo2);
      const formConfig = await runInteractiveForm2(fullPath, defaultOutput, defaultTitle);
      if (!formConfig) {
        process.exit(0);
      }
      options.output = formConfig.output;
      options.upload = formConfig.upload;
      options.theme = formConfig.theme;
      options.cols = formConfig.cols;
      options.rows = formConfig.rows;
      options.title = formConfig.title || void 0;
      options.preset = formConfig.preset;
      options.maxWait = formConfig.maxWait ?? void 0;
      options.thinkingPause = formConfig.thinkingPause ?? void 0;
      options.typingEffect = formConfig.typingEffect;
      options.statusSpinner = formConfig.statusSpinner;
      options.spinnerDuration = formConfig.spinnerDuration;
      options.markers = formConfig.markers;
    }
    const theme = getTheme(options.theme);
    const sessionInfo = getSessionInfo(clip);
    const title = options.title ?? generateTitle(sessionInfo);
    const result = convertToAsciicast(clip, {
      builder: {
        cols: options.cols,
        rows: options.rows,
        title
      },
      timing: {
        preset: options.preset,
        maxWait: options.maxWait,
        thinkingPause: options.thinkingPause,
        typingEffect: options.typingEffect
      },
      markers: {
        mode: options.markers
      },
      render: {
        theme,
        width: options.cols
      },
      inputAnimation: true,
      // Always enable Claude Code style input UI
      statusSpinner: options.statusSpinner,
      spinnerDuration: options.spinnerDuration
    });
    const castContent = serializeCast(result.document);
    if (options.output) {
      const outputPath = resolve2(options.output);
      await writeFile2(outputPath, castContent, "utf-8");
      if (!options.quiet) {
        console.error(chalk.green(`\u2713 Generated ${outputPath}`));
        printStats(result.stats, options);
      }
      if (options.upload) {
        await handleUpload(outputPath, options.quiet);
      }
    } else if (options.upload) {
      const tempPath = `/tmp/cc-prism-${Date.now()}.cast`;
      await writeFile2(tempPath, castContent, "utf-8");
      await handleUpload(tempPath, options.quiet);
    } else {
      process.stdout.write(castContent);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
});
program.command("list").description("List messages with UUIDs and timestamps").argument("<session>", "Path to session JSONL file").option("--no-agents", "Exclude agent/sub-assistant messages").option("--all", "Show all messages including non-renderable").action(async (sessionPath, options) => {
  try {
    const fullPath = resolve2(sessionPath);
    const entries = await loadTranscript(fullPath, {
      loadAgents: options.agents !== false
    });
    if (entries.length === 0) {
      console.log(chalk.yellow("No messages found in session file"));
      return;
    }
    console.log(
      chalk.bold(
        padRight("UUID", 12) + padRight("TIME", 10) + padRight("TYPE", 12) + "CONTENT"
      )
    );
    console.log("\u2500".repeat(80));
    for (const entry of entries) {
      if (!options.all && !isRenderableMessage(entry)) {
        continue;
      }
      const uuid = getUuid(entry);
      const timestamp = getTimestamp(entry);
      const timeStr = timestamp ? timestamp.toISOString().substring(11, 19) : "        ";
      const uuidShort = uuid ? uuid.substring(0, 10) + ".." : "            ";
      let typeStr = entry.type;
      let contentPreview = "";
      if (entry.type === "user") {
        if (entry.toolUseResult) {
          typeStr = "tool-result";
          const isError = typeof entry.toolUseResult === "string" || entry.toolUseResult.is_error;
          contentPreview = isError ? "(error)" : "(success)";
        } else {
          const content = typeof entry.message.content === "string" ? entry.message.content : "";
          contentPreview = content.substring(0, 40).replace(/\n/g, " ");
        }
      } else if (entry.type === "assistant") {
        const tools = entry.message.content.filter((c) => c.type === "tool_use");
        if (tools.length > 0) {
          const toolNames = tools.map((t) => t.name).join(", ");
          contentPreview = `[${toolNames}]`;
        } else {
          const text = entry.message.content.find((c) => c.type === "text");
          if (text && text.type === "text") {
            contentPreview = text.text.substring(0, 40).replace(/\n/g, " ");
          }
        }
      } else if (entry.type === "system" && entry.content) {
        contentPreview = entry.content.substring(0, 40);
      }
      const color = getTypeColor(entry.type);
      console.log(
        chalk.gray(uuidShort) + chalk.gray(padRight(timeStr, 10)) + color(padRight(typeStr, 12)) + contentPreview
      );
    }
    const summary = getClipSummary(entries);
    console.log("\u2500".repeat(80));
    console.log(
      chalk.gray(
        `Total: ${summary.total} messages | User: ${summary.user} | Assistant: ${summary.assistant} | Tools: ${summary.tools}`
      )
    );
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
});
function parseIntOption(value) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}
function parseFloatOption(value) {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}
function padRight(str, len) {
  return str.padEnd(len);
}
function getTypeColor(type) {
  switch (type) {
    case "user":
      return chalk.blue;
    case "assistant":
      return chalk.magenta;
    case "system":
      return chalk.yellow;
    case "tool-result":
      return chalk.green;
    default:
      return chalk.white;
  }
}
function printStats(stats, options) {
  console.error(
    chalk.gray(
      `  Messages: ${stats.entriesRendered}/${stats.entriesProcessed} | Events: ${stats.eventsGenerated} | Markers: ${stats.markersGenerated} | Duration: ${stats.duration.toFixed(1)}s | Preset: ${options.preset ?? "default"}`
    )
  );
}
async function handleUpload(filePath, quiet) {
  if (!quiet) {
    console.error(chalk.gray("  Uploading to asciinema.org..."));
  }
  const result = await uploadToAsciinema(filePath);
  if (result.success && result.url) {
    console.log(chalk.green(`\u2713 Uploaded: ${result.url}`));
  } else {
    console.error(chalk.red(`\u2717 Upload failed: ${result.error}`));
    if (result.error?.includes("auth")) {
      console.error(chalk.yellow("  Run 'asciinema auth' to authenticate first"));
    }
    process.exit(1);
  }
}
program.command("sessions").description("List available sessions for current project").action(async () => {
  try {
    const cwd = process.cwd();
    const projectPath = getClaudeProjectPath(cwd);
    const sessions = await listSessions(projectPath);
    if (sessions.length === 0) {
      console.log(chalk.yellow("No sessions found"));
      console.log(chalk.gray(`  Project path: ${projectPath}`));
      return;
    }
    console.log(chalk.bold(`Sessions for ${cwd}`));
    console.log(chalk.gray(projectPath));
    console.log();
    for (const session of sessions) {
      const age = formatAge(session.modified);
      console.log(
        chalk.cyan(session.name.substring(0, 8)) + chalk.gray("  " + padRight(age, 12) + formatSize(session.size))
      );
    }
    console.log();
    console.log(chalk.gray(`Use: cc-prism cast --latest`));
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
});
function formatAge(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1e3);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
program.command("pick").description("Interactive message picker for selecting ranges").argument("[session]", "Path to session JSONL file (or use --latest)").option("--latest", "Use most recent session from current project").option("--no-agents", "Exclude agent/sub-assistant messages").action(async (sessionPath, options) => {
  try {
    let fullPath;
    if (options.latest) {
      const latestPath = await getLatestSession(process.cwd());
      if (!latestPath) {
        console.error(chalk.red("No sessions found for current project"));
        console.error(chalk.gray(`Searched in: ${getClaudeProjectPath(process.cwd())}`));
        process.exit(1);
      }
      fullPath = latestPath;
    } else if (sessionPath) {
      fullPath = resolve2(sessionPath);
    } else {
      console.error(chalk.red("Error: session path required or use --latest"));
      process.exit(1);
    }
    const entries = await loadTranscript(fullPath, {
      loadAgents: options.agents !== false
    });
    if (entries.length === 0) {
      console.log(chalk.yellow("No messages found in session file"));
      return;
    }
    const { runPicker: runPicker2 } = await Promise.resolve().then(() => (init_picker(), picker_exports));
    const result = await runPicker2(entries, fullPath);
    if (result.interactiveExport) {
      const { jsonlPath } = result.interactiveExport;
      console.log(chalk.cyan(`
Launching interactive cast options for: ${jsonlPath}`));
      const exportedEntries = await loadTranscript(jsonlPath, { loadAgents: false });
      const sessionInfo = getSessionInfo(exportedEntries);
      const defaultTitle = generateTitle(sessionInfo);
      const defaultOutput = jsonlPath.replace(/\.jsonl$/, ".cast");
      const { runInteractiveForm: runInteractiveForm2 } = await Promise.resolve().then(() => (init_interactive(), interactive_exports));
      const formConfig = await runInteractiveForm2(jsonlPath, defaultOutput, defaultTitle);
      if (formConfig) {
        const theme = getTheme(formConfig.theme);
        const castResult = convertToAsciicast(exportedEntries, {
          builder: {
            cols: formConfig.cols,
            rows: formConfig.rows,
            title: formConfig.title || defaultTitle
          },
          timing: {
            preset: formConfig.preset,
            maxWait: formConfig.maxWait ?? void 0,
            thinkingPause: formConfig.thinkingPause ?? void 0
          },
          markers: { mode: formConfig.markers },
          render: { theme, width: formConfig.cols },
          inputAnimation: formConfig.typingEffect,
          statusSpinner: formConfig.statusSpinner,
          spinnerDuration: formConfig.spinnerDuration
        });
        const castContent = serializeCast(castResult.document);
        const outputPath = formConfig.output || defaultOutput;
        await writeFile2(outputPath, castContent);
        console.log(chalk.green(`
Generated: ${outputPath}`));
        if (formConfig.upload) {
          const { uploadToAsciinema: uploadToAsciinema2 } = await Promise.resolve().then(() => (init_upload(), upload_exports));
          const uploadResult = await uploadToAsciinema2(outputPath);
          if (uploadResult.success) {
            console.log(chalk.green(`Uploaded: ${uploadResult.url}`));
          } else {
            console.error(chalk.red(`Upload failed: ${uploadResult.error}`));
          }
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
});
program.parse();
//# sourceMappingURL=cli.js.map