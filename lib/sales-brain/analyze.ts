import "server-only";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import {
  cleanNullableText,
  composeFullName,
  normalizeMissingValue,
  splitFullName,
  summarizeText,
} from "@/lib/crm/format";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai/client";
import type {
  FollowUpPriority,
  LeadEventInput,
  LeadStatus,
  LeadTemperature,
  MessageRecord,
  SalesBrainAnalysis,
} from "@/lib/types";

const SALES_BRAIN_SYSTEM_PROMPT = `
Eres Sales Brain, el analista comercial de Pórtate Mal (Germán Ospina Roa).

Lees una conversación de WhatsApp entre Valentina (asistente) y un prospecto.
Tu trabajo es destilarla en información accionable para que el equipo de ventas
sepa en 5 segundos qué pasa con este lead y qué hacer.

Contexto del negocio:
- Pórtate Mal acompaña a personas que ya tienen ingresos o actividad estable
  pero quieren construir algo adicional sin romper su vida actual.
- El producto se trabaja vía Método PM con 3 fases (Despierta, Construye, Escala)
  y la compañía detrás es Zilis (no se menciona al inicio).
- El CTA principal NO es venta directa: es agendar una llamada de 30 min con
  Germán por https://calendly.com/caballerodigital-us/30min.
- Niveles de inversión: rango aproximado 299–999 USD (no asumir cifra exacta).

Devuelve SOLO un JSON válido con estas claves exactas:
firstName
lastName
fullName
customerNeed
desiredProduct
budgetRange
urgency
objections
leadTemperature
leadStage
intentLevel
summary
nextBestAction
recommendedFollowUpMessage
followUpNeeded
followUpPriority
followUpInHours
events

Reglas estrictas:
- No inventes datos. Si algo no se dice, usa null o "missing".
- firstName/lastName: usa "missing" si no aparecen explícitamente.
- fullName: solo si hay evidencia clara (nombre y apellido o profileName completo).
- customerNeed: dolor o motivación REAL en una frase corta y comercial
  (ej: "Tiene empleo pero quiere ingreso adicional sin renunciar").
  No copies el último mensaje del lead.
- desiredProduct: si el lead expresó interés concreto, descríbelo
  (ej: "agendar llamada con Germán", "entender Método PM", "info sobre Zilis").
  null si no hay nada concreto.
- budgetRange: solo si el lead lo menciona explícitamente. null si no.
- urgency: "alta" / "media" / "baja" / null según señales reales.
- objections: array de strings cortos. Objeciones típicas en este negocio:
  "No tengo tiempo", "No quiero molestar gente", "No soy bueno vendiendo",
  "Es multinivel", "Sensibilidad al precio", "No quiere dejar su trabajo",
  "Pidió pensarlo", "Necesita más claridad". Devuelve [] si no hay.
- leadTemperature ∈ {cold, warm, hot}:
  - cold: solo curiosidad, no responde preguntas, no aplica al perfil.
  - warm: responde, cuenta su situación, abierto a explorar.
  - hot: pidió la llamada, dijo "sí quiero hablar con Germán", agendó,
    o muestra urgencia/intención clara.
- leadStage ∈ {new, qualifying, nurturing, ready_to_buy, won, lost}:
  - new: primer mensaje, todavía no se ha presentado.
  - qualifying: Valentina está conociendo al lead.
  - nurturing: lead pidió tiempo, le da vueltas, objeción suave.
  - ready_to_buy: aceptó la llamada o pidió el link / agendó.
  - won: confirmó compra o entró al programa.
  - lost: rechazó claramente, no aplica, o pidió no escribir más.
- intentLevel ∈ {low, medium, high}.
- summary: 1-2 frases comerciales para que un humano sepa en qué punto está
  el lead y por qué. Lenguaje natural, no JSON-ish.
- nextBestAction: la acción concreta que el comercial debe tomar
  (ej: "Mandar link de Calendly y recordar 3 puntos a llevar a la llamada").
- recommendedFollowUpMessage: mensaje listo para copiar/pegar a WhatsApp,
  en el tono de Valentina (cálido, breve, una pregunta), respetando las
  reglas absolutas (sin "libertad financiera", "sin compromiso", etc.).
- followUpNeeded: false solo si el lead ya está cerrado (won/lost) o si
  la pelota está en cancha del lead y no hay nada que aportar.
- followUpPriority ∈ {low, medium, high}.
- followUpInHours: cuántas horas esperar antes del próximo toque
  (hot: 4-12, warm: 12-24, nurturing/cold: 24-72).
- events: array de objetos { eventType, eventValue }. Ejemplos de eventType:
  "asked_for_call_link", "agreed_to_call", "shared_pain", "asked_about_zilis",
  "asked_about_price", "objection_time", "objection_selling", "asked_to_think".

Devuelve SOLO el JSON, sin markdown ni texto extra.
`.trim();

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

