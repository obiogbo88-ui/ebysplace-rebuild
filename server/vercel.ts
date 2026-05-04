// @ts-nocheck
import "dotenv/config";
import express, { type Application } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStripeWebhook } from "./stripeWebhook";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { serveStatic } from "./static";
import { apiJsonErrorHandler, registerApiJsonNotFound } from "./apiErrorHandling";

const app: Application = express();

registerStripeWebhook(app);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path, type }) {
      console.error("[tRPC] Vercel API request failed", { path, type, message: error.message, stack: error.stack });
    },
  })
);

registerApiJsonNotFound(app);
serveStatic(app);
app.use(apiJsonErrorHandler);

export default app;
