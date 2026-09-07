import { TRPCError } from "@trpc/server";
import { notifyOwnerByTwilioSafely } from "../customerNotifications";
import { sendPushToOwner } from "../webPush";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Dispatches an Eby’s Place owner notification through Twilio SMS, WhatsApp,
 * and browser push, whichever are configured. The helper is intentionally
 * non-blocking for business flows: delivery failures are logged and
 * surfaced as `false`, while payload validation still throws.
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const { title, content } = validatePayload(payload);
  const [twilioResult, pushResult] = await Promise.all([
    notifyOwnerByTwilioSafely({ title, content }),
    sendPushToOwner({ title, body: content }).catch(() => ({ sent: false, deliveredCount: 0 })),
  ]);
  return Boolean(twilioResult.sms.sent || twilioResult.whatsapp.sent || pushResult.deliveredCount > 0);
}
