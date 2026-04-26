import type {
  FollowUpPriority,
  LeadPriority,
  LeadStatus,
  LeadTemperature,
} from "@/lib/types";

const MISSING_MARKERS = new Set([
  "missing",
  "faltante",
  "unknown",
  "n/a",
  "na",
  "null",
  "undefined",
]);

export function cleanNullableText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeMissingValue(value: unknown): string | null {
  const normalized = cleanNullableText(value);

  if (!normalized) {
    return null;
  }

  if (MISSING_MARKERS.has(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
}

export function splitFullName(fullName: string | null | undefined) {
  const normalized = cleanNullableText(fullName);

  if (!normalized) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: null,
    };
  }

  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

export function composeFullName(
  firstName: string | null,
  lastName: string | null,
): string | null {
  const parts = [cleanNullableText(firstName), cleanNullableText(lastName)].filter(
    Boolean,
  );

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

export function addHours(date: Date, hours: number) {
  const nextDate = new Date(date);
  nextDate.setHours(nextDate.getHours() + hours);
  return nextDate;
}

export function getDisplayName(options: {
  fullName?: string | null;
  full_name?: string | null;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
}) {
  return (
    cleanNullableText(options.fullName ?? options.full_name) ??
    composeFullName(
      options.firstName ?? options.first_name ?? null,
      options.lastName ?? options.last_name ?? null,
    ) ??
    "Contacto sin nombre"
  );
}

export function summarizeText(text: string | null | undefined, max = 92) {
  const normalized = cleanNullableText(text);

  if (!normalized) {
    return "Sin contenido";
  }

  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1)}…`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
}

export function getLeadTemperatureLabel(value: string | null | undefined) {
  const tone = (value ?? "").toLowerCase() as LeadTemperature;

  if (tone === "hot") return "Caliente";
  if (tone === "warm") return "Tibio";
  return "Frío";
}

export function getLeadStatusLabel(value: string | null | undefined) {
  const status = (value ?? "").toLowerCase() as LeadStatus;
  const labels: Record<string, string> = {
    new: "Nuevo",
    conversing: "Conversando",
    qualified: "Calificado",
    warm: "Tibio",
    hot: "Caliente",
    ready_for_call: "Listo para llamada",
    call_scheduled: "Llamada agendada",
    follow_up_pending: "Seguimiento pendiente",
    not_qualified: "No califica",
    closed: "Cerrado",
    lost: "Perdido",
    customer: "Cliente",
    // legacy
    qualifying: "Calificando",
    nurturing: "Seguimiento",
    ready_to_buy: "Listo para comprar",
    won: "Cliente",
  };

  return labels[status] ?? "Sin estado";
}

export function getLeadStatusTone(value: string | null | undefined) {
  const status = (value ?? "").toLowerCase();

  if (
    status === "lost" ||
    status === "not_qualified" ||
    status === "closed"
  ) {
    return "danger";
  }

  if (status === "customer" || status === "won") {
    return "success";
  }

  if (
    status === "ready_for_call" ||
    status === "ready_to_buy" ||
    status === "call_scheduled" ||
    status === "hot" ||
    status === "qualified"
  ) {
    return "hot";
  }

  if (
    status === "warm" ||
    status === "nurturing" ||
    status === "follow_up_pending"
  ) {
    return "warm";
  }

  if (status === "conversing" || status === "qualifying") {
    return "info";
  }

  return "default";
}

export function isClosedLeadStatus(value: string | null | undefined) {
  const status = (value ?? "").toLowerCase();
  return (
    status === "won" ||
    status === "lost" ||
    status === "closed" ||
    status === "customer" ||
    status === "not_qualified"
  );
}

export function isReadyForCallStatus(value: string | null | undefined) {
  const status = (value ?? "").toLowerCase();
  return (
    status === "ready_to_buy" ||
    status === "ready_for_call" ||
    status === "call_scheduled"
  );
}

export const LEAD_STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: "new", label: "Nuevo" },
  { value: "conversing", label: "Conversando" },
  { value: "qualified", label: "Calificado" },
  { value: "warm", label: "Tibio" },
  { value: "hot", label: "Caliente" },
  { value: "ready_for_call", label: "Listo para llamada" },
  { value: "call_scheduled", label: "Llamada agendada" },
  { value: "follow_up_pending", label: "Seguimiento pendiente" },
  { value: "not_qualified", label: "No califica" },
  { value: "closed", label: "Cerrado" },
  { value: "lost", label: "Perdido" },
  { value: "customer", label: "Cliente" },
];

export const LEAD_PRIORITY_OPTIONS: Array<{ value: LeadPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function getLeadPriorityLabel(value: string | null | undefined) {
  const p = (value ?? "").toLowerCase() as LeadPriority;
  const labels: Record<LeadPriority, string> = {
    low: "Baja",
    medium: "Media",
    high: "Alta",
    urgent: "Urgente",
  };
  return labels[p] ?? "Media";
}

export function getFollowUpPriorityLabel(value: string | null | undefined) {
  const priority = (value ?? "").toLowerCase() as FollowUpPriority;
  const labels: Record<FollowUpPriority, string> = {
    low: "Baja",
    medium: "Media",
    high: "Alta",
  };

  return labels[priority] ?? "Media";
}

export function getFollowUpPriorityTone(value: string | null | undefined) {
  const priority = (value ?? "").toLowerCase();

  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

export function getScoreClassification(score: number): {
  label: string;
  tone: "cold" | "warm" | "hot" | "ready";
} {
  if (score >= 81) return { label: "Listo", tone: "ready" };
  if (score >= 61) return { label: "Caliente", tone: "hot" };
  if (score >= 31) return { label: "Tibio", tone: "warm" };
  return { label: "Frío", tone: "cold" };
}
