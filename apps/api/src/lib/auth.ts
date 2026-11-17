import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Single-user local tool: there is no auth yet. When accounts are introduced,
 * verify the session/token here and reject with 401; the routers in src/index.ts
 * already mount this middleware, so no route changes are needed.
 */
export const requireAuth: RequestHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};
