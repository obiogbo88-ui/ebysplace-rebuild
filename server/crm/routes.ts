import type { Application, Request, Response } from "express";
import { verifyUnsubscribe } from "./automations";
import { setClientPref } from "./store";

function page(title: string, body: string) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Eby's Place</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#F6F5F2;color:#1A1A1A;font:16px/1.6 Georgia,serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
main{max-width:460px;background:#fff;border:1px solid #E6E1D8;border-radius:16px;padding:32px}h1{font-size:24px;margin:0 0 12px}a{color:#8A641E}</style></head>
<body><main><h1>${title}</h1>${body}</main></body></html>`;
}

/**
 * One-click unsubscribe for the CRM's client emails (rebook reminder,
 * we-miss-you). The link is signed, so nobody can switch off someone else.
 * Appointment reminders and receipts still go out: those are about a booking
 * the client made, not marketing.
 */
export function registerCrmRoutes(app: Application) {
  const handle = async (req: Request, res: Response) => {
    const key = verifyUnsubscribe(String(req.query.c ?? ""), String(req.query.s ?? ""));
    res.setHeader("Cache-Control", "no-store");
    if (!key) {
      res.status(400).type("html").send(page("That link didn't work", `<p>Please reply to any of our emails with "Unsubscribe" and we'll take you off the list by hand.</p><p><a href="https://www.ebysplace.com">Back to Eby's Place</a></p>`));
      return;
    }
    try {
      await setClientPref(key, "marketing", false);
    } catch (err) {
      console.error("[CRM] Unsubscribe failed", err);
      res.status(500).type("html").send(page("Something went wrong", `<p>We couldn't save that just now. Please reply to our email with "Unsubscribe" and we'll do it straight away.</p>`));
      return;
    }
    res.type("html").send(page("You're unsubscribed", `<p>You won't get rebook reminders or other offers from Eby's Place any more. You'll still get messages about any appointment you book.</p><p><a href="https://www.ebysplace.com">Back to Eby's Place</a></p>`));
  };
  app.get("/api/crm/unsubscribe", handle);
  app.post("/api/crm/unsubscribe", handle); // List-Unsubscribe-Post one-click
}
