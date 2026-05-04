// @ts-nocheck
import "dotenv/config";
import express, { type Application } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStripeWebhook } from "./stripeWebhook";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { serveStatic } from "./_core/vite";

const app: Application = express();

registerStripeWebhook(app);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

serveStatic(app);

export default app;
