import "server-only";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { VALENTINA_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { cleanNullableText } from "@/lib/crm/format";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai/client";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type { ConversationRecord, MessageRecord } from "@/lib/types";

function extractChatCompletionText(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function buildFallbackReply(conversation: ConversationRecord) {
  if (!conversation.first_name) {
    return "Hola, ¿cómo vas? 😊 Soy Valentina, asistente de Germán. Para ubicarme mejor, ¿cómo te llamas?";
  }

  if (!conversation.desired_product) {
    return `Mucho gusto, ${conversation.first_name}. Te hago una pregunta rápida: ¿llegaste por curiosidad, porque viste algo que te hizo sentido, o porque buscas construir algo adicional a lo que ya haces?`;
  }

  return `${conversation.first_name}, gracias por contarme. Por lo que mencionas (${conversation.desired_product}), creo que tiene sentido que lo veas con Germán en una llamada corta. ¿Te paso el link para que elijas horario?`;
}

function sanitizeReply(value: string, fallback: string) {
  const normalized = cleanNullableText(value);

  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= 600) {
    return normalized;
  }

  return `${normalized.slice(0, 599)}…`;
}

function buildCRMContextNote(conversation: ConversationRecord) {
  const lines = [
    "Contexto actual del CRM sobre este lead (no lo leas en voz alta, úsalo para personalizar tu respuesta):",
    `- firstName: ${conversation.first_name ?? "desconocido"}`,
    `- lastName: ${conversation.last_name ?? "desconocido"}`,
    `- fullName: ${conversation.full_name ?? "desconocido"}`,
    `- desiredProduct: ${conversation.desired_product ?? "sin definir"}`,
    `- leadTemperature: ${conversation.lead_temperature ?? "cold"}`,
    `- leadStatus: ${conversation.lead_status ?? "new"}`,
    `- lastSummary: ${conversation.last_summary ?? "sin resumen previo"}`,
    `- nextStep sugerido: ${conversation.next_step ?? "sin sugerencia"}`,
    "",
    "Reglas: si firstName está vacío, pídelo de forma natural antes de avanzar.",
    "Si ya tienes el nombre, úsalo. No vuelvas a presentarte si la conversación ya empezó.",
  ];
  return lines.join("\n");
}

async function getSystemPrompt(): Promise<string> {
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "valentina_prompt")
      .single();

    if (!error && data?.value) {
      return data.value;
    }
  } catch (error) {
    console.error("Failed to load prompt from app_settings:", error);
  }

  return VALENTINA_SYSTEM_PROMPT;
}

export async function generateAssistantReply(input: {
  conversation: ConversationRecord;
  history: Array<Pick<MessageRecord, "role" | "content">>;
}) {
  const fallback = buildFallbackReply(input.conversation);
  const client = getOpenAIClient();

  if (!client) {
    return fallback;
  }

  try {
    const systemPrompt = await getSystemPrompt();

    const promptMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "system",
        content: buildCRMContextNote(input.conversation),
      },
      ...input.history.slice(-12).map<ChatCompletionMessageParam>((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    ];

    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      temperature: 0.55,
      messages: promptMessages,
    });

    const responseText = extractChatCompletionText(
      completion.choices[0]?.message?.content,
    );

    return sanitizeReply(responseText, fallback);
  } catch (error) {
    console.error("OpenAI reply generation failed:", error);
    return fallback;
  }
}
