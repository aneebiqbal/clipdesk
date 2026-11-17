"use client";

import { useEffect, useState } from "react";
import type { SettingsForm } from "../hooks/use-settings";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";

export function SettingsPanel({
  value,
  onPatch,
}: {
  value: SettingsForm;
  onPatch: (patch: Partial<SettingsForm>) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [gameName, setGameName] = useState(value.gameName);

  useEffect(() => {
    setGameName(value.gameName);
  }, [value.gameName]);

  return (
    <div className="space-y-7 pt-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Number of clips</span>
          <span className="font-display text-2xl font-extrabold tabular-nums">{value.clips}</span>
        </div>
        <Slider
          min={1}
          max={10}
          step={1}
          value={[value.clips]}
          onValueChange={([next]) => {
            if (typeof next === "number") onPatch({ clips: next });
          }}
          aria-label="Number of clips"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold" id="voice-label">
          Voice line
        </span>
        <Switch
          checked={value.voice}
          onCheckedChange={(next) => onPatch({ voice: next })}
          aria-labelledby="voice-label"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold" id="music-label">
          Music
        </span>
        <Switch
          checked={value.music}
          onCheckedChange={(next) => onPatch({ music: next })}
          aria-labelledby="music-label"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="gemini-key" className="text-sm font-semibold">
          Gemini API key
        </label>
        <Input
          id="gemini-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          onBlur={() => {
            const next = apiKey.trim();
            if (next) {
              onPatch({ geminiKey: next });
              setApiKey("");
            }
          }}
          placeholder={
            value.geminiKeySet
              ? "Key saved. Paste a new one to replace it"
              : "Paste a key to rank moments with AI"
          }
        />
        <p className="text-xs text-muted">
          Free at aistudio.google.com. Without a key, moments are ranked by loudness and your marker
          phrase, and hooks are generic.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="game-name" className="text-sm font-semibold">
          Game name
        </label>
        <Input
          id="game-name"
          value={gameName}
          onChange={(event) => setGameName(event.target.value)}
          onBlur={() => onPatch({ gameName: gameName.trim() })}
        />
        <p className="text-xs text-muted">Used in titles and hashtags.</p>
      </div>
    </div>
  );
}

export function SettingsDrawer({
  open,
  onClose,
  value,
  onPatch,
}: {
  open: boolean;
  onClose: () => void;
  value: SettingsForm | null;
  onPatch: (patch: Partial<SettingsForm>) => void;
}) {
  return (
    <div
      className={cn("fixed inset-0 z-50", !open && "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-display text-2xl font-extrabold uppercase text-ink">Settings</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close settings">
            ×
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-6 pb-10">
          {value ? <SettingsPanel value={value} onPatch={onPatch} /> : null}
        </div>
      </aside>
    </div>
  );
}
