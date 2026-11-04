import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { allows, canSeeMoney, deniedMessage, type AdminRole } from "../../shared/adminRoles";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/** Money fields hidden from roles that can't see money (shared/adminRoles.ts). */
const MONEY_KEYS = new Set(["paidOnline", "averagePayment", "soldThisWeek", "checkoutTotalCharged", "totalCharged", "totalSpent", "revenue", "takings"]);

function zeroed(value: unknown): unknown {
  if (typeof value === "number") return 0;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return "0";
  if (Array.isArray(value)) return value.map(zeroed);
  if (value && typeof value === "object" && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, zeroed(v)]));
  return value;
}

export function redactMoney(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object" || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => redactMoney(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, MONEY_KEYS.has(k) ? zeroed(v) : redactMoney(v, depth + 1)]));
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next, path, type } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    // Command Centre roles: owners can do everything; everyone else is
    // limited to their role. Users signed in before roles existed count as managers.
    const adminRole = ((ctx.user as { adminRole?: AdminRole }).adminRole ?? "manager") as AdminRole;
    if (!allows(adminRole, path, type)) {
      throw new TRPCError({ code: "FORBIDDEN", message: deniedMessage(adminRole, path) });
    }

    const result = await next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
    if (result.ok && !canSeeMoney(adminRole)) {
      return { ...result, data: redactMoney(result.data) };
    }
    return result;
  }),
);