function extractNameFromMessages(text: string) {
  const patterns = [
    /(?:me llamo|mi nombre es|soy)\s+([A-ZÁÉÍÓÚÑ][\p{L}]+)(?:\s+([A-ZÁÉÍÓÚÑ][\p{L}]+))?/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    return {
      firstName: match[1] ?? null,
      lastName: match[2] ?? null,
    };
  }

  return {
    firstName: null,
    lastName: null,
  };
}

function detectDesiredProductPM(text: string): string | null {
  const normalized = text.toLowerCase();

  if (/(agendar|llamada|cita|calendly|hablar con german|hablar con germán)/iu.test(normalized)) {
    return "Agendar llamada con Germán";
  }

  if (/(metodo pm|método pm|sistema|construir algo|emprendimiento)/iu.test(normalized)) {
    return "Entender el Método PM";
  }

  if (/(zilis|producto|suplemento)/iu.test(normalized)) {
    return "Información sobre Zilis";
  }

  if (/(ingreso adicional|ganar mas|ganar más|opcion adicional|opción adicional)/iu.test(normalized)) {
    return "Construir ingreso adicional";
  }

  return null;
}

function extractBudget(text: string) {
  const pattern =
    /(?:presupuesto|budget|hasta|inversion|inversión)\s*(?:de|entre)?\s*([$€]?\s?[\d.,]+\s?(?:a\s?[$€]?\s?[\d.,]+)?)/iu;
  const match = text.match(pattern);
  return cleanNullableText(match?.[1] ?? null);
}

function detectObjectionsPM(text: string) {
  const objections: string[] = [];
  const normalized = text.toLowerCase();

  if (/(caro|precio|cuesta mucho|muy caro|costoso)/iu.test(normalized)) {
    objections.push("Sensibilidad al precio");
  }

  if (/(no tengo tiempo|sin tiempo|estoy ocupad)/iu.test(normalized)) {
    objections.push("No tiene tiempo");
  }

  if (/(no quiero molestar|molestar gente|incomodar)/iu.test(normalized)) {
    objections.push("No quiere molestar gente");
  }

  if (/(no soy bueno|no se vender|no sé vender|no soy vendedor)/iu.test(normalized)) {
    objections.push("Cree que no sabe vender");
  }

  if (/(multinivel|piramide|pirámide|estafa|red de mercadeo)/iu.test(normalized)) {
    objections.push("Duda sobre multinivel");
  }

  if (/(lo voy a pensar|déjame pensarlo|dejame pensarlo|lo pienso)/iu.test(normalized)) {
    objections.push("Pidió pensarlo");
  }

  if (/(no entiendo|como funciona|cómo funciona|explicame|explícame)/iu.test(normalized)) {
    objections.push("Necesita más claridad");
  }

  if (/(no quiero dejar mi trabajo|no quiero renunciar|tengo empleo)/iu.test(normalized)) {
    objections.push("No quiere dejar su trabajo");
  }

  return objections;
}

function detectLeadTemperaturePM(text: string): LeadTemperature {
  const normalized = text.toLowerCase();

  if (
    /(quiero la llamada|agendar|calendly|si quiero hablar|sí quiero hablar|quiero hablar con german|quiero hablar con germán|paseme el link|pásame el link|mandame el link|mándame el link)/iu.test(
      normalized,
    )
  ) {
    return "hot";
  }

  if (
    /(me interesa|cuentame mas|cuéntame más|info|información|como funciona|cómo funciona|construir|metodo|método|ingreso adicional|emprender)/iu.test(
      normalized,
    )
  ) {
    return "warm";
  }

  return "cold";
}

