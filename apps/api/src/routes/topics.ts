import { z } from "zod";
import { Router } from "express";
import {
  OkResponseSchema,
  ReorderSchema,
  TopicCreateSchema,
  TopicSchema,
  TopicUpdateSchema,
} from "@clipdesk/types";
import { HttpError, asyncHandler, parseBody, send } from "../lib/http";
import { prisma } from "../lib/prisma";

export const topicsRouter = Router();

type TopicRow = {
  id: string;
  name: string;
  color: string;
  isBuiltIn: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function serializeTopic(topic: TopicRow, scriptCount?: number) {
  return {
    id: topic.id,
    name: topic.name,
    color: topic.color,
    isBuiltIn: topic.isBuiltIn,
    sortOrder: topic.sortOrder,
    scriptCount,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}

topicsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const topics = await prisma.topic.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { scripts: true } } },
    });
    send(
      res,
      z.array(TopicSchema),
      topics.map((topic) => serializeTopic(topic, topic._count.scripts)),
    );
  }),
);

topicsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(TopicCreateSchema, req.body);
    const max = await prisma.topic.aggregate({ _max: { sortOrder: true } });
    const topic = await prisma.topic.create({
      data: {
        name: body.name,
        color: body.color,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    send(res, TopicSchema, serializeTopic(topic), 201);
  }),
);

topicsRouter.post(
  "/reorder",
  asyncHandler(async (req, res) => {
    const body = parseBody(ReorderSchema, req.body);
    await prisma.$transaction(
      body.items.map((item) =>
        prisma.topic.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    send(res, OkResponseSchema, { ok: true });
  }),
);

topicsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown topic.");
    const body = parseBody(TopicUpdateSchema, req.body);
    const existing = await prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Unknown topic.");
    const topic = await prisma.topic.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        color: body.color ?? existing.color,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    });
    send(res, TopicSchema, serializeTopic(topic));
  }),
);

topicsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown topic.");
    const existing = await prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Unknown topic.");
    if (existing.isBuiltIn) throw new HttpError(400, "Built-in topics cannot be deleted.");
    await prisma.topic.delete({ where: { id } });
    send(res, OkResponseSchema, { ok: true });
  }),
);
