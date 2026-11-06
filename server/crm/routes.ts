import type { Application, Request, Response } from "express";
import { verifyUnsubscribe } from "./automations";
import { joinListAgain, leaveList } from "../list";

function page(title: string, body: string) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Eby's Place</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#F6F5F2;color:#1A1A1A;font:16px/1.6 Georgia,serif;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
main{max-width:460px;background:#fff;border:1px solid #E6E1D8;border-radius:16px;padding:32px}h1{font-size:24px;margin:0 0 12px}a{color:#8A641E}</style></head>
<body><main><h1>${title}</h1>${body}</main></body></html>`;
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const HOME = `<a href="https://www.ebysplace.com">Go to Eby's Place</a>`;
const BAD_LINK = page("That link didn't work", `<p>It may have been copied only partly. Reply to any Eby's Place email or message us on WhatsApp at 07864 585110 and we'll take you off.</p><p>${HOME}</p>`);
const BUTTON = "display:inline-block;margin:6px 8px 0 0;padding:11px 20px;border-radius:99px;border:1px solid #8A641E;font:bold 15px Arial,sans-serif;cursor:pointer";

function signed(req: Request) {
  const c = String(req.query.c ?? "");
  const s = String(req.query.s ?? "");
  return { key: verifyUnsubscribe(c, s), qs: `c=${encodeURIComponent(c)}&s=${encodeURIComponent(s)}` };
}

/**
 * "Leave the list" for every list email (announcements, newsletter, the CRM's
 * rebook and we-miss-you emails, the booking confirmation). The link is
 * signed, so nobody can take someone else off.
 *
 * Opening the link (GET) leaves straight away in a browser, through a tiny
 * script that POSTs, because link scanners like Outlook Safe Links open
 * every link in an email and would otherwise take people off by accident.
 * Mail apps' own Unsubscribe button POSTs directly (RFC 8058).
 * Booking emails (confirmations, reminders, rebooking) still go out.
 */
export function registerCrmRoutes(app: Application) {
  app.get("/api/crm/unsubscribe", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const { key, qs } = signed(req);
    if (!key) {
      res.status(400).type("html").send(BAD_LINK);
      return;
    }
    res.type("html").send(page("Leaving the list…", `<form id="leave" method="post" action="/api/crm/unsubscribe?${esc(qs)}"><p>Taking you off the Eby's Place list.</p>
<noscript><button type="submit" style="${BUTTON};background:#111;color:#F1D98C">Leave the list</button></noscript></form>
<script>document.getElementById("leave").submit()</script>`));
  });

  app.post("/api/crm/unsubscribe", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const { key, qs } = signed(req);
    if (!key) {
      res.status(400).type("html").send(BAD_LINK);
      return;
    }
    try {
      await leaveList(key);
    } catch (err) {
      console.error("[List] Leave failed", err);
      res.status(500).type("html").send(page("Something went wrong", `<p>We couldn't save that just now. Please try the link again, or reply to any of our emails and we'll take you off straight away.</p>`));
      return;
    }
    res.type("html").send(page("You've left the list", `<p>You won't get any more offers or news from Eby's Place. We'll still email you about bookings you make, like confirmations and reminders.</p>
<form method="post" action="/api/crm/rejoin?${esc(qs)}"><button type="submit" style="${BUTTON};background:#fff;color:#4A3014">Changed your mind? Join again</button></form><p>${HOME}</p>`));
  });

  // "Join the list" in the past-customer invite: one tap, same scanner-safe pattern as leaving.
  app.get("/api/crm/join", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const { key, qs } = signed(req);
    if (!key) {
      res.status(400).type("html").send(page("That link didn't work", `<p>It may have been copied only partly. You can join any time at <a href="https://www.ebysplace.com/newsletter">ebysplace.com/newsletter</a>.</p><p>${HOME}</p>`));
      return;
    }
    res.type("html").send(page("Joining the list…", `<form id="join" method="post" action="/api/crm/join?${esc(qs)}"><p>Adding you to the Eby's Place list.</p>
<noscript><button type="submit" style="${BUTTON};background:#111;color:#F1D98C">Join the list</button></noscript></form>
<script>document.getElementById("join").submit()</script>`));
  });

  app.post("/api/crm/join", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const { key } = signed(req);
    if (!key) {
      res.status(400).type("html").send(BAD_LINK);
      return;
    }
    try {
      await joinListAgain(key, "invite");
    } catch (err) {
      console.error("[List] Join from invite failed", err);
      res.status(500).type("html").send(page("Something went wrong", `<p>We couldn't save that just now. You can join any time at <a href="https://www.ebysplace.com/newsletter">ebysplace.com/newsletter</a>.</p>`));
      return;
    }
    res.type("html").send(page("You're on the list", `<p>Thank you! You'll hear first about free slots and offers from Eby's Place. You can leave any time with the link at the bottom of our emails.</p><p>${HOME}</p>`));
  });

  app.post("/api/crm/rejoin", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const { key } = signed(req);
    if (!key) {
      res.status(400).type("html").send(BAD_LINK);
      return;
    }
    try {
      await joinListAgain(key);
    } catch (err) {
      console.error("[List] Join again failed", err);
      res.status(500).type("html").send(page("Something went wrong", `<p>We couldn't save that just now. You can join any time at <a href="https://www.ebysplace.com/newsletter">ebysplace.com/newsletter</a>.</p>`));
      return;
    }
    res.type("html").send(page("You're back on the list", `<p>Thank you! You'll hear first about free slots and offers again.</p><p>${HOME}</p>`));
  });
}