function detectLeadStagePM(text: string, leadTemperature: LeadTemperature): LeadStatus {
  const normalized = text.toLowerCase();

  if (/(no me interesa|no gracias|no escribir mas|no escribir más|dejen de escribir)/iu.test(normalized)) {
    return "lost";
  }

  if (/(agendar|calendly|si quiero la llamada|sí quiero la llamada|paseme el link|pásame el link|mandame el link|mándame el link)/iu.test(normalized)) {
    return "ready_to_buy";
  }

  if (/(lo voy a pensar|déjame pensarlo|dejame pensarlo|lo pienso|despues|después)/iu.test(normalized)) {
    return "nurturing";
  }

  if (leadTemperature === "warm" || leadTemperature === "hot") {
    return "qualifying";
  }

  return "new";
}

function buildHeuristicEvents(input: {
  firstName: string | null;
  lastName: string | null;
  desiredProduct: string | null;
  leadTemperature: LeadTemperature;
  leadStage: LeadStatus;
  objections: string[];
}): LeadEventInput[] {
  const events: LeadEventInput[] = [
    {
      eventType: "lead_temperature",
      eventValue: input.leadTemperature,
    },
    {
      eventType: "lead_stage",
      eventValue: input.leadStage,
    },
  ];

  if (!input.firstName) {
    events.push({
      eventType: "missing_first_name",
      eventValue: null,
    });
  }

  if (!input.lastName) {
    events.push({
      eventType: "missing_last_name",
      eventValue: null,
    });
  }

  if (input.desiredProduct) {
    events.push({
      eventType: "desired_product",
      eventValue: input.desiredProduct,
    });
  }

  for (const objection of input.objections) {
    events.push({
      eventType: "objection",
      eventValue: objection,
    });
  }

  return events;
}

function buildPMSummary(input: {
  firstName: string | null;
  desiredProduct: string | null;
  objections: string[];
  leadTemperature: LeadTemperature;
  leadStage: LeadStatus;
}) {
  const name = input.firstName ?? "Lead";
  const tempLabel =
    input.leadTemperature === "hot"
      ? "caliente"
      : input.leadTemperature === "warm"
        ? "tibio"
        : "frío";
  const intent = input.desiredProduct
    ? `interesado en: ${input.desiredProduct}`
    : "sin interés concreto definido";
  const objText =
    input.objections.length > 0
      ? ` Objeciones: ${input.objections.join(", ")}.`
      : "";

  return `${name} (${tempLabel}, ${input.leadStage}). ${intent}.${objText}`;
}

function buildPMNextAction(input: {
  firstName: string | null;
  lastName: string | null;
  desiredProduct: string | null;
  leadStage: LeadStatus;
  leadTemperature: LeadTemperature;
}) {
  if (input.leadStage === "ready_to_buy") {
    return "Compartir link de Calendly y los 3 puntos a preparar para la llamada con Germán.";
  }

  if (input.leadStage === "lost") {
    return "Marcar como cerrado. No insistir más.";
  }

  if (input.leadStage === "nurturing") {
    return "Esperar 24-48h y reabrir con una pregunta empática que ayude a destrabar la duda específica.";
  }

  if (!input.firstName || !input.lastName) {
    return "Pedir nombre completo de forma natural antes de avanzar a calificación.";
  }

  if (!input.desiredProduct) {
    return "Hacer 1-2 preguntas de calificación para entender qué busca y proponer la llamada si aplica.";
  }

  if (input.leadTemperature === "hot") {
    return "Proponer la llamada con Germán de inmediato y pasar el link.";
  }

  return "Profundizar en el dolor y, si aplica, invitar a la llamada con Germán.";
}

function buildPMRecommendedMessage(input: {
  firstName: string | null;
  desiredProduct: string | null;
  leadStage: LeadStatus;
}) {
  const name = input.firstName ?? "";
  const namePart = name ? `${name}, ` : "";

  if (input.leadStage === "ready_to_buy") {
    return `Perfecto ${name}. Aquí puedes escoger horario: https://calendly.com/caballerodigital-us/30min. Cuando agendes, llega con claridad sobre 3 cosas: dónde estás hoy, qué te gustaría construir y qué te ha frenado.`.trim();
  }

  if (input.leadStage === "nurturing") {
    return `Hola ${name}, paso por aquí rápido. ¿Te quedó sonando lo que hablamos o prefieres que lo dejemos hasta aquí? Todo bien cualquiera de las dos 😊`.trim();
  }

  if (!input.firstName) {
    return "Hola, ¿cómo vas? Soy Valentina, asistente de Germán. Antes de contarte cualquier cosa, ¿cómo te llamas?";
  }

  if (!input.desiredProduct) {
    return `${namePart}para ubicarme mejor: ¿hoy estás trabajando, emprendiendo o explorando opciones nuevas?`;
  }

  return `${namePart}por lo que me cuentas, creo que tiene sentido que lo veas con Germán en una llamada de 30 min. ¿Quieres que te pase el link?`;
}

