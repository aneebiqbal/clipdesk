import { Router } from "express";
import { StateResponseSchema } from "@clipdesk/types";
import { asyncHandler, send } from "../lib/http";
import { serializeSettings } from "../lib/serialize";
import { prisma } from "../lib/prisma";
import { getSettingsRow } from "../services/settings.service";

export const stateRouter = Router();

stateRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const active = await prisma.job.findFirst({
      where: { status: { in: ["QUEUED", "PROCESSING"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    send(res, StateResponseSchema, {
      settings: serializeSettings(await getSettingsRow()),
      activeJobId: active?.id ?? null,
    });
  }),
);
