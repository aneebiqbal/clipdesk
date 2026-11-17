"use client";

import { useSettings } from "../hooks/use-settings";
import { SettingsPanel } from "./settings-panel";

export function SettingsClient() {
  const { form, patch, loading } = useSettings();

  return (
    <div className="mx-auto max-w-xl pt-4">
      <h1 className="font-display text-4xl font-black uppercase leading-none text-ink">Settings</h1>
      <p className="mt-2 text-sm text-muted">Saved to the Clipdesk database.</p>
      <div className="mt-8 rounded-xl border border-line bg-panel p-6">
        {loading || !form ? <p className="text-muted">Loading…</p> : <SettingsPanel value={form} onPatch={patch} />}
      </div>
    </div>
  );
}
