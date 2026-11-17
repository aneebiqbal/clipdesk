"use client";

import { useEffect, useState } from "react";
import type { Script, ScriptCreate, ScriptTemplateType } from "@clipdesk/types";
import { SCRIPT_TEMPLATES } from "@clipdesk/types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const TEMPLATE_TYPES = Object.keys(SCRIPT_TEMPLATES) as ScriptTemplateType[];

function KeywordInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");

  const add = () => {
    const next = value.trim().toLowerCase();
    if (next && !keywords.includes(next) && keywords.length < 20) onChange([...keywords, next]);
    setValue("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add a keyword and press Enter"
          aria-label="Keyword"
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
      {keywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-1 text-xs text-ink"
            >
              {keyword}
              <button
                type="button"
                onClick={() => onChange(keywords.filter((item) => item !== keyword))}
                aria-label={`Remove ${keyword}`}
                className="text-muted hover:text-accentink"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ScriptForm({
  open,
  onClose,
  onSave,
  initial,
  topicId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: ScriptCreate) => void;
  initial: Script | null;
  topicId: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [templateType, setTemplateType] = useState<ScriptTemplateType | "">("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setKeywords(initial?.keywords ?? []);
      setTemplateType((initial?.templateType as ScriptTemplateType | null) ?? "");
    }
  }, [open, initial]);

  const placeholder =
    templateType !== "" ? SCRIPT_TEMPLATES[templateType].placeholder.description : "";

  const submit = () => {
    if (!description.trim()) return;
    onSave({
      topicId,
      title: title.trim() || undefined,
      description: description.trim(),
      keywords,
      templateType: templateType === "" ? undefined : templateType,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Script" : "New Script"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="script-title" className="text-sm font-semibold">
              Title <span className="font-normal text-muted">(optional)</span>
            </label>
            <Input
              id="script-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Leave blank to auto-generate"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="script-template" className="text-sm font-semibold">
              Template type
            </label>
            <select
              id="script-template"
              value={templateType}
              onChange={(event) => setTemplateType(event.target.value as ScriptTemplateType | "")}
              className="flex h-10 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">None</option>
              {TEMPLATE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SCRIPT_TEMPLATES[type].label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="script-description" className="text-sm font-semibold">
              Description
            </label>
            <Textarea
              id="script-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={placeholder || "What happens in this moment?"}
              rows={5}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-semibold">Keywords</span>
            <KeywordInput keywords={keywords} onChange={setKeywords} />
            <p className="text-xs text-muted">
              Transcript anchors — names, places, actions. Plain word matching.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="accent" onClick={submit} disabled={!description.trim()}>
              Save Script
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
