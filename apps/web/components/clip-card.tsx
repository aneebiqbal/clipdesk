"use client";

import { useRef, useState } from "react";
import type { Clip } from "@clipdesk/types";
import { api, mediaUrl } from "../lib/api";
import { clock } from "../lib/format";
import { cn } from "../lib/utils";
import { useToast } from "./ui/toast";

type Props = {
  clip: Clip;
  seriesTotal?: number;
  onOpen: (clip: Clip) => void;
  onUpdate: (clip: Clip) => void;
  onDelete: (clip: Clip) => void;
  onHover: (start: number | null) => void;
};

export function ClipCard({ clip, seriesTotal, onOpen, onUpdate, onDelete, onHover }: Props) {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirming, setConfirming] = useState(false);

  const saveTitle = async (value: string) => {
    const title = value.trim() || clip.title;
    if (title === clip.title) return;
    const updated = { ...clip, title };
    onUpdate(updated);
    try {
      await api.updateClip(clip.jobId, clip.id, { title });
      toast("Title saved.");
    } catch (err) {
      onUpdate(clip);
      toast(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3500);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    try {
      await api.deleteClip(clip.jobId, clip.id);
      onHover(null);
      onDelete(clip);
      toast("Clip deleted.");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <article
      className="min-w-0"
      onMouseEnter={() => onHover(clip.sourceStart)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        className="relative block aspect-[9/16] w-full overflow-hidden rounded-xl border border-line bg-frame"
        onClick={() => onOpen(clip)}
        aria-label={`Open ${clip.title}`}
      >
        <video
          ref={videoRef}
          src={mediaUrl(clip.filePath)}
          poster={clip.thumbPath ? mediaUrl(clip.thumbPath) : undefined}
          muted
          loop
          playsInline
          preload="none"
          className="h-full w-full object-cover"
          onMouseEnter={() => void videoRef.current?.play().catch(() => undefined)}
          onMouseLeave={() => {
            videoRef.current?.pause();
            if (videoRef.current) videoRef.current.currentTime = 0;
          }}
        />
        {clip.matchScore != null && clip.matchMethod ? (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-accent">
            {Math.round(clip.matchScore * 100)}% {clip.matchMethod}
          </span>
        ) : null}
        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">
          {clock(clip.duration)}
        </span>
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-accent">
          {clip.score.toFixed(1)}
        </span>
      </button>

      <input
        key={`${clip.id}:${clip.title}`}
        defaultValue={clip.title}
        aria-label="Clip title"
        className="mt-3 w-full border-b border-transparent bg-transparent font-semibold text-ink transition-colors hover:border-line focus:border-ink focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={(event) => void saveTitle(event.target.value)}
      />
      {clip.seriesPart ? (
        <p className="mt-0.5 text-xs font-semibold text-accent">
          Part {clip.seriesPart}
          {seriesTotal ? ` of ${seriesTotal}` : ""}
        </p>
      ) : (
        <p className="mt-0.5 text-xs tabular-nums text-muted">
          From {clock(clip.sourceStart)} in the stream
        </p>
      )}
      <div className="mt-2 flex gap-4">
        <a
          href={mediaUrl(clip.filePath)}
          download
          className="text-xs font-semibold text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          Download
        </a>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className={cn(
            "text-xs font-semibold text-muted underline-offset-2 transition-colors hover:underline",
            confirming && "text-accentink hover:text-accentink",
          )}
        >
          {confirming ? "Delete this file?" : "Discard"}
        </button>
      </div>
    </article>
  );
}
