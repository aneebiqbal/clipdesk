"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Brief,
  ManualTimestamp,
  Script,
  ScriptCreate,
  ScriptUpdate,
  TopicCreate,
  TopicUpdate,
  TopicWithScripts,
} from "@clipdesk/types";
import { api } from "../lib/api";
import { useToast } from "../components/ui/toast";

function sortTopics(topics: TopicWithScripts[]): TopicWithScripts[] {
  return [...topics].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Owns the Content Brief: topics + scripts (persisted via the API) and the
 * job-scoped manual timestamps. The brief record itself auto-saves, debounced.
 */
export function useBrief() {
  const toast = useToast();
  const [topics, setTopics] = useState<TopicWithScripts[]>([]);
  const [timestamps, setTimestamps] = useState<ManualTimestamp[]>([]);
  const [templates, setTemplates] = useState<Brief[]>([]);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled Brief");
  const [isTemplate, setIsTemplate] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const topicList = await api.topics();
      const withScripts = await Promise.all(
        topicList.map(async (topic) => ({
          ...topic,
          scripts: topic.isBuiltIn ? [] : await api.topicScripts(topic.id),
        })),
      );
      setTopics(sortTopics(withScripts));
      const briefs = await api.briefs();
      setTemplates(briefs.filter((brief) => brief.isTemplate));
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (): Promise<string | null> => {
    const topicIds = topics.map((topic) => topic.id);
    try {
      if (briefId) {
        const updated = await api.updateBrief(briefId, { name, topicIds, isTemplate });
        const briefs = await api.briefs();
        setTemplates(briefs.filter((brief) => brief.isTemplate));
        return updated.id;
      }
      const created = await api.createBrief({ name, topicIds, isTemplate });
      setBriefId(created.id);
      const briefs = await api.briefs();
      setTemplates(briefs.filter((brief) => brief.isTemplate));
      return created.id;
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [topics, name, isTemplate, briefId, toast]);

  // Auto-save the brief selection, debounced by 1s.
  useEffect(() => {
    if (loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loading, persist]);

  const addTopic = useCallback(
    async (input: TopicCreate) => {
      const previous = topics;
      const tempId = `temp-${Date.now()}`;
      setTopics((prev) => [
        ...prev,
        {
          ...input,
          id: tempId,
          isBuiltIn: false,
          sortOrder: prev.length,
          scripts: [],
          createdAt: "",
          updatedAt: "",
        },
      ]);
      try {
        const created = await api.createTopic(input);
        setTopics((prev) => prev.map((topic) => (topic.id === tempId ? { ...created, scripts: [] } : topic)));
      } catch (err) {
        setTopics(previous);
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [topics, toast],
  );

  const updateTopic = useCallback(
    async (id: string, patch: TopicUpdate) => {
      const previous = topics;
      setTopics((prev) => prev.map((topic) => (topic.id === id ? { ...topic, ...patch } : topic)));
      try {
        const updated = await api.updateTopic(id, patch);
        setTopics((prev) => prev.map((topic) => (topic.id === id ? { ...topic, ...updated } : topic)));
      } catch (err) {
        setTopics(previous);
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [topics, toast],
  );

  const removeTopic = useCallback(
    async (id: string) => {
      const previous = topics;
      setTopics((prev) => prev.filter((topic) => topic.id !== id));
      try {
        await api.deleteTopic(id);
      } catch (err) {
        setTopics(previous);
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [topics, toast],
  );

  const reorderTopics = useCallback(
    async (ids: string[]) => {
      const previous = topics;
      const order = new Map(ids.map((id, index) => [id, index]));
      setTopics((prev) => [...prev].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
      try {
        await api.reorderTopics(ids.map((id, index) => ({ id, sortOrder: index })));
      } catch (err) {
        setTopics(previous);
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [topics, toast],
  );

  const addScript = useCallback(
    async (topicId: string, input: ScriptCreate) => {
      const tempId = `temp-${Date.now()}`;
      setTopics((prev) =>
        prev.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                scripts: [
                  ...topic.scripts,
                  {
                    id: tempId,
                    topicId,
                    title: input.title ?? null,
                    description: input.description,
                    keywords: input.keywords,
                    templateType: input.templateType ?? null,
                    sortOrder: topic.scripts.length,
                    createdAt: "",
                  },
                ],
              }
            : topic,
        ),
      );
      try {
        const created = await api.createScript(topicId, input);
        setTopics((prev) =>
          prev.map((topic) =>
            topic.id === topicId
              ? { ...topic, scripts: topic.scripts.map((script) => (script.id === tempId ? created : script)) }
              : topic,
          ),
        );
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
        await load();
      }
    },
    [toast, load],
  );

  const updateScript = useCallback(
    async (id: string, patch: ScriptUpdate) => {
      try {
        const updated = await api.updateScript(id, patch);
        setTopics((prev) =>
          prev.map((topic) => ({
            ...topic,
            scripts: topic.scripts.map((script) => (script.id === id ? updated : script)),
          })),
        );
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [toast],
  );

  const removeScript = useCallback(
    async (id: string) => {
      try {
        await api.deleteScript(id);
        setTopics((prev) =>
          prev.map((topic) => ({
            ...topic,
            scripts: topic.scripts.filter((script) => script.id !== id),
          })),
        );
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [toast],
  );

  const reorderScripts = useCallback(
    async (topicId: string, ids: string[]) => {
      const order = new Map(ids.map((id, index) => [id, index]));
      setTopics((prev) =>
        prev.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                scripts: [...topic.scripts].sort(
                  (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
                ),
              }
            : topic,
        ),
      );
      try {
        await api.reorderScripts(ids.map((id, index) => ({ id, sortOrder: index })));
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [toast],
  );

  const addTimestamp = useCallback((timestamp: ManualTimestamp) => {
    setTimestamps((prev) => [...prev, timestamp]);
  }, []);

  const removeTimestamp = useCallback((index: number) => {
    setTimestamps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const loadTemplate = useCallback(
    async (id: string) => {
      try {
        const detail = await api.brief(id);
        setBriefId(detail.id);
        setName(detail.name);
        setIsTemplate(detail.isTemplate);
        setTopics(sortTopics(detail.topics.map((topic) => ({ ...topic }))));
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [toast],
  );

  const duplicateTemplate = useCallback(
    async (id: string) => {
      try {
        const copy = await api.duplicateBrief(id);
        await loadTemplate(copy.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      }
    },
    [loadTemplate, toast],
  );

  const saveAsTemplate = useCallback(() => {
    setIsTemplate(true);
    toast("Saved as template.");
  }, [toast]);

  return {
    topics,
    timestamps,
    templates,
    briefId,
    name,
    isTemplate,
    loading,
    setName,
    setIsTemplate,
    setTimestamps,
    addTopic,
    updateTopic,
    removeTopic,
    reorderTopics,
    addScript,
    updateScript,
    removeScript,
    reorderScripts,
    addTimestamp,
    removeTimestamp,
    loadTemplate,
    duplicateTemplate,
    saveAsTemplate,
    saveNow: persist,
    reload: load,
  };
}
