import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";

function isApiRequest(req: Request) {
  return req.path === "/api" || req.path.startsWith("/api/");
}

function getStatusCode(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeStatus = (error as { status?: unknown; statusCode?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode;
    if (typeof maybeStatus === "number" && maybeStatus >= 400 && maybeStatus < 600) return maybeStatus;
  }
  return 500;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Internal server error";
}

export function registerApiJsonNotFound(app: { use: (...args: unknown[]) => void }) {
  app.use("/api", (req: Request, res: Response) => {
    console.error("[API] Unmatched API route", { method: req.method, path: req.originalUrl });
    res.status(404).json({
      ok: false,
      error: "API route not found",
      path: req.originalUrl,
    });
  });
}

export const apiJsonErrorHandler: ErrorRequestHandler = (error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (!isApiRequest(req)) return next(error);

  const status = getStatusCode(error);
  const message = getErrorMessage(error);
  console.error("[API] Request failed", {
    method: req.method,
    path: req.originalUrl,
    status,
    message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (res.headersSent) return next(error);
  res.status(status).json({
    ok: false,
    error: message,
  });
};
