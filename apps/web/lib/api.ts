import { z } from "zod";
import type {
  Brief,
  BriefCreate,
  BriefDetail,
  BriefUpdate,
  Clip,
  CreateJob,
  CreateJobResponse,
  FeedbackCreate,
  FeedbackStats,
  Job,
  LibraryResponse,
  LibraryRunDetail,
  ProbeResponse,
  Script,
  ScriptCreate,
  ScriptUpdate,
  SettingsResponse,
  SettingsUpdate,
  StateResponse,
  Topic,
  TopicCreate,
  TopicUpdate,
  UpdateClip,
} from "@clipdesk/types";
import {
  BriefDetailSchema,
  BriefResponseSchema,
  BriefSchema,
  ClipSchema,
  CreateJobResponseSchema,
  FeedbackStatsSchema,
  JobSchema,
  LibraryResponseSchema,
  LibraryRunDetailSchema,
  OkResponseSchema,
  ProbeResponseSchema,
  ScriptSchema,
  StateResponseSchema,
  SettingsResponseSchema,
  TopicSchema,
} from "@clipdesk/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8765";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error?: unknown }).error)
        : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(res.status, "Unexpected response from server", parsed.error.issues);
  }
  return parsed.data;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
  state: (): Promise<StateResponse> => request("/api/state", StateResponseSchema),
  getJob: (id: string): Promise<Job> =>
    request(`/api/jobs/${encodeURIComponent(id)}`, JobSchema),
  createJob: (input: CreateJob): Promise<CreateJobResponse> =>
    request("/api/jobs", CreateJobResponseSchema, jsonInit("POST", input)),
  cancelJob: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/jobs/${encodeURIComponent(id)}/cancel`, OkResponseSchema, { method: "POST" }),
  probe: (path: string): Promise<ProbeResponse> =>
    request("/api/probe", ProbeResponseSchema, jsonInit("POST", { path })),
  library: (): Promise<LibraryResponse> => request("/api/library", LibraryResponseSchema),
  libraryRun: (run: string): Promise<LibraryRunDetail> =>
    request(`/api/library/${encodeURIComponent(run)}`, LibraryRunDetailSchema),
  updateClip: (run: string, clip: string, patch: UpdateClip): Promise<Clip> =>
    request(
      `/api/library/${encodeURIComponent(run)}/${encodeURIComponent(clip)}`,
      ClipSchema,
      jsonInit("PATCH", patch),
    ),
  deleteClip: (run: string, clip: string): Promise<{ ok: boolean }> =>
    request(
      `/api/library/${encodeURIComponent(run)}/${encodeURIComponent(clip)}`,
      OkResponseSchema,
      { method: "DELETE" },
    ),
  deleteRun: (run: string): Promise<{ ok: boolean }> =>
    request(`/api/library/${encodeURIComponent(run)}`, OkResponseSchema, { method: "DELETE" }),
  getSettings: (): Promise<SettingsResponse> => request("/api/settings", SettingsResponseSchema),
  updateSettings: (patch: SettingsUpdate): Promise<SettingsResponse> =>
    request("/api/settings", SettingsResponseSchema, jsonInit("PUT", patch)),

  topics: (): Promise<Topic[]> => request("/api/topics", z.array(TopicSchema)),
  createTopic: (input: TopicCreate): Promise<Topic> =>
    request("/api/topics", TopicSchema, jsonInit("POST", input)),
  updateTopic: (id: string, patch: TopicUpdate): Promise<Topic> =>
    request(`/api/topics/${encodeURIComponent(id)}`, TopicSchema, jsonInit("PATCH", patch)),
  deleteTopic: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/topics/${encodeURIComponent(id)}`, OkResponseSchema, { method: "DELETE" }),
  reorderTopics: (items: { id: string; sortOrder: number }[]): Promise<{ ok: boolean }> =>
    request("/api/topics/reorder", OkResponseSchema, jsonInit("POST", { items })),

  topicScripts: (topicId: string): Promise<Script[]> =>
    request(`/api/topics/${encodeURIComponent(topicId)}/scripts`, z.array(ScriptSchema)),
  createScript: (topicId: string, input: ScriptCreate): Promise<Script> =>
    request(
      `/api/topics/${encodeURIComponent(topicId)}/scripts`,
      ScriptSchema,
      jsonInit("POST", input),
    ),
  updateScript: (id: string, patch: ScriptUpdate): Promise<Script> =>
    request(`/api/scripts/${encodeURIComponent(id)}`, ScriptSchema, jsonInit("PATCH", patch)),
  getScript: (id: string): Promise<Script> =>
    request(`/api/scripts/${encodeURIComponent(id)}`, ScriptSchema),
  deleteScript: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/scripts/${encodeURIComponent(id)}`, OkResponseSchema, { method: "DELETE" }),
  reorderScripts: (items: { id: string; sortOrder: number }[]): Promise<{ ok: boolean }> =>
    request("/api/scripts/reorder", OkResponseSchema, jsonInit("POST", { items })),
  scriptTemplates: (): Promise<unknown> => request("/api/scripts/templates", z.unknown()),

  briefs: (): Promise<Brief[]> => request("/api/briefs", BriefResponseSchema),
  brief: (id: string): Promise<BriefDetail> =>
    request(`/api/briefs/${encodeURIComponent(id)}`, BriefDetailSchema),
  createBrief: (input: BriefCreate): Promise<Brief> =>
    request("/api/briefs", BriefSchema, jsonInit("POST", input)),
  updateBrief: (id: string, patch: BriefUpdate): Promise<Brief> =>
    request(`/api/briefs/${encodeURIComponent(id)}`, BriefSchema, jsonInit("PATCH", patch)),
  deleteBrief: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/briefs/${encodeURIComponent(id)}`, OkResponseSchema, { method: "DELETE" }),
  duplicateBrief: (id: string): Promise<Brief> =>
    request(`/api/briefs/${encodeURIComponent(id)}/duplicate`, BriefSchema, { method: "POST" }),

  submitFeedback: (clipId: string, input: FeedbackCreate): Promise<{ ok: boolean }> =>
    request(`/api/clips/${encodeURIComponent(clipId)}/feedback`, OkResponseSchema, jsonInit("POST", input)),
  feedbackStats: (): Promise<FeedbackStats> => request("/api/feedback/stats", FeedbackStatsSchema),
};

export function mediaUrl(rel: string): string {
  return `${BASE}/media/${encodeURI(rel)}`;
}

export function zipUrl(run: string): string {
  return `${BASE}/api/library/${encodeURIComponent(run)}/zip`;
}

/** Upload a file with progress, streaming the body to the API. */
export function uploadFile(file: File, onProgress: (pct: number) => void): Promise<ProbeResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/upload`);
    xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Upload failed. Is the API running?"));
    xhr.onload = () => {
      let body: unknown = undefined;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const parsed = ProbeResponseSchema.safeParse(body);
        if (parsed.success) resolve(parsed.data);
        else reject(new ApiError(xhr.status, "Unexpected upload response"));
        return;
      }
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error?: unknown }).error)
          : "Could not read that file.";
      reject(new ApiError(xhr.status, message));
    };
    xhr.send(file);
  });
}
