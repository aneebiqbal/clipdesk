import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import type { Settings } from "@clipdesk/types";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const WORKER_CONFIG = path.join(REPO_ROOT, "worker", "config.yaml");

/**
 * Build the YAML config the Python worker reads. The worker's own config.yaml is the
 * source of truth for pipeline tuning; user settings only override a few keys.
 */
export function buildWorkerConfig(settings: Settings): Record<string, unknown> {
  const raw = fs.readFileSync(WORKER_CONFIG, "utf8");
  const cfg = (yaml.parse(raw) ?? {}) as Record<string, unknown>;

  const tts = (cfg["tts"] as Record<string, unknown> | undefined) ?? {};
  tts["enabled"] = settings.voice;
  cfg["tts"] = tts;

  const audio = (cfg["audio"] as Record<string, unknown> | undefined) ?? {};
  audio["music_enabled"] = settings.music;
  cfg["audio"] = audio;

  const llm = (cfg["llm"] as Record<string, unknown> | undefined) ?? {};
  llm["game_name"] = settings.config.gameName ?? "GTA 6";
  llm["provider"] = settings.geminiKey ? "gemini" : "none";
  cfg["llm"] = llm;

  return cfg;
}
