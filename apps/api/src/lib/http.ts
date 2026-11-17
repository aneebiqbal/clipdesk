import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, z, type ZodType } from "zod";
import { logger } from "./logger";

export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

/** Parse a request body with a Zod schema, throwing a ZodError on failure. */
export function parseBody<S extends ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw result.error;
  return result.data;
}

/** Validate a response against its schema before sending it. */
export function send<S extends ZodType>(res: Response, schema: S, data: unknown, status = 200): void {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues }, "response validation failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  res.status(status).json(parsed.data);
}

/** Wrap async route handlers so rejections reach the Express error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}
