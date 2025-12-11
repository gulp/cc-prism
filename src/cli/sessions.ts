/**
 * Session discovery - find Claude Code sessions for current project
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

/** Get Claude projects directory path from a working directory */
export function getClaudeProjectPath(cwd: string): string {
  const mangled = cwd.replace(/\//g, "-");
  return join(homedir(), ".claude/projects", mangled);
}

export interface SessionInfo {
  path: string;
  name: string;
  modified: Date;
  size: number;
}

/** List session files in a Claude project directory */
export async function listSessions(projectPath: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];

  try {
    const files = await readdir(projectPath);

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      if (file.startsWith("agent-")) continue;

      const filePath = join(projectPath, file);
      const stats = await stat(filePath);

      sessions.push({
        path: filePath,
        name: file.replace(".jsonl", ""),
        modified: stats.mtime,
        size: stats.size,
      });
    }
  } catch {
    // Directory doesn't exist
  }

  return sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

/** Get the most recent session file */
export async function getLatestSession(cwd: string): Promise<string | null> {
  const projectPath = getClaudeProjectPath(cwd);
  const sessions = await listSessions(projectPath);
  return sessions[0]?.path ?? null;
}

/** Format file size */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// =============================================================================
// Profile System
// =============================================================================

const PROFILE_FILENAME = "cc-prism.profile";

export interface ProfileConfig {
  output?: string;
  upload?: boolean;
  theme?: string;
  cols?: number;
  rows?: number;
  title?: string;
  preset?: string;
  max_wait?: number | null;
  thinking_pause?: number | null;
  typing_effect?: boolean;
  status_spinner?: boolean;
  spinner_duration?: number;
  markers?: string;
}

/**
 * Load profile from current directory.
 * Returns null if profile doesn't exist or is invalid.
 */
export async function loadProfile(cwd: string = process.cwd()): Promise<ProfileConfig | null> {
  const profilePath = join(cwd, PROFILE_FILENAME);

  try {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(profilePath, "utf-8");
    const config = JSON.parse(content) as ProfileConfig;
    return config;
  } catch {
    // File doesn't exist or invalid JSON
    return null;
  }
}

/**
 * Save profile to current directory.
 * Throws on write failure.
 */
export async function saveProfile(
  config: ProfileConfig,
  cwd: string = process.cwd()
): Promise<void> {
  const profilePath = join(cwd, PROFILE_FILENAME);
  const { writeFile } = await import("node:fs/promises");
  const content = JSON.stringify(config, null, 2);
  await writeFile(profilePath, content, "utf-8");
}

/**
 * Check if profile exists in current directory.
 */
export async function profileExists(cwd: string = process.cwd()): Promise<boolean> {
  const profilePath = join(cwd, PROFILE_FILENAME);

  try {
    const { access } = await import("node:fs/promises");
    await access(profilePath);
    return true;
  } catch {
    return false;
  }
}
