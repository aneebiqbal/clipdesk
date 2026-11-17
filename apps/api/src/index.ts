import express from "express";
import cors from "cors";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { errorHandler, notFound } from "./lib/http";
import { requireAuth } from "./lib/auth";
import { healthRouter } from "./routes/health";
import { uploadRouter } from "./routes/upload";
import { probeRouter } from "./routes/probe";
import { jobsRouter } from "./routes/jobs";
import { libraryRouter } from "./routes/library";
import { settingsRouter } from "./routes/settings";
import { stateRouter } from "./routes/state";
import { mediaRouter } from "./routes/media";
import { topicsRouter } from "./routes/topics";
import { scriptsRouter } from "./routes/scripts";
import { briefsRouter } from "./routes/briefs";
import { feedbackRouter } from "./routes/feedback";
import { redisConnection, videoQueue, videoWorker } from "./jobs/process-video.job";

const app = express();
app.use(cors({ origin: config.WEB_ORIGIN, credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.disable("x-powered-by");

app.use("/api/health", healthRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/probe", probeRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/library", libraryRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/state", stateRouter);
app.use("/api/topics", topicsRouter);
app.use("/api", scriptsRouter);
app.use("/api/briefs", briefsRouter);
app.use("/api", feedbackRouter);
app.use("/media", mediaRouter);
app.use("/api", requireAuth);
app.use("/api", notFound);
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "ClipDesk API listening");
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try {
    await videoWorker.close();
  } catch (err) {
    logger.warn({ err }, "worker close failed");
  }
  try {
    await videoQueue.close();
  } catch (err) {
    logger.warn({ err }, "queue close failed");
  }
  try {
    await redisConnection.quit();
  } catch (err) {
    logger.warn({ err }, "redis close failed");
  }
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
