import "server-only";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import {
  type ResolvedValentinaPrompt,
  resolveActiveValentinaPrompt,
} from "@/lib/agent/resolve-prompt";
import {
  cleanNullableText,
  detectUserIntentAskingIdentity,
  detectUserIntentAdvance,
  detectUserIntentRequestCalendar,
  getConversationAiMode,
  isGenericProfileName,
  normalizeLeadName,
} from "@/lib/crm/format";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai/client";
import type { ConversationRecord, MessageRecord } from "@/lib/types";

export interface ParsedValentinaReply {
  mode: "auto" | "manual";
  messages: string[];
  analysis: Record<string, unknown> | null;
  suggestedMessage: string | null;
  rawText: string;
}

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

function stripJsonFence(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObjectText(value: string) {
  const cleaned = stripJsonFence(value);

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return cleaned.slice(firstBrace, lastBrace + 1).trim();
    }

    return cleaned;
  }
}

function normalizeMessageArray(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const messages: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    const cleaned = cleanNullableText(item);
    if (!cleaned) {
      return null;
    }

    messages.push(cleaned);
  }

  return messages.length > 0 ? messages : null;
}

function parseAgentResponse(
  rawText: string,
  fallbackMessage: string,
): ParsedValentinaReply {
  const cleaned = cleanNullableText(rawText) ?? "";
  const jsonText = extractJsonObjectText(cleaned);

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const messages = normalizeMessageArray(parsed.messages);
    const analysis =
      parsed.analysis && typeof parsed.analysis === "object" && !Array.isArray(parsed.analysis)
        ? (parsed.analysis as Record<string, unknown>)
        : null;

    const mode =
      parsed.mode === "manual" || parsed.mode === "auto" ? parsed.mode : "auto";
    const suggestedMessage = cleanNullableText(
      parsed.suggested_message ?? parsed.suggestedMessage,
    );

    if (!messages) {
      return {
        mode,
        messages: [fallbackMessage],
        analysis,
        suggestedMessage,
        rawText: cleaned,
      };
    }

    return {
      mode,
      messages,
      analysis,
      suggestedMessage,
      rawText: cleaned,
    };
  } catch {
    return {
      mode: "auto",
      messages: [fallbackMessage],
      analysis: null,
      suggestedMessage: null,
      rawText: cleaned,
    };
  }
}

function buildFallbackReply(conversation: ConversationRecord) {
  void conversation;
  return "Perdón, tuve un problema leyendo la respuesta. ¿Me repites eso por favor?";
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
  const hasGreeted = conversation.has_greeted ?? false;
  const hasAskedName = conversation.has_asked_name ?? false;
  const trustedNameSource = cleanNullableText(conversation.lead_name_source)?.toLowerCase();
  const hasTrustedName =
    trustedNameSource === "conversation" ||
    cleanNullableText(conversation.last_user_intent)?.toLowerCase() === "provided_name";
  const preferredName = hasTrustedName
    ? !isGenericProfileName(conversation.preferred_name)
      ? cleanNullableText(conversation.preferred_name)
      : null
    : null;
  const firstName = hasTrustedName
    ? !isGenericProfileName(conversation.first_name)
      ? cleanNullableText(conversation.first_name)
      : null
    : null;
  const fullName = hasTrustedName
    ? !isGenericProfileName(conversation.full_name)
      ? cleanNullableText(conversation.full_name)
      : null
    : null;
  const nameFromDB = preferredName ?? firstName ?? fullName;
  const conversationStage = conversation.conversation_stage ?? "new";
  const lastUserIntent = conversation.last_user_intent ?? null;
  const lastAiAction = conversation.last_ai_action ?? null;

  const lines = [
    "Contexto factual del CRM (úsalo para personalizar la respuesta, no lo leas literal):",
    `- firstName: ${firstName ?? "desconocido"}`,
    `- lastName: ${conversation.last_name ?? "desconocido"}`,
    `- fullName: ${fullName ?? "desconocido"}`,
    `- preferredName: ${nameFromDB ?? "sin nombre"}`,
    `- desiredProduct: ${conversation.desired_product ?? "sin definir"}`,
    `- leadTemperature: ${conversation.lead_temperature ?? "cold"}`,
    `- leadStatus: ${conversation.lead_status ?? "new"}`,
    `- leadScore: ${conversation.lead_score ?? 0}`,
    `- lastSummary: ${conversation.last_summary ?? "sin resumen previo"}`,
    `- nextStep sugerido: ${conversation.next_step ?? "sin sugerencia"}`,
    `- aiMode: ${getConversationAiMode(conversation)}`,
    "--- Estado de Valentina (usar para decidir):",
    `- hasGreeted: ${hasGreeted}`,
    `- hasAskedName: ${hasAskedName}`,
    `- leadPreferredName: ${nameFromDB ?? "sin nombre"}`,
    `- conversationStage: ${conversationStage}`,
    `- lastUserIntent: ${lastUserIntent ?? "ninguno"}`,
    `- lastAiAction: ${lastAiAction ?? "ninguno"}`,
  ];
  return lines.join("\n");
}

