import { z } from "zod";

/* ---------- jobs ---------- */

export const JobStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const ProgressSchema = z.object({
  stage: z.number().int().min(1).max(5),
  pct: z.number().min(0).max(100),
  message: z.string(),
  frac: z.number().min(0).max(1).optional(),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const MomentCandidateSchema = z.object({
  start: z.number(),
  end: z.number(),
  score: z.number(),
  kind: z.string(),
  text: z.string().optional(),
  topicId: z.string().optional(),
  scriptId: z.string().optional(),
  matchScore: z.number().optional(),
  matchMethod: z.string().optional(),
  seriesGroup: z.string().optional(),
  seriesPart: z.number().int().optional(),
});
export const SelectedMomentSchema = z.object({
  start: z.number(),
  end: z.number(),
});
export const TopicMatchSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  matchCount: z.number().int(),
});
export const MomentsSchema = z.object({
  candidates: z.array(MomentCandidateSchema),
  selected: z.array(SelectedMomentSchema),
  topics: z.array(TopicMatchSchema).optional(),
});
export type Moments = z.infer<typeof MomentsSchema>;

export const HookVariantSchema = z.object({
  text: z.string(),
  selected: z.boolean(),
});
export type HookVariant = z.infer<typeof HookVariantSchema>;
export const ThumbOptionSchema = z.object({
  timestamp: z.number(),
  path: z.string(),
  selected: z.boolean(),
});
export type ThumbOption = z.infer<typeof ThumbOptionSchema>;

export const ClipSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  filePath: z.string(),
  thumbPath: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  hook: z.string().nullable(),
  outro: z.string().nullable(),
  sourceStart: z.number(),
  sourceEnd: z.number(),
  duration: z.number(),
  score: z.number(),
  musicTrack: z.string().nullable(),
  createdAt: z.string(),
  topicId: z.string().nullable(),
  scriptId: z.string().nullable(),
  matchScore: z.number().nullable(),
  matchMethod: z.string().nullable(),
  seriesGroup: z.string().nullable(),
  seriesPart: z.number().int().nullable(),
  hookVariants: z.array(HookVariantSchema).nullable(),
  thumbOptions: z.array(ThumbOptionSchema).nullable(),
});
export type Clip = z.infer<typeof ClipSchema>;

export const JobSchema = z.object({
  id: z.string(),
  status: JobStatusSchema,
  sourceFile: z.string(),
  sourceName: z.string(),
  duration: z.number().nullable(),
  clipCount: z.number().int(),
  briefId: z.string().nullable(),
  settings: z.record(z.string(), z.unknown()),
  progress: ProgressSchema.nullable(),
  waveform: z.array(z.number()).nullable(),
  moments: MomentsSchema.nullable(),
  clips: z.array(ClipSchema),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof JobSchema>;

/* ---------- python worker events ---------- */

export const WorkerClipMetaSchema = z.object({
  file: z.string(),
  title: z.string(),
  description: z.string(),
  source_start: z.number(),
  source_end: z.number(),
  duration: z.number(),
  score: z.number(),
  music: z.string().nullable(),
  hook: z.string().nullable(),
  outro: z.string().nullable(),
  thumb: z.string().nullable(),
  topic_id: z.string().nullable().optional(),
  script_id: z.string().nullable().optional(),
  match_score: z.number().nullable().optional(),
  match_method: z.string().nullable().optional(),
  series_group: z.string().nullable().optional(),
  series_part: z.number().int().nullable().optional(),
});
export type WorkerClipMeta = z.infer<typeof WorkerClipMetaSchema>;

/* ---------- api requests / responses ---------- */

export const ProbeResponseSchema = z.object({
  path: z.string(),
  name: z.string(),
  size: z.number(),
  duration: z.number(),
});
export type ProbeResponse = z.infer<typeof ProbeResponseSchema>;

export const ManualTimestampSchema = z
  .object({
    startSec: z.number().min(0),
    endSec: z.number().min(0),
    label: z.string().max(200).optional(),
  })
  .refine((d) => d.endSec > d.startSec, { message: "endSec must be after startSec" });
export type ManualTimestamp = z.infer<typeof ManualTimestampSchema>;

export const CreateJobSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  clips: z.number().int().min(1).max(10).optional(),
  voice: z.boolean().optional(),
  music: z.boolean().optional(),
  briefId: z.string().optional(),
  manualTimestamps: z.array(ManualTimestampSchema).max(50).optional(),
});
export type CreateJob = z.infer<typeof CreateJobSchema>;

export const CreateJobResponseSchema = z.object({ id: z.string() });
export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>;

export const SettingsConfigSchema = z
  .object({ gameName: z.string().optional() })
  .passthrough();
export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;

