import type { Application, Request, Response } from "express";
import { z } from "zod";
import * as db from "./db";

const ACTIVITY_COLLECTOR_PATH = "/api/activity/external";
const MAX_REQUESTS_PER_MINUTE = 120;
const WINDOW_MS = 60_000;
const requestWindowByIp = new Map<string, { count: number; resetAt: number }>();

const externalActivitySchema = z.object({
  sessionId: z.string().max(128).optional(),
  userName: z.string().max(180).optional(),
  userEmail: z.string().email().max(320).optional(),
  activityType: z.string().min(2).max(120),
  activityCategory: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  pageUrl: z.string().max(800).optional(),
  metadata: z.unknown().optional(),
  status: z.enum(["success", "failed", "pending", "info"]).default("info"),
  relatedEntityType: z.string().max(80).optional(),
  relatedEntityId: z.union([z.string(), z.number()]).optional(),
  sourceApp: z.string().max(80).default("kouviabooking"),
}).strict();

function rateLimited(req: Request) {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const current = requestWindowByIp.get(ip);
  if (!current || current.resetAt < now) {
    requestWindowByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_MINUTE;
}

export function registerActivityCollector(app: Application) {
  app.post(ACTIVITY_COLLECTOR_PATH, async (req: Request, res: Response) => {
    const expectedKey = String(process.env.ACTIVITY_COLLECTOR_KEY || "").trim();
    const providedKey = String(req.headers["x-activity-collector-key"] || "").trim();
    if (!expectedKey || providedKey !== expectedKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (rateLimited(req)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }
    const parsed = externalActivitySchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean) });
      return;
    }
    try {
      await db.logActivity({
        request: req,
        ...parsed.data,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[ActivityCollector] Failed to store external activity", error);
      res.status(500).json({ error: "Failed to store activity" });
    }
  });
}

