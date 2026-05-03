import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { registerStripeWebhook } from "./stripeWebhook";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { serveStatic } from "./_core/vite";

const app = express();

registerStripeWebhook(app);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
registerStorageProxy(app);
registerOAuthRoutes(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

serveStatic(app);

export default app;