export const SettingsSchema = z.object({
  clips: z.number().int().min(1).max(10),
  voice: z.boolean(),
  music: z.boolean(),
  geminiKey: z.string().optional(),
  config: SettingsConfigSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

export const SettingsResponseSchema = z.object({
  clips: z.number().int(),
  voice: z.boolean(),
  music: z.boolean(),
  geminiKeySet: z.boolean(),
  config: SettingsConfigSchema,
});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

export const SettingsUpdateSchema = z.object({
  clips: z.number().int().min(1).max(10).optional(),
  voice: z.boolean().optional(),
  music: z.boolean().optional(),
  geminiKey: z.string().nullable().optional(),
  config: SettingsConfigSchema.optional(),
});
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

export const StateResponseSchema = z.object({
  settings: SettingsResponseSchema,
  activeJobId: z.string().nullable(),
});
export type StateResponse = z.infer<typeof StateResponseSchema>;

export const LibraryRunSchema = z.object({
  id: z.string(),
  status: JobStatusSchema,
  sourceName: z.string(),
  duration: z.number().nullable(),
  clipCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LibraryRun = z.infer<typeof LibraryRunSchema>;

export const LibraryResponseSchema = z.array(LibraryRunSchema);
export type LibraryResponse = z.infer<typeof LibraryResponseSchema>;

export const LibraryRunDetailSchema = z.object({
  run: z.string(),
  clips: z.array(ClipSchema),
});
export type LibraryRunDetail = z.infer<typeof LibraryRunDetailSchema>;

export const UpdateClipSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    hook: z.string().max(500).nullable().optional(),
    outro: z.string().max(500).nullable().optional(),
    thumbPath: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.hook !== undefined ||
      v.outro !== undefined ||
      v.thumbPath !== undefined,
    { message: "Provide a field to update" },
  );
export type UpdateClip = z.infer<typeof UpdateClipSchema>;

export const OkResponseSchema = z.object({ ok: z.boolean() });

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  uptime: z.number(),
});

/* ---------- topics, scripts, briefs, feedback ---------- */

export const SCRIPT_TEMPLATES = {
  mission: {
    label: "Mission Run",
    fields: ["title", "objective", "outcome"],
    placeholder: {
      description: "Describe the mission: what's the objective, who's involved, what happens",
    },
  },
  funny: {
    label: "Funny Moment",
    fields: ["description"],
    placeholder: {
      description:
        "Describe vaguely what kind of funny thing — NPC glitch, failed stunt, unexpected event",
    },
  },
  pvp: {
    label: "PVP / Combat",
    fields: ["title", "description"],
    placeholder: { description: "Who you fought, what weapons, how it ended" },
  },
  exploration: {
    label: "Exploration / Discovery",
    fields: ["title", "description"],
    placeholder: {
      description: "What you found, where, why it was interesting",
    },
  },
  viewer_interaction: {
    label: "Viewer Interaction",
    fields: ["description"],
    placeholder: {
      description: "Chat dared you, donation event, subscriber moment",
    },
  },
} as const;

export type ScriptTemplateType = keyof typeof SCRIPT_TEMPLATES;

export const TopicCreateSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FF3B3B"),
});
export type TopicCreate = z.infer<typeof TopicCreateSchema>;

export const TopicUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type TopicUpdate = z.infer<typeof TopicUpdateSchema>;

export const ReorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number().int().min(0) })),
});
export type Reorder = z.infer<typeof ReorderSchema>;

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  isBuiltIn: z.boolean(),
  sortOrder: z.number().int(),
  scriptCount: z.number().int().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicWithScriptsSchema = TopicSchema.extend({
  scripts: z.array(z.lazy(() => ScriptSchema)),
});
export type TopicWithScripts = z.infer<typeof TopicWithScriptsSchema>;

export const ScriptCreateSchema = z.object({
  topicId: z.string(),
  title: z.string().max(200).optional(),
  description: z.string().min(1).max(2000),
  keywords: z.array(z.string().max(50)).max(20).default([]),
  templateType: z
    .enum(["mission", "funny", "pvp", "exploration", "viewer_interaction"])
    .optional(),
});
export type ScriptCreate = z.infer<typeof ScriptCreateSchema>;

export const ScriptUpdateSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  description: z.string().min(1).max(2000).optional(),
  keywords: z.array(z.string().max(50)).max(20).optional(),
  templateType: z
    .enum(["mission", "funny", "pvp", "exploration", "viewer_interaction"])
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type ScriptUpdate = z.infer<typeof ScriptUpdateSchema>;

export const ScriptSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  title: z.string().nullable(),
  description: z.string(),
  keywords: z.array(z.string()),
  templateType: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type Script = z.infer<typeof ScriptSchema>;

export const BriefCreateSchema = z.object({
  name: z.string().min(1).max(200),
  topicIds: z.array(z.string()),
  isTemplate: z.boolean().default(false),
});
export type BriefCreate = z.infer<typeof BriefCreateSchema>;

export const BriefUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  topicIds: z.array(z.string()).optional(),
  isTemplate: z.boolean().optional(),
});
export type BriefUpdate = z.infer<typeof BriefUpdateSchema>;

export const BriefSchema = z.object({
  id: z.string(),
  name: z.string(),
  topicIds: z.array(z.string()),
  isTemplate: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  topicCount: z.number().int().optional(),
  scriptCount: z.number().int().optional(),
});
export type Brief = z.infer<typeof BriefSchema>;

export const BriefResponseSchema = z.array(BriefSchema);
export type BriefResponse = z.infer<typeof BriefResponseSchema>;

export const BriefDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  topicIds: z.array(z.string()),
  isTemplate: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  topics: z.array(TopicWithScriptsSchema),
});
export type BriefDetail = z.infer<typeof BriefDetailSchema>;

export const FeedbackCreateSchema = z.object({
  action: z.enum(["kept", "discarded", "edited_title", "favorited"]),
  topicId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type FeedbackCreate = z.infer<typeof FeedbackCreateSchema>;

export const ClipFeedbackSchema = z.object({
  id: z.string(),
  clipId: z.string(),
  action: z.string(),
  topicId: z.string().nullable(),
  metadata: z.unknown().nullable().optional(),
  createdAt: z.string(),
});
export type ClipFeedback = z.infer<typeof ClipFeedbackSchema>;

export const FeedbackStatsSchema = z.object({
  total: z.number().int(),
  byAction: z.record(z.string(), z.number().int()),
  byTopic: z.array(
    z.object({
      topicId: z.string(),
      topicName: z.string().nullable(),
      action: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type FeedbackStats = z.infer<typeof FeedbackStatsSchema>;
