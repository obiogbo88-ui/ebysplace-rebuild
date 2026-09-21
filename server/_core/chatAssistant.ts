import { normalizeSecretKey, trimEnvValue } from "./envSecrets";
import * as db from "../db";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const BOT_NAME = "Eby";

async function buildSystemPrompt() {
  const [services, availability] = await Promise.all([
    db.listServices(),
    db.getAvailabilitySettings(),
  ]);

  const serviceLines = (services as any[])
    .filter((service) => String(service.isBookable) !== "false")
    .map((service) => `- ${service.name} (${service.category}): from £${service.priceFrom}, ${service.duration}${service.description ? ` — ${service.description}` : ""}`)
    .join("\n");

  const surcharge = Number(availability.homeServiceSurcharge || 0);

  return [
    `You are ${BOT_NAME}, the friendly booking assistant for Eby's Place, a hair braiding studio.`,
    `Your job is to answer visitor questions helpfully and guide them toward booking an appointment.`,
    ``,
    `CURRENT SERVICES AND PRICES (this is the only source of truth — never invent a service, price, or duration that isn't listed here):`,
    serviceLines || "(no services currently listed)",
    ``,
    `BOOKING POLICY:`,
    `- A £20 deposit is required to confirm any booking, paid securely online at booking time.`,
    `- Cancellations 48 hours or more before the appointment get a full deposit refund. Cancellations under 48 hours are non-refundable.`,
    surcharge > 0
      ? `- Home-service (Eby's Place comes to you) adds a £${surcharge.toFixed(2)} travel surcharge.`
      : `- Home-service (Eby's Place comes to you) is available.`,
    ``,
    `HOW TO HELP:`,
    `- Be warm, concise, and confident — a few sentences per reply, not an essay.`,
    `- When a visitor has named a service and is ready to book it, end your reply on its own line with exactly: [[BOOK:<exact service name>]] — using the exact service name as listed above, nothing else on that line. Never explain this marker to the visitor; it is stripped out automatically and turned into a booking button.`,
    `- If asked something you can't answer from the information above (real-time availability of a specific date, a policy not listed here, anything about an order or existing booking), say briefly that you're not sure and that the team will help, then hand over to a person (see below) — never guess or invent an answer.`,
    `- HANDING OVER TO A PERSON: if the visitor asks for a real person, a human, WhatsApp, a phone call, or the owner — or you cannot answer — reply in one or two warm sentences saying the team will help, then end your reply on its own line with exactly: [[HANDOFF]]. The chat window automatically shows a form for their name and phone/email plus a WhatsApp button when it sees that marker, so NEVER say you lack the studio's WhatsApp or contact details, never tell them to look for contact details elsewhere, and never explain the marker. Do not ask for their contact details yourself in the text.`,
    `- If a visitor volunteers their name, phone or email, thank them and say the team can use it to follow up.`,
    `- Never discuss anything unrelated to Eby's Place hair services.`,
  ].join("\n");
}

export async function askEby(messages: ChatMessage[]): Promise<string> {
  const apiKey = normalizeSecretKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) {
    throw new Error("Eby chat assistant is not configured for this deployment. Add ANTHROPIC_API_KEY in Vercel, then redeploy.");
  }

  const system = await buildSystemPrompt();

  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: trimEnvValue(process.env.ANTHROPIC_MODEL) || "claude-sonnet-5",
      max_tokens: 500,
      system,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Eby chat assistant request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = result.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Eby chat assistant returned an empty response.");
  return text;
}
