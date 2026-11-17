import { Router } from "express";
import { SettingsResponseSchema, SettingsUpdateSchema } from "@clipdesk/types";
import { asyncHandler, parseBody, send } from "../lib/http";
import { serializeSettings } from "../lib/serialize";
import { getSettingsRow, updateSettings } from "../services/settings.service";

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    send(res, SettingsResponseSchema, serializeSettings(await getSettingsRow()));
  }),
);

settingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(SettingsUpdateSchema, req.body);
    send(res, SettingsResponseSchema, serializeSettings(await updateSettings(body)));
  }),
);
