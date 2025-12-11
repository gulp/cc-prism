/**
 * asciinema upload integration
 */

import { spawn } from "node:child_process";

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/** Upload a .cast file to asciinema.org */
export async function uploadToAsciinema(filePath: string): Promise<UploadResult> {
  return new Promise((resolve) => {
    const proc = spawn("asciinema", ["upload", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({
          success: false,
          error: "asciinema CLI not found. Install with: pip install asciinema",
        });
      } else {
        resolve({
          success: false,
          error: error.message,
        });
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // Extract URL from output
        const url = extractUrl(stdout) || extractUrl(stderr);
        if (url) {
          resolve({ success: true, url });
        } else {
          resolve({
            success: true,
            url: stdout.trim() || "Upload successful (URL not found in output)",
          });
        }
      } else {
        // Check for auth errors
        const output = stdout + stderr;
        if (output.includes("auth") || output.includes("token") || output.includes("API")) {
          resolve({
            success: false,
            error: "Authentication required. Run 'asciinema auth' first.",
          });
        } else {
          resolve({
            success: false,
            error: stderr.trim() || stdout.trim() || `Exit code: ${code}`,
          });
        }
      }
    });
  });
}

/** Check if asciinema CLI is available */
export async function checkAsciinema(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("asciinema", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.on("error", () => {
      resolve(false);
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

/** Extract URL from asciinema output */
function extractUrl(text: string): string | null {
  // Match asciinema.org URLs
  const match = text.match(/https?:\/\/asciinema\.org\/a\/[a-zA-Z0-9]+/);
  return match ? match[0] : null;
}