function buildPromptMessages(input: {
  systemPrompt: string;
  history: Array<Pick<MessageRecord, "role" | "content">>;
  conversation: ConversationRecord;
  extraSystemInstructions?: string[];
}): ChatCompletionMessageParam[] {
  const recentMessages = input.history.slice(-12);
  const latestUserMessage = [...recentMessages]
    .reverse()
    .find((m) => m.role === "user")?.content ?? null;

  const contextLines = [
    "Historial reciente de la conversación:",
    ...recentMessages.map((m) =>
      m.role === "assistant"
        ? `Valentina: ${m.content}`
        : `Usuario: ${m.content}`,
    ),
  ].join("\n");

  const systemMessages: ChatCompletionMessageParam[] = [
    {
      role: "system" as const,
      content: input.systemPrompt,
    },
    ...(input.extraSystemInstructions ?? []).map((instruction) => ({
      role: "system" as const,
      content: instruction,
    })),
    {
      role: "system" as const,
      content: buildCRMContextNote(input.conversation),
    },
    {
      role: "system" as const,
      content: contextLines,
    },
  ];

  const userMessageForModel = latestUserMessage
    ? { role: "user" as const, content: latestUserMessage }
    : null;

  return userMessageForModel
    ? [...systemMessages, userMessageForModel]
    : systemMessages;
}

function logPromptUsage(input: {
  prompt: ResolvedValentinaPrompt;
  model: string;
  conversationId: string | null;
  aiMode: "auto" | "manual";
}) {
  console.info("ValentinaPromptDiagnostics", {
    timestamp: new Date().toISOString(),
    conversationId: input.conversationId,
    aiMode: input.aiMode,
    promptId: input.prompt.promptId,
    promptVersion: input.prompt.version,
    promptUpdatedAt: input.prompt.updatedAt,
    promptChars: input.prompt.promptChars,
    promptSource: input.prompt.source,
    promptSourceLabel: input.prompt.sourceLabel,
    model: input.model,
  });
}

