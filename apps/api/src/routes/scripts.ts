import { z } from "zod";
import { Router } from "express";
import {
  OkResponseSchema,
  ReorderSchema,
  SCRIPT_TEMPLATES,
  ScriptCreateSchema,
  ScriptSchema,
  ScriptUpdateSchema,
} from "@clipdesk/types";
import { HttpError, asyncHandler, parseBody, send } from "../lib/http";
import { prisma } from "../lib/prisma";

export const scriptsRouter = Router();

type ScriptRow = {
  id: string;
  topicId: string;
  title: string | null;
  description: string;
  keywords: string[];
  templateType: string | null;
  sortOrder: number;
  createdAt: Date;
};

function serializeScript(script: ScriptRow) {
  return {
    id: script.id,
    topicId: script.topicId,
    title: script.title,
    description: script.description,
    keywords: script.keywords,
    templateType: script.templateType,
    sortOrder: script.sortOrder,
    createdAt: script.createdAt.toISOString(),
  };
}

scriptsRouter.get(
  "/topics/:topicId/scripts",
  asyncHandler(async (req, res) => {
    const topicId = req.params.topicId;
    if (!topicId) throw new HttpError(404, "Unknown topic.");
    const scripts = await prisma.script.findMany({
      where: { topicId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    send(res, z.array(ScriptSchema), scripts.map(serializeScript));
  }),
);

scriptsRouter.post(
  "/topics/:topicId/scripts",
  asyncHandler(async (req, res) => {
    const topicId = req.params.topicId;
    if (!topicId) throw new HttpError(404, "Unknown topic.");
    const body = parseBody(ScriptCreateSchema, { ...req.body, topicId });
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new HttpError(404, "Unknown topic.");
    const max = await prisma.script.aggregate({ where: { topicId }, _max: { sortOrder: true } });
    const script = await prisma.script.create({
      data: {
        topicId,
        title: body.title,
        description: body.description,
        keywords: body.keywords,
        templateType: body.templateType,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    send(res, ScriptSchema, serializeScript(script), 201);
  }),
);

scriptsRouter.get(
  "/scripts/templates",
  asyncHandler(async (_req, res) => {
    send(res, z.unknown(), SCRIPT_TEMPLATES);
  }),
);

scriptsRouter.post(
  "/scripts/reorder",
  asyncHandler(async (req, res) => {
    const body = parseBody(ReorderSchema, req.body);
    await prisma.$transaction(
      body.items.map((item) =>
        prisma.script.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    send(res, OkResponseSchema, { ok: true });
  }),
);

scriptsRouter.get(
  "/scripts/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown script.");
    const script = await prisma.script.findUnique({ where: { id } });
    if (!script) throw new HttpError(404, "Unknown script.");
    send(res, ScriptSchema, serializeScript(script));
  }),
);

scriptsRouter.patch(
  "/scripts/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown script.");
    const body = parseBody(ScriptUpdateSchema, req.body);
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Unknown script.");
    const script = await prisma.script.update({
      where: { id },
      data: {
        title: body.title === undefined ? existing.title : body.title,
        description: body.description ?? existing.description,
        keywords: body.keywords ?? existing.keywords,
        templateType:
          body.templateType === undefined ? existing.templateType : body.templateType,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      },
    });
    send(res, ScriptSchema, serializeScript(script));
  }),
);

scriptsRouter.delete(
  "/scripts/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new HttpError(404, "Unknown script.");
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Unknown script.");
    await prisma.script.delete({ where: { id } });
    send(res, OkResponseSchema, { ok: true });
  }),
);
