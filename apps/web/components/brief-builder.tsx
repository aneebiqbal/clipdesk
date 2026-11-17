"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Script, ScriptCreate, ScriptTemplateType, TopicWithScripts } from "@clipdesk/types";
import { SCRIPT_TEMPLATES } from "@clipdesk/types";
import type { useBrief } from "../hooks/use-brief";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScriptForm } from "./script-form";
import { TimestampInput } from "./timestamp-input";

type Brief = ReturnType<typeof useBrief>;

const TEMPLATE_TYPES = Object.keys(SCRIPT_TEMPLATES) as ScriptTemplateType[];

function formatClock(total: number): string {
  const seconds = Math.max(0, Math.round(total));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function SortableTopic({
  topic,
  onRemove,
  disabled,
  children,
}: {
  topic: TopicWithScripts;
  onRemove: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-lg border border-line bg-panel", isDragging && "opacity-70")}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-muted hover:text-ink"
          aria-label="Drag to reorder"
        >
          <span className="drag-handle" aria-hidden="true" />
        </button>
        <span className="truncate font-semibold text-ink">{topic.name}</span>
        <span className="text-xs text-muted">
          {topic.scripts.length} {topic.scripts.length === 1 ? "script" : "scripts"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Delete ${topic.name}`}
          >
            ×
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function SortableScript({
  script,
  onRemove,
  children,
}: {
  script: Script;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: script.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2 rounded-md border border-line bg-frame/40 px-2.5 py-2",
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab rounded p-1 text-muted hover:text-ink"
        aria-label="Drag to reorder script"
      >
        <span className="drag-handle" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded px-1 text-muted hover:text-accentink"
        aria-label="Remove script"
      >
        ×
      </button>
    </div>
  );
}

export function BriefBuilder({
  brief,
  disabled,
  duration,
}: {
  brief: Brief;
  disabled: boolean;
  duration: number | null;
}) {
  const [open, setOpen] = useState(true);
  const [topicDialog, setTopicDialog] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [topicColor, setTopicColor] = useState("#FF3B3B");
  const [scriptForm, setScriptForm] = useState<{
    open: boolean;
    topicId: string;
    initial: Script | null;
    template: ScriptTemplateType | null;
  }>({ open: false, topicId: "", initial: null, template: null });
  const [templateMenu, setTemplateMenu] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const userTopics = brief.topics.filter((topic) => !topic.isBuiltIn);
  const voiceTopic = brief.topics.find((topic) => topic.id === "builtin-voice");
  const timestampTopic = brief.topics.find((topic) => topic.id === "builtin-timestamps");

  const onTopicDrag = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = userTopics.map((topic) => topic.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void brief.reorderTopics(arrayMove(ids, oldIndex, newIndex));
  };

  const onScriptDrag = (topicId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const topic = brief.topics.find((item) => item.id === topicId);
    if (!topic) return;
    const ids = topic.scripts.map((script) => script.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void brief.reorderScripts(topicId, arrayMove(ids, oldIndex, newIndex));
  };

  const createTopic = async () => {
    if (!topicName.trim()) return;
    await brief.addTopic({ name: topicName.trim(), color: topicColor || "#FF3B3B" });
    setTopicName("");
    setTopicColor("#FF3B3B");
    setTopicDialog(false);
  };

  const saveScript = async (input: ScriptCreate) => {
    await brief.addScript(input.topicId, input);
  };

  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="font-display text-xl font-extrabold uppercase text-ink">Content Brief</span>
        </button>
        <div className="relative flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setTopicDialog(true)} disabled={disabled}>
            Add Topic
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTemplateMenu((value) => !value)}
              disabled={disabled}
            >
              Templates
            </Button>
            {templateMenu ? (
              <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-line bg-panel p-1 shadow-xl">
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-white/5"
                  onClick={() => {
                    setTemplateMenu(false);
                    brief.saveAsTemplate();
                  }}
                >
                  Save as Template
                </button>
                {brief.templates.length > 0 ? <div className="my-1 border-t border-line" /> : null}
                {brief.templates.map((template) => (
                  <div key={template.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-white/5"
                      onClick={() => {
                        setTemplateMenu(false);
                        void brief.loadTemplate(template.id);
                      }}
                    >
                      <span className="block truncate">{template.name}</span>
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1.5 text-xs text-muted hover:text-ink"
                      onClick={() => {
                        setTemplateMenu(false);
                        void brief.duplicateTemplate(template.id);
                      }}
                    >
                      Duplicate
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-line px-4 py-4">
          {brief.loading ? (
            <p className="text-sm text-muted">Loading brief…</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onTopicDrag}>
              <SortableContext
                items={userTopics.map((topic) => topic.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {userTopics.map((topic) => (
                    <SortableTopic
                      key={topic.id}
                      topic={topic}
                      disabled={disabled}
                      onRemove={() => void brief.removeTopic(topic.id)}
                    >
                      <div className="space-y-2 border-t border-line px-3 py-3">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => onScriptDrag(topic.id, event)}
                        >
                          <SortableContext
                            items={topic.scripts.map((script) => script.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {topic.scripts.map((script) => (
                                <SortableScript
                                  key={script.id}
                                  script={script}
                                  onRemove={() => void brief.removeScript(script.id)}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-ink">
                                      {script.title || script.description.slice(0, 40)}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                                      {script.description}
                                    </p>
                                    {script.keywords.length > 0 ? (
                                      <p className="mt-1 truncate text-xs text-muted">
                                        <span>Tags:</span> {script.keywords.join(", ")}
                                      </p>
                                    ) : null}
                                    <div className="mt-1.5">
                                      <button
                                        type="button"
                                        className="text-xs font-semibold text-accent hover:underline"
                                        onClick={() =>
                                          setScriptForm({
                                            open: true,
                                            topicId: topic.id,
                                            initial: script,
                                            template: null,
                                          })
                                        }
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                </SortableScript>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setScriptForm({ open: true, topicId: topic.id, initial: null, template: null })
                            }
                            disabled={disabled}
                          >
                            Add Script
                          </Button>
                          <select
                            value=""
                            onChange={(event) => {
                              const value = event.target.value as ScriptTemplateType | "";
                              if (value) {
                                setScriptForm({
                                  open: true,
                                  topicId: topic.id,
                                  initial: null,
                                  template: value,
                                });
                              }
                            }}
                            className="h-9 rounded-md border border-line bg-panel px-2 text-sm text-ink"
                            disabled={disabled}
                            aria-label="Add script from template"
                          >
                            <option value="">From Template</option>
                            {TEMPLATE_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {SCRIPT_TEMPLATES[type].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </SortableTopic>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {userTopics.length === 0 && !brief.loading ? (
            <p className="text-sm text-muted">
              No topics yet. Add one to describe what happened in your stream.
            </p>
          ) : null}

          {voiceTopic ? (
            <div className="rounded-lg border border-line bg-frame/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{voiceTopic.name}</span>
                <span className="ml-auto text-xs text-muted">always active</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Automatically detects energy spikes and excited reactions.
              </p>
            </div>
          ) : null}

          {timestampTopic ? (
            <div className="rounded-lg border border-line bg-frame/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{timestampTopic.name}</span>
                <span className="ml-auto text-xs text-muted">{brief.timestamps.length}</span>
              </div>
              {brief.timestamps.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {brief.timestamps.map((timestamp, index) => (
                    <div
                      key={`${timestamp.startSec}-${index}`}
                      className="flex items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm"
                    >
                      <span className="font-mono text-xs text-ink">
                        {formatClock(timestamp.startSec)} → {formatClock(timestamp.endSec)}
                      </span>
                      {timestamp.label ? (
                        <span className="truncate text-xs text-muted">&quot;{timestamp.label}&quot;</span>
                      ) : null}
                      <button
                        type="button"
                        className="ml-auto rounded px-1 text-muted hover:text-accentink"
                        onClick={() => brief.removeTimestamp(index)}
                        aria-label="Remove timestamp"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-2">
                <TimestampInput duration={duration} onAdd={brief.addTimestamp} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={topicDialog} onOpenChange={setTopicDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={topicName}
              onChange={(event) => setTopicName(event.target.value)}
              placeholder="e.g. Main Story Missions"
              aria-label="Topic name"
            />
            <Input
              value={topicColor}
              onChange={(event) => setTopicColor(event.target.value)}
              placeholder="#FF3B3B"
              aria-label="Topic colour"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTopicDialog(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={() => void createTopic()}
                disabled={!topicName.trim()}
              >
                Add Topic
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScriptForm
        open={scriptForm.open}
        onClose={() => setScriptForm((value) => ({ ...value, open: false }))}
        onSave={(input) => void saveScript(input)}
        topicId={scriptForm.topicId}
        initial={
          scriptForm.initial ??
          (scriptForm.template
            ? {
                id: "",
                topicId: scriptForm.topicId,
                title: null,
                description: "",
                keywords: [],
                templateType: scriptForm.template,
                sortOrder: 0,
                createdAt: "",
              }
            : null)
        }
      />
    </section>
  );
}
