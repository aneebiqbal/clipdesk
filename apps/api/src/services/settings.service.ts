import { Prisma } from "@prisma/client";
import type { Settings, SettingsConfig, SettingsUpdate } from "@clipdesk/types";
import { prisma } from "../lib/prisma";

const DEFAULT_CONFIG: SettingsConfig = { gameName: "GTA 6" };

type SettingsRow = {
  clips: number;
  voice: boolean;
  music: boolean;
  geminiKey: string | null;
  config: unknown;
};

function rowToSettings(row: SettingsRow): Settings {
  return {
    clips: row.clips,
    voice: row.voice,
    music: row.music,
    geminiKey: row.geminiKey ?? undefined,
    config: (row.config ?? DEFAULT_CONFIG) as SettingsConfig,
  };
}

export async function getSettingsRow(): Promise<SettingsRow> {
  const row = await prisma.settings.findUnique({ where: { id: "default" } });
  if (row) return row;
  return prisma.settings.create({
    data: {
      id: "default",
      clips: 3,
      voice: true,
      music: true,
      config: DEFAULT_CONFIG as Prisma.InputJsonValue,
    },
  });
}

export async function getSettings(): Promise<Settings> {
  return rowToSettings(await getSettingsRow());
}

export async function updateSettings(patch: SettingsUpdate): Promise<Settings> {
  const current = await getSettingsRow();
  const geminiKey =
    patch.geminiKey === null || patch.geminiKey === ""
      ? null
      : (patch.geminiKey ?? current.geminiKey);
  const data = {
    clips: patch.clips ?? current.clips,
    voice: patch.voice ?? current.voice,
    music: patch.music ?? current.music,
    geminiKey,
    config: (patch.config ?? (current.config as SettingsConfig)) as Prisma.InputJsonValue,
  };
  const row = await prisma.settings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  return rowToSettings(row);
}
