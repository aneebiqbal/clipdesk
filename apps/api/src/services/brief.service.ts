import type { ManualTimestamp } from "@clipdesk/types";
import { prisma } from "../lib/prisma";

export interface BriefScriptJson {
  id: string;
  title: string | null;
  description: string;
  keywords: string[];
}

export interface BriefTopicJson {
  id: string;
  name: string;
  type: "scripted" | "energy" | "manual";
  scripts?: BriefScriptJson[];
  timestamps?: { start: number; end: number; label: string | null }[];
}

export interface BriefJson {
  topics: BriefTopicJson[];
  game: string;
  clips_per_topic: number;
}

export const BUILTIN_VOICE_ID = "builtin-voice";
export const BUILTIN_TIMESTAMPS_ID = "builtin-timestamps";

/**
 * Resolve a stored brief (plus any manual timestamps) into the JSON the Python
 * worker reads. Always includes the two built-in topics so energy detection and
 * manual timestamps keep working.
 */
export async function resolveBriefJson(
  briefId: string | null,
  manualTimestamps: ManualTimestamp[],
  game: string,
  clipsPerTopic: number,
): Promise<BriefJson | null> {
  const brief = briefId
    ? await prisma.brief.findUnique({ where: { id: briefId } })
    : null;
  if (briefId && !brief) return null;

  const orderedIds: string[] = [...(brief?.topicIds ?? []), BUILTIN_VOICE_ID, BUILTIN_TIMESTAMPS_ID];
  const uniqueIds = [...new Set(orderedIds)];

  const topics = await prisma.topic.findMany({
    where: { id: { in: uniqueIds } },
    include: { scripts: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  const byId = new Map(topics.map((topic) => [topic.id, topic]));

  const out: BriefTopicJson[] = [];
  for (const id of uniqueIds) {
    const topic = byId.get(id);
    if (!topic) continue;
    if (id === BUILTIN_VOICE_ID) {
      out.push({ id, name: topic.name, type: "energy" });
    } else if (id === BUILTIN_TIMESTAMPS_ID) {
      out.push({
        id,
        name: topic.name,
        type: "manual",
        timestamps: manualTimestamps.map((timestamp) => ({
          start: timestamp.startSec,
          end: timestamp.endSec,
          label: timestamp.label ?? null,
        })),
      });
    } else {
      out.push({
        id,
        name: topic.name,
        type: "scripted",
        scripts: topic.scripts.map((script) => ({
          id: script.id,
          title: script.title,
          description: script.description,
          keywords: script.keywords,
        })),
      });
    }
  }

  return { topics: out, game, clips_per_topic: clipsPerTopic };
}
