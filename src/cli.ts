#!/usr/bin/env node
/**
 * cc-prism CLI
 * Convert Claude Code session JSONL files to asciicast v3
 */

import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";

import { loadTranscript } from "./parser/loader.js";
import { extractClip, getClipSummary } from "./parser/clip.js";
import { getTimestamp, getUuid } from "./parser/loader.js";
import { convertToAsciicast, getSessionInfo, generateTitle } from "./generator/convert.js";
import { serializeCast } from "./generator/builder.js";
import { getTheme } from "./renderer/theme.js";
import type { MarkerMode } from "./types/asciicast.js";
import { isRenderableMessage } from "./types/messages.js";
import { uploadToAsciinema } from "./cli/upload.js";
import { getClaudeProjectPath, listSessions, getLatestSession, formatSize } from "./cli/sessions.js";

const program = new Command();

program
  .name("cc-prism")
  .description("Convert Claude Code session JSONL files to asciicast v3")
  .version("0.1.0");

// =============================================================================
// cast command
// =============================================================================

program
  .command("cast")
  .description("Generate asciicast from a session file")
  .argument("[session]", "Path to session JSONL file (or use --latest)")
  .option("--latest", "Use most recent session from current project")
  .option("--start-uuid <uuid>", "Start from message UUID")
  .option("--end-uuid <uuid>", "End at message UUID")
  .option("--last <n>", "Last N messages", parseIntOption)
  .option("--start-time <timestamp>", "Start from timestamp (ISO 8601)")
  .option("--end-time <timestamp>", "End at timestamp (ISO 8601)")
  .option("-o, --output <file>", "Output file path (default: stdout)")
  .option("--theme <name>", "Theme name (tokyo-night, dracula, nord, catppuccin-mocha)", "tokyo-night")
  .option("--preset <preset>", "Timing preset (speedrun, default, realtime)", "default")
  .option("--max-wait <seconds>", "Maximum pause between events", parseFloatOption)
  .option("--thinking-pause <seconds>", "Pause before assistant response", parseFloatOption)
  .option("--typing-effect", "Enable typing effect for user input")
  .option("--no-status-spinner", "Disable status spinner animation")
  .option("--spinner-duration <seconds>", "Duration of spinner animation (default: 3.0)", parseFloatOption)
  .option("--cols <n>", "Terminal width", parseIntOption, 100)
  .option("--rows <n>", "Terminal height", parseIntOption, 40)
  .option("--markers <mode>", "Marker mode (all, user, tools, none)", "all")
  .option("--title <title>", "Recording title")
  .option("--upload", "Upload to asciinema.org after generation")
  .option("--no-agents", "Exclude agent/sub-assistant messages")
  .option("-q, --quiet", "Suppress stats output")
  .option("-I, --interactive", "Open interactive options form")
  .action(async (sessionPath: string | undefined, options) => {
    try {
      // Resolve session path
      let fullPath: string;
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
        fullPath = resolve(sessionPath);
      } else {
        console.error(chalk.red("Error: Provide a session path or use --latest"));
        process.exit(1);
      }

      // Handle .cast files: upload-only mode
      if (fullPath.endsWith(".cast")) {
        if (options.upload) {
          // Just upload the existing cast file
          console.error(chalk.cyan("  Uploading existing cast file..."));
          const url = await uploadToAsciinema(fullPath);
          if (url) {
            console.error(chalk.green(`✓ Uploaded: ${url}`));
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
        loadAgents: options.agents !== false,
      });

      if (entries.length === 0) {
        console.error(chalk.red("Error: No messages found in session file"));
        process.exit(1);
      }

      // Apply clip extraction
      const clip = extractClip(entries, {
        startUuid: options.startUuid,
        endUuid: options.endUuid,
        startTime: options.startTime,
        endTime: options.endTime,
        last: options.last,
      });

      if (clip.length === 0) {
        console.error(chalk.red("Error: No messages match the specified criteria"));
        process.exit(1);
      }

      // Interactive mode: launch form TUI
      if (options.interactive) {
        const { runInteractiveForm } = await import("./cli/interactive.js");
        const sessionBasename = fullPath.split("/").pop()?.replace(".jsonl", "") || "session";
        const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
        const defaultOutput = `${sessionBasename.slice(0, 8)}-${timestamp}.cast`;
        const sessionInfo = getSessionInfo(clip);
        const defaultTitle = generateTitle(sessionInfo);

        const formConfig = await runInteractiveForm(fullPath, defaultOutput, defaultTitle);

        if (!formConfig) {
          // User cancelled
          process.exit(0);
        }

        // Map form config to options
        options.output = formConfig.output;
        options.upload = formConfig.upload;
        options.theme = formConfig.theme;
        options.cols = formConfig.cols;
        options.rows = formConfig.rows;
        options.title = formConfig.title || undefined;
        options.preset = formConfig.preset;
        options.maxWait = formConfig.maxWait ?? undefined;
        options.thinkingPause = formConfig.thinkingPause ?? undefined;
        options.typingEffect = formConfig.typingEffect;
        options.statusSpinner = formConfig.statusSpinner;
        options.spinnerDuration = formConfig.spinnerDuration;
        options.markers = formConfig.markers;
      }

      // Get theme
      const theme = getTheme(options.theme);

      // Generate title
      const sessionInfo = getSessionInfo(clip);
      const title = options.title ?? generateTitle(sessionInfo);

      // Convert to asciicast
      const result = convertToAsciicast(clip, {
        builder: {
          cols: options.cols,
          rows: options.rows,
          title,
        },
        timing: {
          preset: options.preset as "speedrun" | "default" | "realtime",
          maxWait: options.maxWait,
          thinkingPause: options.thinkingPause,
          typingEffect: options.typingEffect,
        },
        markers: {
          mode: options.markers as MarkerMode,
        },
        render: {
          theme,
          width: options.cols,
        },
        inputAnimation: true, // Always enable Claude Code style input UI
        statusSpinner: options.statusSpinner,
        spinnerDuration: options.spinnerDuration,
      });

      // Serialize
      const castContent = serializeCast(result.document);

      // Output
      if (options.output) {
        const outputPath = resolve(options.output);
        await writeFile(outputPath, castContent, "utf-8");

        if (!options.quiet) {
          console.error(chalk.green(`✓ Generated ${outputPath}`));
          printStats(result.stats, options);
        }

        // Upload if requested
        if (options.upload) {
          await handleUpload(outputPath, options.quiet);
        }
      } else if (options.upload) {
        // Write to temp file for upload
        const tempPath = `/tmp/cc-prism-${Date.now()}.cast`;
        await writeFile(tempPath, castContent, "utf-8");
        await handleUpload(tempPath, options.quiet);
      } else {
        // Write to stdout
        process.stdout.write(castContent);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// =============================================================================
// list command
// =============================================================================

program
  .command("list")
  .description("List messages with UUIDs and timestamps")
  .argument("<session>", "Path to session JSONL file")
  .option("--no-agents", "Exclude agent/sub-assistant messages")
  .option("--all", "Show all messages including non-renderable")
  .action(async (sessionPath: string, options) => {
    try {
      const fullPath = resolve(sessionPath);
      const entries = await loadTranscript(fullPath, {
        loadAgents: options.agents !== false,
      });

      if (entries.length === 0) {
        console.log(chalk.yellow("No messages found in session file"));
        return;
      }

      // Print header
      console.log(
        chalk.bold(
          padRight("UUID", 12) +
            padRight("TIME", 10) +
            padRight("TYPE", 12) +
            "CONTENT"
        )
      );
      console.log("─".repeat(80));

      // Print messages
      for (const entry of entries) {
        if (!options.all && !isRenderableMessage(entry)) {
          continue;
        }

        const uuid = getUuid(entry);
        const timestamp = getTimestamp(entry);
        const timeStr = timestamp
          ? timestamp.toISOString().substring(11, 19)
          : "        ";

        const uuidShort = uuid ? uuid.substring(0, 10) + ".." : "            ";

        let typeStr: string = entry.type;
        let contentPreview = "";

        if (entry.type === "user") {
          if (entry.toolUseResult) {
            typeStr = "tool-result";
            const isError = typeof entry.toolUseResult === "string" || entry.toolUseResult.is_error;
            contentPreview = isError ? "(error)" : "(success)";
          } else {
            const content =
              typeof entry.message.content === "string"
                ? entry.message.content
                : "";
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
          chalk.gray(uuidShort) +
            chalk.gray(padRight(timeStr, 10)) +
            color(padRight(typeStr, 12)) +
            contentPreview
        );
      }

      // Summary
      const summary = getClipSummary(entries);
      console.log("─".repeat(80));
      console.log(
        chalk.gray(
          `Total: ${summary.total} messages | ` +
            `User: ${summary.user} | ` +
            `Assistant: ${summary.assistant} | ` +
            `Tools: ${summary.tools}`
        )
      );
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// =============================================================================
// Helpers
// =============================================================================

function parseIntOption(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}

function parseFloatOption(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function getTypeColor(type: string): (text: string) => string {
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

interface ConvertStats {
  entriesProcessed: number;
  entriesRendered: number;
  eventsGenerated: number;
  markersGenerated: number;
  duration: number;
}

function printStats(stats: ConvertStats, options: { preset?: string }): void {
  console.error(
    chalk.gray(
      `  Messages: ${stats.entriesRendered}/${stats.entriesProcessed} | ` +
        `Events: ${stats.eventsGenerated} | ` +
        `Markers: ${stats.markersGenerated} | ` +
        `Duration: ${stats.duration.toFixed(1)}s | ` +
        `Preset: ${options.preset ?? "default"}`
    )
  );
}

async function handleUpload(filePath: string, quiet: boolean): Promise<void> {
  if (!quiet) {
    console.error(chalk.gray("  Uploading to asciinema.org..."));
  }

  const result = await uploadToAsciinema(filePath);

  if (result.success && result.url) {
    console.log(chalk.green(`✓ Uploaded: ${result.url}`));
  } else {
    console.error(chalk.red(`✗ Upload failed: ${result.error}`));
    if (result.error?.includes("auth")) {
      console.error(chalk.yellow("  Run 'asciinema auth' to authenticate first"));
    }
    process.exit(1);
  }
}

// =============================================================================
// sessions command
// =============================================================================

program
  .command("sessions")
  .description("List available sessions for current project")
  .action(async () => {
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
          chalk.cyan(session.name.substring(0, 8)) +
            chalk.gray("  " + padRight(age, 12) + formatSize(session.size))
        );
      }

      console.log();
      console.log(chalk.gray(`Use: cc-prism cast --latest`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

function formatAge(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// =============================================================================
// pick command
// =============================================================================

program
  .command("pick")
  .description("Interactive message picker for selecting ranges")
  .argument("[session]", "Path to session JSONL file (or use --latest)")
  .option("--latest", "Use most recent session from current project")
  .option("--no-agents", "Exclude agent/sub-assistant messages")
  .action(async (sessionPath: string | undefined, options) => {
    try {
      // Resolve session path
      let fullPath: string;
      if (options.latest) {
        const latestPath = await getLatestSession(process.cwd());
        if (!latestPath) {
          console.error(chalk.red("No sessions found for current project"));
          console.error(chalk.gray(`Searched in: ${getClaudeProjectPath(process.cwd())}`));
          process.exit(1);
        }
        fullPath = latestPath;
      } else if (sessionPath) {
        fullPath = resolve(sessionPath);
      } else {
        console.error(chalk.red("Error: session path required or use --latest"));
        process.exit(1);
      }

      // Load transcript
      const entries = await loadTranscript(fullPath, {
        loadAgents: options.agents !== false,
      });

      if (entries.length === 0) {
        console.log(chalk.yellow("No messages found in session file"));
        return;
      }

      // Run interactive picker (lazy load to avoid Ink/React overhead for other commands)
      const { runPicker } = await import("./cli/picker.js");
      const result = await runPicker(entries, fullPath);

      // If "Advanced options" was selected, launch interactive cast form
      if (result.interactiveExport) {
        const { jsonlPath } = result.interactiveExport;
        console.log(chalk.cyan(`\nLaunching interactive cast options for: ${jsonlPath}`));

        // Load the exported JSONL for title generation
        const exportedEntries = await loadTranscript(jsonlPath, { loadAgents: false });
        const sessionInfo = getSessionInfo(exportedEntries);
        const defaultTitle = generateTitle(sessionInfo);
        const defaultOutput = jsonlPath.replace(/\.jsonl$/, ".cast");

        // Run interactive form
        const { runInteractiveForm } = await import("./cli/interactive.js");
        const formConfig = await runInteractiveForm(jsonlPath, defaultOutput, defaultTitle);

        if (formConfig) {
          // Convert with form options
          const theme = getTheme(formConfig.theme);
          const castResult = convertToAsciicast(exportedEntries, {
            builder: {
              cols: formConfig.cols,
              rows: formConfig.rows,
              title: formConfig.title || defaultTitle,
            },
            timing: {
              preset: formConfig.preset as "speedrun" | "default" | "realtime",
              maxWait: formConfig.maxWait ?? undefined,
              thinkingPause: formConfig.thinkingPause ?? undefined,
            },
            markers: { mode: formConfig.markers as "all" | "user" | "tools" | "none" },
            render: { theme, width: formConfig.cols },
            inputAnimation: formConfig.typingEffect,
            statusSpinner: formConfig.statusSpinner,
            spinnerDuration: formConfig.spinnerDuration,
          });

          const castContent = serializeCast(castResult.document);
          const outputPath = formConfig.output || defaultOutput;
          await writeFile(outputPath, castContent);
          console.log(chalk.green(`\nGenerated: ${outputPath}`));

          // Handle upload if requested
          if (formConfig.upload) {
            const { uploadToAsciinema } = await import("./cli/upload.js");
            const uploadResult = await uploadToAsciinema(outputPath);
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
