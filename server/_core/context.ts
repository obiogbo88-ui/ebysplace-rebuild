import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import { authenticateSupabaseRequest } from "../supabaseAuth";

export type TrpcContext = {
  req: Request;
  res: Response;
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const req = opts.req as Request;
  const res = opts.res as Response;
  let user: User | null = null;

  try {
    user = (await authenticateSupabaseRequest(req)) as User | null;
  } catch {
    user = null;
  }

  return { req, res, user };
}
