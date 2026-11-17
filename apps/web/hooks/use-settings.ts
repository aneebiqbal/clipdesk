"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SettingsResponse, SettingsUpdate } from "@clipdesk/types";
import { api } from "../lib/api";
import { useToast } from "../components/ui/toast";

export type SettingsForm = {
  clips: number;
  voice: boolean;
  music: boolean;
  geminiKey: string;
  gameName: string;
  geminiKeySet: boolean;
};

export function fromResponse(response: SettingsResponse): SettingsForm {
  return {
    clips: response.clips,
    voice: response.voice,
    music: response.music,
    geminiKey: "",
    gameName: response.config.gameName ?? "",
    geminiKeySet: response.geminiKeySet,
  };
}

/** Fetch the single-user settings and persist patches. */
export function useSettings() {
  const toast = useToast();
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    api
      .state()
      .then((state) => {
        if (stopped) return;
        setForm(fromResponse(state.settings));
        setActiveJobId(state.activeJobId);
      })
      .catch((err: unknown) => {
        if (!stopped) toast(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [toast]);

  const patch = (next: Partial<SettingsForm>) => {
    setForm((prev) => (prev ? { ...prev, ...next } : prev));
    const update: SettingsUpdate = {};
    if (next.clips !== undefined) update.clips = next.clips;
    if (next.voice !== undefined) update.voice = next.voice;
    if (next.music !== undefined) update.music = next.music;
    if (next.gameName !== undefined) update.config = { gameName: next.gameName };
    if (next.geminiKey !== undefined && next.geminiKey !== "") update.geminiKey = next.geminiKey;
    if (Object.keys(update).length === 0) return;
    api.updateSettings(update).catch((err: unknown) => {
      toast(err instanceof Error ? err.message : String(err));
    });
  };

  return { form, patch, loading, activeJobId };
}
