"use client";

import { useEffect, useMemo, useState } from "react";
import type { Clip, Moments, Script } from "@clipdesk/types";
import { api, mediaUrl } from "../lib/api";
import { clock } from "../lib/format";
import { useFeedback } from "../hooks/use-feedback";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { useToast } from "./ui/toast";

type Props = {
  clip: Clip | null;
  moments?: Moments | null;
  seriesClips?: Clip[];
  onClose: () => void;
  onUpdate: (clip: Clip) => void;
  onDelete: (clip: Clip) => void;
  onNavigate?: (clip: Clip) => void;
};

function HighlightedText({ text, keywords }: { text: string; keywords: string[] }) {
  if (!text) return null;
  const pattern = keywords.filter(Boolean).map((keyword) => keyword.toLowerCase());
  if (pattern.length === 0) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${pattern.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi"));
  return (
    <span>
      {parts.map((part, index) =>
        pattern.includes(part.toLowerCase()) ? (
          <span key={index} className="font-semibold text-cyan-300">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}

export function ClipModal({
  clip,
  moments,
  seriesClips = [],
  onClose,
  onUpdate,
  onDelete,
  onNavigate,
}: Props) {
  const toast = useToast();
  const feedback = useFeedback();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState<Script | null>(null);

  useEffect(() => {
    if (clip) {
      setTitle(clip.title);
      setDescription(clip.description);
    }
  }, [clip]);

  useEffect(() => {
    let active = true;
    setScript(null);
    if (clip?.scriptId) {
      api
        .getScript(clip.scriptId)
        .then((loaded) => {
          if (active) setScript(loaded);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [clip?.scriptId]);

  const excerpt = useMemo(() => {
    if (!clip || !moments) return null;
    const overlapping = moments.candidates
      .filter((candidate) => candidate.end > clip.sourceStart && candidate.start < clip.sourceEnd)
      .sort((a, b) => b.score - a.score);
    return overlapping[0]?.text ?? null;
  }, [clip, moments]);

  const series = useMemo(() => {
    if (!clip?.seriesGroup) return [];
    return [...seriesClips]
      .filter((item) => item.seriesGroup === clip.seriesGroup)
      .sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0));
  }, [clip, seriesClips]);

  const save = async (field: "title" | "description", value: string) => {
    if (!clip) return;
    if (clip[field] === value) return;
    const previous = clip;
    const next = { ...clip, [field]: value };
    onUpdate(next);
    try {
      await api.updateClip(clip.jobId, clip.id, { [field]: value });
      toast("Saved.");
    } catch (err) {
      onUpdate(previous);
      toast(err instanceof Error ? err.message : String(err));
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied.`);
    } catch {
      toast("Could not copy. Select the text and press Ctrl+C.");
    }
  };

  const remove = async () => {
    if (!clip) return;
    try {
      await api.deleteClip(clip.jobId, clip.id);
      onDelete(clip);
      onClose();
      toast("Clip deleted.");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  };

  const applyHook = async (text: string) => {
    if (!clip) return;
    try {
      await api.updateClip(clip.jobId, clip.id, { hook: text });
      onUpdate({
        ...clip,
        hook: text,
        hookVariants: clip.hookVariants?.map((variant) => ({
          ...variant,
          selected: variant.text === text,
        })) ?? null,
      });
      toast("Hook updated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  };

  const applyThumb = async (option: { timestamp: number; path: string; selected: boolean }) => {
    if (!clip) return;
    try {
      await api.updateClip(clip.jobId, clip.id, { thumbPath: option.path });
      onUpdate({
        ...clip,
        thumbPath: option.path,
        thumbOptions: clip.thumbOptions?.map((item) => ({
          ...item,
          selected: item.path === option.path,
        })) ?? null,
      });
      toast("Thumbnail updated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  };

  const seriesIndex = clip ? series.findIndex((item) => item.id === clip.id) : -1;
  const prev = seriesIndex > 0 ? series[seriesIndex - 1] : null;
  const next = seriesIndex >= 0 && seriesIndex < series.length - 1 ? series[seriesIndex + 1] : null;

  return (
    <Dialog
      open={clip !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-4xl">
        {clip ? (
          <div className="grid max-h-[80vh] gap-6 overflow-auto pr-1 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="space-y-2">
              <video
                key={clip.id}
                src={mediaUrl(clip.filePath)}
                controls
                playsInline
                autoPlay
                className="aspect-[9/16] h-[52vh] rounded-lg bg-frame sm:h-[68vh]"
              />
              {clip.seriesPart ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
                  <button
                    type="button"
                    disabled={!prev}
                    onClick={() => prev && onNavigate?.(prev)}
                    className="text-xs font-semibold text-muted disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-xs font-semibold text-accent">
                    Part {clip.seriesPart} of {series.length}
                  </span>
                  <button
                    type="button"
                    disabled={!next}
                    onClick={() => next && onNavigate?.(next)}
                    className="text-xs font-semibold text-muted disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}
              {clip.matchMethod ? (
                <p className="text-xs text-muted">
                  {clip.matchMethod}
                  {clip.matchScore != null ? ` · ${Math.round(clip.matchScore * 100)}% match` : ""}
                </p>
              ) : null}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="clip-title" className="text-sm font-semibold">
                  Title
                </label>
                <Input
                  id="clip-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => void save("title", title.trim())}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="clip-description" className="text-sm font-semibold">
                  Description
                </label>
                <Textarea
                  id="clip-description"
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  onBlur={() => void save("description", description)}
                />
              </div>

              {script ? (
                <div className="space-y-1.5 rounded-md border border-line bg-frame/40 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Matched script
                  </span>
                  <p className="text-sm font-semibold text-ink">{script.title || "Untitled"}</p>
                  <p className="text-xs text-muted">{script.description}</p>
                  {excerpt ? (
                    <p className="text-xs leading-relaxed text-ink">
                      <HighlightedText text={excerpt} keywords={script.keywords} />
                    </p>
                  ) : null}
                </div>
              ) : null}

              {clip.hook || clip.hookVariants?.length ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Hook variants
                  </span>
                  <div className="grid gap-2">
                    {(clip.hookVariants?.length ? clip.hookVariants : [{ text: clip.hook ?? "", selected: true }]).map(
                      (variant) => (
                        <button
                          key={variant.text}
                          type="button"
                          onClick={() => void applyHook(variant.text)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            variant.selected
                              ? "border-accent bg-accent/10 text-ink"
                              : "border-line bg-panel text-muted hover:text-ink",
                          )}
                        >
                          <span className="mr-2 text-xs font-semibold text-accent">
                            {variant.selected ? "Selected" : "Use"}
                          </span>
                          {variant.text}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              {clip.thumbOptions?.length ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Thumbnail options
                  </span>
                  <div className="flex gap-2">
                    {clip.thumbOptions.map((option) => (
                      <button
                        key={option.path}
                        type="button"
                        onClick={() => void applyThumb(option)}
                        className={cn(
                          "relative overflow-hidden rounded-md border-2",
                          option.selected ? "border-accent" : "border-transparent",
                        )}
                        title={`Use frame at ${option.timestamp.toFixed(1)}s`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl(option.path)} alt="" className="h-24 w-14 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {clip.hook ? (
                <p className="text-xs text-muted">
                  Hook: <span className="text-ink">{clip.hook}</span>
                </p>
              ) : null}
              {clip.outro ? (
                <p className="text-xs text-muted">
                  Outro: <span className="text-ink">{clip.outro}</span>
                </p>
              ) : null}
              <p className="text-xs tabular-nums text-muted">
                From {clock(clip.sourceStart)} to {clock(clip.sourceEnd)} in the stream
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copy(title, "Title")}>
                  Copy title
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(description, "Description")}
                >
                  Copy description
                </Button>
                <a
                  href={mediaUrl(clip.filePath)}
                  download
                  className="inline-flex h-9 items-center rounded-md border border-accent bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-accentink"
                >
                  Download
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={feedback.pending === clip.id}
                  onClick={() => void feedback.submit(clip, { action: "kept" })}
                >
                  Keep
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={feedback.pending === clip.id}
                  onClick={() => void feedback.submit(clip, { action: "favorited" })}
                >
                  Favorite
                </Button>
                <Button
                  type="button"
                  variant="stop"
                  size="sm"
                  disabled={feedback.pending === clip.id}
                  onClick={() => void remove()}
                >
                  Discard
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
