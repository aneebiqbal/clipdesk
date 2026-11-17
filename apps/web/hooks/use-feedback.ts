"use client";

import { useCallback, useState } from "react";
import type { Clip, FeedbackCreate } from "@clipdesk/types";
import { api } from "../lib/api";
import { useToast } from "../components/ui/toast";

export function useFeedback() {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const submit = useCallback(
    async (clip: Clip, input: FeedbackCreate, onDone?: () => void) => {
      setPending(clip.id);
      try {
        await api.submitFeedback(clip.id, input);
        toast(`Marked as ${input.action}.`);
        onDone?.();
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(null);
      }
    },
    [toast],
  );

  return { submit, pending };
}
