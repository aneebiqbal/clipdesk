import fs from "node:fs";
import { Router } from "express";
import { HttpError, asyncHandler } from "../lib/http";
import { storage } from "../services/storage.service";

export const mediaRouter = Router();

// Serves rendered clips and thumbnails from the output storage root.
mediaRouter.get(
  "/*",
  asyncHandler(async (req, res) => {
    const rel = req.params[0];
    if (!rel) throw new HttpError(404, "Not found.");
    let abs: string;
    try {
      abs = storage.resolve(rel);
    } catch {
      throw new HttpError(400, "Bad path.");
    }
    if (!fs.existsSync(abs)) throw new HttpError(404, "Not found.");
    res.sendFile(abs, { acceptRanges: true }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "Not found" });
      }
    });
  }),
);
