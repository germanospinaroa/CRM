import "server-only";

import {
  findOrCreateConversation,
  loadConversationMessages,
  saveLeadEvents,
  saveMessage,
  syncLeadFromAnalysis,
} from "@/lib/crm/persistence";
import { generateAssistantReply } from "@/lib/openai/respond";
import { analyzeConversation } from "@/lib/sales-brain/analyze";
import { parseWhatsAppWebhookPayload } from "@/lib/whatsapp/parse";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/send";

export async function processIncomingWhatsAppPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      ignored: true,
    };
  }

  const parsedMessage = parseWhatsAppWebhookPayload(
    payload as Record<string, unknown>,
  );

  if (!parsedMessage) {
    return {
      ignored: true,
    };
  }

  const conversation = await findOrCreateConversation({
    phoneNumber: parsedMessage.phoneNumber,
    profileName: parsedMessage.profileName,
  });

  await saveMessage({
    conversationId: conversation.id,
    role: "user",
    content: parsedMessage.text,
  });

  // Manual control check: if AI is disabled, stop here without responding
  if (!conversation.ai_enabled) {
    return {
      ignored: false,
      phoneNumber: parsedMessage.phoneNumber,
      conversationId: conversation.id,
      manualControlActive: true,
    };
  }

  const history = await loadConversationMessages(conversation.id, 30);
  const assistantReply = await generateAssistantReply({
    conversation,
    history,
  });

  await saveMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: assistantReply,
  });

  try {
    await sendWhatsAppTextMessage({
      phoneNumber: parsedMessage.phoneNumber,
      message: assistantReply,
    });
  } catch (error) {
    console.error("Failed to send outbound WhatsApp reply:", error);
  }

  const analysis = await analyzeConversation({
    messages: [
      ...history,
      {
        role: "assistant",
        content: assistantReply,
      },
    ],
    profileName: parsedMessage.profileName,
  });

  const syncResult = await syncLeadFromAnalysis({
    conversation,
    analysis,
  });

  const events = [
    {
      eventType: "incoming_message",
      eventValue: parsedMessage.text,
    },
    {
      eventType: "assistant_reply",
      eventValue: assistantReply,
    },
    {
      eventType: "whatsapp_message_id",
      eventValue: parsedMessage.rawMessageId,
    },
    ...analysis.events,
  ];

  await saveLeadEvents(syncResult.conversation.id, events);

  return {
    ignored: false,
    phoneNumber: parsedMessage.phoneNumber,
    conversationId: syncResult.conversation.id,
  };
}