function buildHeuristicAnalysis(input: {
  messages: Array<Pick<MessageRecord, "role" | "content">>;
  profileName?: string | null;
}): SalesBrainAnalysis {
  const userTranscript = input.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");

  const profileNameParts = splitFullName(input.profileName);
  const explicitName = extractNameFromMessages(userTranscript);
  const firstName = explicitName.firstName ?? profileNameParts.firstName;
  const lastName = explicitName.lastName ?? profileNameParts.lastName;
  const fullName =
    cleanNullableText(input.profileName) ?? composeFullName(firstName, lastName);
  const desiredProduct = detectDesiredProductPM(userTranscript);
  const budgetRange = extractBudget(userTranscript);
  const objections = detectObjectionsPM(userTranscript);
  const leadTemperature = detectLeadTemperaturePM(userTranscript);
  const leadStage = detectLeadStagePM(userTranscript, leadTemperature);
  const summary = buildPMSummary({
    firstName,
    desiredProduct,
    objections,
    leadTemperature,
    leadStage,
  });
  const nextBestAction = buildPMNextAction({
    firstName,
    lastName,
    desiredProduct,
    leadStage,
    leadTemperature,
  });
  const recommendedFollowUpMessage = buildPMRecommendedMessage({
    firstName,
    desiredProduct,
    leadStage,
  });

  const customerNeed =
    desiredProduct ??
    (objections.length > 0
      ? `Lead con dudas: ${objections.join(", ")}`
      : null);

  // Calculate lead score based on temperature and stage
  const scoreByTemperature = {
    hot: 70,
    warm: 50,
    cold: 20,
  };
  const scoreAdjustment =
    leadStage === "ready_to_buy" || leadStage === "call_scheduled"
      ? 20
      : leadStage === "qualified"
        ? 10
        : 0;
  const leadScore = Math.min(100, scoreByTemperature[leadTemperature] + scoreAdjustment);

  return {
    firstName: firstName ?? "missing",
    lastName: lastName ?? "missing",
    fullName,
    customerNeed,
    desiredProduct,
    budgetRange,
    urgency:
      leadTemperature === "hot"
        ? "alta"
        : leadTemperature === "warm"
          ? "media"
          : null,
    objections,
    leadTemperature,
    leadStage,
    leadScore,
    intentLevel:
      leadTemperature === "hot"
        ? "high"
        : leadTemperature === "warm"
          ? "medium"
          : "low",
    summary: summarizeText(summary, 240),
    nextBestAction,
    recommendedFollowUpMessage,
    followUpNeeded: leadStage !== "won" && leadStage !== "lost",
    followUpPriority:
      leadStage === "ready_to_buy" || leadTemperature === "hot"
        ? "high"
        : leadTemperature === "warm"
          ? "medium"
          : "low",
    followUpInHours:
      leadStage === "ready_to_buy"
        ? 4
        : leadTemperature === "hot"
          ? 8
          : leadTemperature === "warm"
            ? 24
            : 48,
    events: buildHeuristicEvents({
      firstName,
      lastName,
      desiredProduct,
      leadTemperature,
      leadStage,
      objections,
    }),
  };
}

function normalizeLeadTemperature(value: unknown, fallback: LeadTemperature) {
  const normalized = cleanNullableText(value)?.toLowerCase();

  if (normalized === "hot" || normalized === "warm" || normalized === "cold") {
    return normalized;
  }

  return fallback;
}

function normalizeLeadStage(value: unknown, fallback: LeadStatus) {
  const normalized = cleanNullableText(value)?.toLowerCase();

  if (
    normalized === "new" ||
    normalized === "qualifying" ||
    normalized === "nurturing" ||
    normalized === "ready_to_buy" ||
    normalized === "won" ||
    normalized === "lost"
  ) {
    return normalized;
  }

  return fallback;
}

function normalizePriority(value: unknown, fallback: FollowUpPriority) {
  const normalized = cleanNullableText(value)?.toLowerCase();

  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }

  return fallback;
}

