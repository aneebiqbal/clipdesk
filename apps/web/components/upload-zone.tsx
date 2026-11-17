"use client";

import { useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import type { ProbeResponse } from "@clipdesk/types";
import { long, size } from "../lib/format";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Props = {
  file: ProbeResponse | null;
  uploading: boolean;
  uploadPct: number;
  disabled: boolean;
  onFile: (file: File) => void;
  onPath: (path: string) => void;
  children?: ReactNode;
};

export function UploadZone({ file, uploading, uploadPct, disabled, onFile, onPath, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);
  const [path, setPath] = useState("");

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped && !disabled) onFile(dropped);
  };

  const submitPath = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = path.trim();
    if (value) onPath(value);
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-lg border bg-panel p-5 transition-colors sm:p-6",
        dragging ? "border-accent" : "border-line",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-display text-3xl font-extrabold uppercase leading-none text-ink">
            {file ? file.name : "Drop your stream here"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {file
              ? `${long(file.duration)}, ${size(file.size)}`
              : "MP4, MKV or WebM. Long files are fine."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
          >
            {file ? "Choose another" : "Choose a file"}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => setPathOpen((open) => !open)}
            disabled={disabled || uploading}
          >
            Use a file path
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mkv,.webm,.mov,.m4v,.avi"
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onFile(selected);
          event.target.value = "";
        }}
      />

      {pathOpen ? (
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitPath}>
          <label htmlFor="path-input" className="sr-only">
            Path to a video file on this computer
          </label>
          <Input
            id="path-input"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="C:\Users\you\Videos\stream.mp4"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" variant="accent">
            Load file
          </Button>
        </form>
      ) : null}

      {children}

      {uploading ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div className="h-full bg-accent transition-all" style={{ width: `${uploadPct}%` }} />
        </div>
      ) : null}
    </section>
  );
}
