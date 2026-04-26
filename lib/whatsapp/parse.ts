import type { ParsedWhatsAppMessage } from "@/lib/types";

function extractMessageText(message: Record<string, unknown>) {
  const type = typeof message.type === "string" ? message.type : null;

  if (type === "text") {
    const body = (message.text as { body?: unknown } | undefined)?.body;
    return typeof body === "string" ? body.trim() : null;
  }

  if (type === "button") {
    const text = (message.button as { text?: unknown } | undefined)?.text;
    return typeof text === "string" ? text.trim() : null;
  }

  if (type === "interactive") {
    const interactive = message.interactive as
      | {
          button_reply?: { title?: unknown };
          list_reply?: { title?: unknown };
        }
      | undefined;

    const buttonTitle = interactive?.button_reply?.title;
    if (typeof buttonTitle === "string") {
      return buttonTitle.trim();
    }

    const listTitle = interactive?.list_reply?.title;
    if (typeof listTitle === "string") {
      return listTitle.trim();
    }
  }

  return null;
}

export function parseWhatsAppWebhookPayload(
  payload: Record<string, unknown>,
): ParsedWhatsAppMessage | null {
  const entry = Array.isArray(payload.entry) ? payload.entry[0] : null;
  const change = Array.isArray(
    (entry as { changes?: unknown[] } | null)?.changes,
  )
    ? (entry as { changes: unknown[] }).changes[0]
    : null;
  const value = (change as { value?: Record<string, unknown> } | null)?.value;
  const message = Array.isArray(value?.messages)
    ? (value.messages[0] as Record<string, unknown> | undefined)
    : undefined;

  if (!message) {
    return null;
  }

  const phoneNumber = typeof message.from === "string" ? message.from : null;
  const text = extractMessageText(message);

  if (!phoneNumber || !text) {
    return null;
  }

  const contact = Array.isArray(value?.contacts)
    ? (value.contacts[0] as { profile?: { name?: unknown } } | undefined)
    : undefined;

  return {
    phoneNumber,
    text,
    profileName:
      typeof contact?.profile?.name === "string" ? contact.profile.name : null,
    rawMessageId: typeof message.id === "string" ? message.id : null,
  };
}
