import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../lib/config";

const execFileAsync = promisify(execFile);

export interface ThumbOption {
  timestamp: number;
  path: string;
  selected: boolean;
}

interface ClipLike {
  filePath: string;
  sourceStart: number;
  sourceEnd: number;
  duration: number;
}

/**
 * Render three poster candidates per clip: 1.5s, the midpoint, and the
 * highest-energy second (from the stream waveform) inside the clip.
 */
export async function generateThumbOptions(
  clip: ClipLike,
  waveform: number[] | null,
  jobDuration: number | null,
): Promise<{ options: ThumbOption[]; selectedPath: string }> {
  const cap = Math.max(0, clip.duration - 0.1);
  const timestamps = new Set<number>([
    Math.min(1.5, cap),
    Math.min(clip.duration / 2, cap),
  ]);

  let energyT = clip.duration * 0.75;
  if (waveform && jobDuration && waveform.length > 0) {
    const startBin = Math.max(0, Math.floor((clip.sourceStart / jobDuration) * waveform.length));
    const endBin = Math.min(
      waveform.length - 1,
      Math.ceil((clip.sourceEnd / jobDuration) * waveform.length),
    );
    let best = startBin;
    for (let i = startBin; i <= endBin; i += 1) {
      if ((waveform[i] ?? 0) > (waveform[best] ?? 0)) best = i;
    }
    energyT = Math.min(cap, Math.max(0, (best / waveform.length) * jobDuration - clip.sourceStart));
  }
  timestamps.add(energyT);

  const list = [...timestamps].map((t) => Math.round(t * 10) / 10).slice(0, 3);
  const absClip = path.join(config.OUTPUT_DIR, clip.filePath);
  const relDir = path.dirname(clip.filePath).split(path.sep).join("/");
  const options: ThumbOption[] = [];

  for (const timestamp of list) {
    const rel = `${relDir}/thumb_${timestamp.toFixed(1)}.jpg`;
    const abs = path.join(config.OUTPUT_DIR, rel);
    try {
      await execFileAsync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        timestamp.toFixed(2),
        "-i",
        absClip,
        "-frames:v",
        "1",
        "-vf",
        "scale=432:-2",
        "-q:v",
        "4",
        abs,
      ]);
      options.push({ timestamp, path: rel, selected: options.length === 0 });
    } catch {
      /* skip this option */
    }
  }

  return { options, selectedPath: options[0]?.path ?? "" };
}
