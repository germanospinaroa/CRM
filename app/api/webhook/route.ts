import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { processIncomingWhatsAppPayload } from "@/lib/crm/process-incoming-message";

let warnedMissingMetaAppSecret = false;

function warnMissingMetaAppSecret() {
  if (warnedMissingMetaAppSecret) {
    return;
  }

  warnedMissingMetaAppSecret = true;
  console.warn(
    "[Security] Missing META_APP_SECRET. WhatsApp webhook signature validation cannot run.",
  );
}

function getRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

function isValidMetaSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string | null;
}) {
  if (!input.signatureHeader || !input.appSecret) {
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", input.appSecret)
    .update(input.rawBody)
    .digest("hex")}`;
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(input.signatureHeader.trim());

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    verifyToken &&
    verifyToken === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
    });
  }

  return new Response("Forbidden", {
    status: 403,
  });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const appSecret = process.env.META_APP_SECRET?.trim() ?? null;
    const signatureHeader = request.headers.get("x-hub-signature-256");
    const rawBody = await request.text();

    if (!appSecret) {
      warnMissingMetaAppSecret();
      console.error("[Webhook] Missing META_APP_SECRET", {
        requestId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Webhook signature configuration missing.",
        },
        {
          status: 503,
        },
      );
    }

    if (
      !isValidMetaSignature({
        rawBody,
        signatureHeader,
        appSecret,
      })
    ) {
      console.warn("[Webhook] Invalid signature", {
        requestId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid webhook signature.",
        },
        {
          status: 401,
        },
      );
    }

    const payload = JSON.parse(rawBody) as unknown;

    const result = await processIncomingWhatsAppPayload(payload);

    console.info("[Webhook] Processed", {
      requestId,
      ignored: result.ignored,
      conversationId:
        "conversationId" in result ? result.conversationId ?? null : null,
    });

    return NextResponse.json(
      {
        ok: true,
        ignored: result.ignored,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("[Webhook] Processing failed", {
      requestId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Webhook processing failed",
      },
      {
        status: 500,
      },
    );
  }
}
