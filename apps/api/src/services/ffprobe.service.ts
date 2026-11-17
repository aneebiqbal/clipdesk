import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("ffprobe returned no usable duration");
  }
  return duration;
}

/** Turn a probe failure into something actionable for the user. */
export function probeErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (code === "ENOENT") {
      return "FFmpeg/ffprobe is not installed or not on PATH.";
    }
  }
  return "That file isn't a video FFmpeg can read. Try an MP4, MKV or WebM.";
}
