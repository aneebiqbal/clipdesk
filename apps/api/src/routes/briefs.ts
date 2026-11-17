import { z } from "zod";
import { Router } from "express";
import {
  BriefCreateSchema,
  BriefDetailSchema,
  BriefSchema,
  BriefUpdateSchema,
  OkResponseSchema,
} from "@clipdesk/types";
import { HttpError, asyncHandler, parseBody, send } from "../lib/http";
import { prisma } from "../lib/prisma";

export const briefsRouter = Router();

type TopicWithScriptsRow = {
  id: string;
  name: string;
  color: string;
  isBuiltIn: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  scripts: {
    id: string;
    topicId: string;
    title: string | null;
    description: string;
    keywords: string[];
    templateType: string | null;
    sortOrder: number;
    createdAt: Date;
  }[];
};

function serializeTopic(topic: TopicWithScriptsRow) {
  return {
    id: topic.id,
    name: topic.name,
    color: topic.color,
    isBuiltIn: topic.isBuiltIn,
    sortOrder: topic.sortOrder,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    scripts: topic.scripts.map((script) => ({
      id: script.id,
      topicId: script.topicId,
      title: script.title,
      description: script.description,
      keywords: script.keywords,
      templateType: script.templateType,
      sortOrder: script.sortOrder,
      createdAt: script.createdAt.toISOString(),
    })),
  };
}

function serializeBrief(
  brief: { id: string; name: string; topicIds: string[]; isTemplate: boolean; createdAt: Date; updatedAt: Date },
  topicCount?: number,
  scriptCount?: number,
) {
  return {
    id: brief.id,
    name: brief.name,
    topicIds: brief.topicIds,
    isTemplate: brief.isTemplate,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt.toISOString(),
    topicCount,
    scriptCount,
  };
}

async function loadTopicsForBrief(briefId: string): Promise<TopicWithScriptsRow[]> {
  const brief = await prisma.brief.findUnique({ where: { id: briefId } });
  if (!brief) return [];
  const topics = await prisma.topic.findMany({
    where: { id: { in: brief.topicIds } },
    include: { scripts: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  // Preserve the order stored on the brief.
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  return brief.topicIds.flatMap((id) => {
    const topic = byId.get(id);
    return topic ? [topic] : [];
  });
}

briefsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const briefs = await prisma.brief.findMany({ orderBy: { updatedAt: "desc" } });
    const details = await Promise.all(
      briefs.map(async (brief) => {
        const topics = await loadTopicsForBrief(brief.id);
        return serializeBrief(
          brief,
          topics.length,
          topics.reduce((sum, topic) => sum + topic.scripts.length, 0),
        );
      }),
    );
    send(res, z.array(BriefSchema), details);
  }),
);

briefsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(BriefCreateSchema, req.body);
    const brief = await prisma.brief.create({
      data: { name: body.name, topicIds: body.topicIds, isTemplate: body.isTemplate },
    });
    send(res, BriefSchema, serializeBrief(brief), 201);
  }),
);

briefsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown brief.");
    const brief = await prisma.brief.findUnique({ where: { id } });
    if (!brief) throw new HttpError(404, "Unknown brief.");
    const topics = await loadTopicsForBrief(id);
    send(res, BriefDetailSchema, {
      id: brief.id,
      name: brief.name,
      topicIds: brief.topicIds,
      isTemplate: brief.isTemplate,
      createdAt: brief.createdAt.toISOString(),
      updatedAt: brief.updatedAt.toISOString(),
      topics: topics.map(serializeTopic),
    });
  }),
);

briefsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown brief.");
    const body = parseBody(BriefUpdateSchema, req.body);
    const existing = await prisma.brief.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Unknown brief.");
    const brief = await prisma.brief.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        topicIds: body.topicIds ?? existing.topicIds,
        isTemplate: body.isTemplate ?? existing.isTemplate,
      },
    });
    send(res, BriefSchema, serializeBrief(brief));
  }),
);

briefsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown brief.");
    const existing = await prisma.brief.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Unknown brief.");
    await prisma.brief.delete({ where: { id } });
    send(res, OkResponseSchema, { ok: true });
  }),
);

briefsRouter.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown brief.");
    const existing = await prisma.brief.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Unknown brief.");
    const topics = await loadTopicsForBrief(id);

    const newTopicIds: string[] = [];
    for (const topic of topics) {
      if (topic.isBuiltIn) {
        newTopicIds.push(topic.id);
        continue;
      }
      const created = await prisma.topic.create({
        data: {
          name: topic.name,
          color: topic.color,
          isBuiltIn: false,
          sortOrder: topic.sortOrder,
          scripts: {
            create: topic.scripts.map((script) => ({
              title: script.title,
              description: script.description,
              keywords: script.keywords,
              templateType: script.templateType,
              sortOrder: script.sortOrder,
            })),
          },
        },
      });
      newTopicIds.push(created.id);
    }

    const copy = await prisma.brief.create({
      data: {
        name: `${existing.name} (Copy)`,
        topicIds: newTopicIds,
        isTemplate: existing.isTemplate,
      },
    });
    send(res, BriefSchema, serializeBrief(copy), 201);
  }),
);
