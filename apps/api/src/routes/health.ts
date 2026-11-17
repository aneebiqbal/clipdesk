import { Router } from "express";
import { HealthResponseSchema } from "@clipdesk/types";
import { asyncHandler, send } from "../lib/http";
import { prisma } from "../lib/prisma";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    send(res, HealthResponseSchema, { status: "ok", uptime: process.uptime() });
  }),
);
