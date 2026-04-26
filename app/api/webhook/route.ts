import { NextResponse } from "next/server";

import { processIncomingWhatsAppPayload } from "@/lib/crm/process-incoming-message";

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
  try {
    const payload = await request.json();

    console.log(
      "WhatsApp webhook payload:",
      JSON.stringify(payload, null, 2),
    );

    const result = await processIncomingWhatsAppPayload(payload);

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
    console.error("Webhook processing failed:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : null,
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
