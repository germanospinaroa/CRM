import { NextRequest, NextResponse } from "next/server";

import { cleanNullableText } from "@/lib/crm/format";
import {
  loadConversationById,
  loadConversationMessages,
  saveLeadEvents,
  saveMessage,
  syncLeadFromAnalysis,
} from "@/lib/crm/persistence";
import { analyzeConversation } from "@/lib/sales-brain/analyze";
import { prepareOutgoingMessages } from "@/lib/whatsapp/chunk";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/send";
import { requireAdminSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const auth = await requireAdminSession(request, {
    productionMissingSessionStatus: 403,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const params = await context.params;
    const conversationId = cleanNullableText(params?.conversationId);

    if (!conversationId) {
      return NextResponse.json(
        {
          ok: false,
          error: "conversationId es requerido.",
        },
        { status: 400 },
      );
    }

    const payload = (await request.json()) as { message?: string };
    const manualMessage = cleanNullableText(payload.message);

    if (!manualMessage) {
      return NextResponse.json(
        {
          ok: false,
          error: "El mensaje manual no puede estar vacío.",
        },
        { status: 400 },
      );
    }

    const conversation = await loadConversationById(conversationId);

    let delivered = true;
    const prepared = prepareOutgoingMessages([manualMessage], {
      maxLength: 160,
      maxMessages: 5,
    });
    const outboundChunks = prepared.messages;

    try {
      for (let index = 0; index < outboundChunks.length; index += 1) {
        const chunk = outboundChunks[index] ?? "";

        await saveMessage({
          conversationId,
          role: "assistant",
          content: chunk,
          isManual: true,
        });

        await sendWhatsAppTextMessage({
          phoneNumber: conversation.phone_number,
          message: chunk,
        });

        if (index < outboundChunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }

      if (prepared.truncated) {
        console.info("Manual reply truncated to message limit.", {
          conversationId,
          originalMessageCount: 1,
          sentMessageCount: outboundChunks.length,
        });
      }
    } catch (error) {
      delivered = false;
      console.error("Failed sending manual outbound reply:", {
        conversationId,
        error,
      });
    }

    const history = await loadConversationMessages(conversationId, 30);
    const analysis = await analyzeConversation({
      messages: history,
      profileName: conversation.full_name,
    });

    const syncResult = await syncLeadFromAnalysis({
      conversation,
      analysis,
    });

    await saveLeadEvents(syncResult.conversation.id, [
      {
        eventType: "manual_reply",
        eventValue: manualMessage,
      },
      {
        eventType: "manual_reply_delivery",
        eventValue: delivered ? "delivered" : "failed",
      },
      ...analysis.events,
    ]);

    return NextResponse.json({
      ok: true,
      delivered,
      conversationId: syncResult.conversation.id,
    });
  } catch (error) {
    console.error("Manual reply endpoint failed:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo enviar el mensaje manual.",
      },
      { status: 500 },
    );
  }
}