export async function generateDiagnosticReply(input: {
  message: string;
}) {
  const prompt = await resolveActiveValentinaPrompt();
  const client = getOpenAIClient();
  const model = getOpenAIModel();
  const userMessage = cleanNullableText(input.message) ?? "Hola";

  if (!client) {
    return {
      ok: false,
      error: "OpenAI no está configurado.",
      prompt,
      model,
      response: null,
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.55,
      messages: [
        {
          role: "system",
          content: prompt.prompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const responseText = sanitizeReply(
      extractChatCompletionText(completion.choices[0]?.message?.content),
      "No pude generar una respuesta de prueba.",
    );

    logPromptUsage({
      prompt,
      model,
      conversationId: null,
      aiMode: "auto",
    });

    return {
      ok: true,
      error: null,
      prompt,
      model,
      response: responseText,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      prompt,
      model,
      response: null,
    };
  }
}

export interface AssistantReplyResult {
  prompt: ResolvedValentinaPrompt | null;
  model: string;
  reply: ParsedValentinaReply;
  stateUpdate: {
    hasGreeted?: boolean;
    hasAskedName?: boolean;
    leadPreferredName?: string;
    conversationStage?: string;
    lastUserIntent?: string | null;
    lastAiAction?: string | null;
    lastAnalysis?: Record<string, unknown> | null;
    explanationStep?: string;
    lastAiQuestion?: string | null;
    detectedNeed?: string | null;
    detectedPain?: string | null;
    detectedObjection?: string | null;
    currentSituation?: string | null;
    lastMeaningfulUserMessage?: string | null;
    nextBestAction?: string | null;
    followupStage?: string;
    leadPreferredNameFromChat?: string | null;
    leadFullName?: string | null;
    leadFirstName?: string | null;
    leadNameSource?: string | null;
    leadNameUpdatedAt?: string | null;
    lastAiMessageAt?: string | null;
  };
}

export async function generateAssistantReply(input: {
  conversation: ConversationRecord;
  history: Array<Pick<MessageRecord, "role" | "content">>;
  extraSystemInstructions?: string[];
}): Promise<AssistantReplyResult> {
  const fallback = buildFallbackReply(input.conversation);
  const client = getOpenAIClient();
  const model = getOpenAIModel();

  if (!client) {
    return {
      prompt: null,
      model,
      reply: {
        mode: "auto" as const,
        messages: [fallback],
        analysis: null,
        suggestedMessage: null,
        rawText: fallback,
      },
      stateUpdate: {},
    };
  }

  try {
    const resolvedPrompt = await resolveActiveValentinaPrompt();
    const recentMessages = input.history.slice(-12);
    const userText =
      cleanNullableText(
        [...recentMessages].reverse().find((message) => message.role === "user")
          ?.content,
      ) ?? "";
    const promptMessages = buildPromptMessages({
      systemPrompt: resolvedPrompt.prompt,
      conversation: input.conversation,
      history: input.history,
      extraSystemInstructions: input.extraSystemInstructions,
    });

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.55,
      messages: promptMessages,
    });

    const responseText = extractChatCompletionText(completion.choices[0]?.message?.content);
    const parsedResponse = parseAgentResponse(responseText, fallback);
    const userFacingText = parsedResponse.messages.join("\n\n");

    const isAskingIdentity = detectUserIntentAskingIdentity(userText);
    const isAskingAdvance = detectUserIntentAdvance(userText);
    const isRequestingCalendar = detectUserIntentRequestCalendar(userText);

    const stateUpdate: AssistantReplyResult["stateUpdate"] = {};

    const conversation = input.conversation;

    if (isAskingIdentity) {
      stateUpdate.lastUserIntent = "asking_identity_or_confused";
    } else if (isRequestingCalendar) {
      stateUpdate.lastUserIntent = "request_calendar";
      stateUpdate.lastAiAction = "sent_calendar";
      stateUpdate.conversationStage = "calendar_sent";
    } else if (isAskingAdvance) {
      stateUpdate.lastUserIntent = "advance_or_accept";
      const lastAiAction = conversation.last_ai_action ?? null;
      if (lastAiAction === "offered_explanation" || lastAiAction === "offered_details") {
        stateUpdate.lastAiAction = "provided_explanation";
        stateUpdate.conversationStage = "explained";
      } else if (lastAiAction === "asked_if_wants_link") {
        stateUpdate.lastAiAction = "sent_calendar";
        stateUpdate.conversationStage = "calendar_sent";
      } else if (lastAiAction === "offered_calendar") {
        stateUpdate.lastAiAction = "sent_calendar";
        stateUpdate.conversationStage = "calendar_sent";
      }
    }

    const detectedName = normalizeLeadName(userText, {
      allowStandalone:
        Boolean(conversation.has_asked_name) ||
        cleanNullableText(conversation.last_ai_action) === "asked_name",
    });
    if (detectedName && detectedName.confidence >= 0.8) {
      const trustedNameSource = cleanNullableText(conversation.lead_name_source)?.toLowerCase();
      const hasTrustedExistingName =
        trustedNameSource === "conversation" ||
        cleanNullableText(conversation.last_user_intent)?.toLowerCase() === "provided_name";
      const hasExistingPreferredName = hasTrustedExistingName && !!(
        (!isGenericProfileName(conversation.preferred_name)
          ? conversation.preferred_name
          : null) ??
        (!isGenericProfileName(conversation.first_name)
          ? conversation.first_name
          : null)
      );
      if (!hasExistingPreferredName) {
        if (detectedName.preferredName) {
          stateUpdate.leadPreferredName = detectedName.preferredName;
          stateUpdate.leadPreferredNameFromChat = detectedName.preferredName;
          stateUpdate.leadFullName = detectedName.fullName;
          stateUpdate.leadFirstName = detectedName.firstName;
          stateUpdate.leadNameSource = detectedName.nameSource;
          stateUpdate.leadNameUpdatedAt = new Date().toISOString();
        }
        stateUpdate.lastUserIntent = stateUpdate.lastUserIntent ?? "provided_name";
      }
    }

    if (!conversation.has_greeted) {
      stateUpdate.hasGreeted = true;
    }

    if (/\b(c[uú]al es tu nombre|c[oó]mo te llamas|c[oó]mo se llama)\b/i.test(responseText)) {
      stateUpdate.hasAskedName = true;
      stateUpdate.lastAiAction = stateUpdate.lastAiAction ?? "asked_name";
    }

    if (
      /(soy valentina|asistente de germ[aá]n|mucho gusto|encantada)/i.test(userFacingText) &&
      !stateUpdate.lastAiAction
    ) {
      stateUpdate.lastAiAction = "introduced_self";
    }

    stateUpdate.lastAiMessageAt = new Date().toISOString();

    logPromptUsage({
      prompt: resolvedPrompt,
      model,
      conversationId: conversation.id,
      aiMode: getConversationAiMode(conversation),
    });

    return {
      prompt: resolvedPrompt,
      model,
      reply: parsedResponse,
      stateUpdate,
    };
  } catch (error) {
    console.error("OpenAI reply generation failed:", error);
    return {
      prompt: null,
      model,
      reply: {
        mode: "auto" as const,
        messages: [fallback],
        analysis: null,
        suggestedMessage: null,
        rawText: fallback,
      },
      stateUpdate: {},
    };
  }
}
