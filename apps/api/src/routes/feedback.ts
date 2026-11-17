import { z } from "zod";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { FeedbackCreateSchema, FeedbackStatsSchema } from "@clipdesk/types";
import { HttpError, asyncHandler, parseBody, send } from "../lib/http";
import { prisma } from "../lib/prisma";

export const feedbackRouter = Router();

feedbackRouter.post(
  "/clips/:clipId/feedback",
  asyncHandler(async (req, res) => {
    const clipId = req.params.clipId;
    if (!clipId) throw new HttpError(404, "Unknown clip.");
    const body = parseBody(FeedbackCreateSchema, req.body);
    const clip = await prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new HttpError(404, "Unknown clip.");
    await prisma.clipFeedback.create({
      data: {
        clipId,
        action: body.action,
        topicId: body.topicId ?? null,
        metadata: (body.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
    send(res, z.object({ ok: z.boolean() }), { ok: true }, 201);
  }),
);

feedbackRouter.get(
  "/feedback/stats",
  asyncHandler(async (_req, res) => {
    const total = await prisma.clipFeedback.count();
    const actionGroups = await prisma.clipFeedback.groupBy({
      by: ["action"],
      _count: { _all: true },
    });
    const byAction: Record<string, number> = {};
    for (const group of actionGroups) byAction[group.action] = group._count._all;

    const topicGroups = await prisma.clipFeedback.groupBy({
      by: ["topicId", "action"],
      where: { topicId: { not: null } },
      _count: { _all: true },
    });
    const topicIds = [...new Set(topicGroups.map((group) => group.topicId))].filter(
      (id): id is string => id !== null,
    );
    const topics = await prisma.topic.findMany({
      where: { id: { in: topicIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(topics.map((topic) => [topic.id, topic.name]));

    send(
      res,
      FeedbackStatsSchema,
      {
        total,
        byAction,
        byTopic: topicGroups.map((group) => ({
          topicId: group.topicId ?? "",
          topicName: nameById.get(group.topicId ?? "") ?? null,
          action: group.action,
          count: group._count._all,
        })),
      },
    );
  }),
);