function sanitizeEvents(value: unknown, fallback: LeadEventInput[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const events = value
    .map((event) => {
      if (!event || typeof event !== "object") {
        return null;
      }

      const rawEvent = event as {
        eventType?: unknown;
        eventValue?: unknown;
      };
      const eventType = cleanNullableText(rawEvent.eventType);

      if (!eventType) {
        return null;
      }

      return {
        eventType,
        eventValue: cleanNullableText(rawEvent.eventValue),
      };
    })
    .filter(Boolean) as LeadEventInput[];

  return events.length > 0 ? events : fallback;
}

function sanitizeAnalysis(
  rawAnalysis: Record<string, unknown>,
  fallback: SalesBrainAnalysis,
): SalesBrainAnalysis {
  const firstName = normalizeMissingValue(rawAnalysis.firstName);
  const lastName = normalizeMissingValue(rawAnalysis.lastName);
  const fullName =
    normalizeMissingValue(rawAnalysis.fullName) ?? composeFullName(firstName, lastName);

  return {
    firstName: firstName ?? "missing",
    lastName: lastName ?? "missing",
    fullName,
    customerNeed:
      normalizeMissingValue(rawAnalysis.customerNeed) ?? fallback.customerNeed,
    desiredProduct:
      normalizeMissingValue(rawAnalysis.desiredProduct) ?? fallback.desiredProduct,
    budgetRange:
      normalizeMissingValue(rawAnalysis.budgetRange) ?? fallback.budgetRange,
    urgency: normalizeMissingValue(rawAnalysis.urgency) ?? fallback.urgency,
    objections: Array.isArray(rawAnalysis.objections)
      ? rawAnalysis.objections
          .map((item) => cleanNullableText(item))
          .filter(Boolean) as string[]
      : fallback.objections,
    leadTemperature: normalizeLeadTemperature(
      rawAnalysis.leadTemperature,
      fallback.leadTemperature,
    ),
    leadStage: normalizeLeadStage(rawAnalysis.leadStage, fallback.leadStage),
    leadScore:
      typeof rawAnalysis.leadScore === "number" &&
      Number.isFinite(rawAnalysis.leadScore)
        ? Math.min(100, Math.max(0, rawAnalysis.leadScore))
        : fallback.leadScore,
    intentLevel: cleanNullableText(rawAnalysis.intentLevel) ?? fallback.intentLevel,
    summary: cleanNullableText(rawAnalysis.summary) ?? fallback.summary,
    nextBestAction:
      cleanNullableText(rawAnalysis.nextBestAction) ?? fallback.nextBestAction,
    recommendedFollowUpMessage:
      cleanNullableText(rawAnalysis.recommendedFollowUpMessage) ??
      fallback.recommendedFollowUpMessage,
    followUpNeeded:
      typeof rawAnalysis.followUpNeeded === "boolean"
        ? rawAnalysis.followUpNeeded
        : fallback.followUpNeeded,
    followUpPriority: normalizePriority(
      rawAnalysis.followUpPriority,
      fallback.followUpPriority,
    ),
    followUpInHours:
      typeof rawAnalysis.followUpInHours === "number" &&
      Number.isFinite(rawAnalysis.followUpInHours) &&
      rawAnalysis.followUpInHours >= 0
        ? rawAnalysis.followUpInHours
        : fallback.followUpInHours,
    events: sanitizeEvents(rawAnalysis.events, fallback.events),
  };
}

export async function analyzeConversation(input: {
  messages: Array<Pick<MessageRecord, "role" | "content">>;
  profileName?: string | null;
}) {
  const fallback = buildHeuristicAnalysis(input);
  const client = getOpenAIClient();

  if (!client) {
    return fallback;
  }

  try {
    const promptMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: SALES_BRAIN_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({
          profileName: input.profileName ?? null,
          conversation: input.messages.slice(-24),
        }),
      },
    ];

    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      temperature: 0.2,
      response_format: {
        type: "json_object",
      },
      messages: promptMessages,
    });

    const content = extractChatCompletionText(
      completion.choices[0]?.message?.content,
    );

    if (!content) {
      return fallback;
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    return sanitizeAnalysis(parsed, fallback);
  } catch (error) {
    console.error("Sales Brain analysis failed:", error);
    return fallback;
  }
}
