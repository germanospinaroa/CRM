export type MessageRole = "user" | "assistant" | "system";
export type LeadTemperature = "cold" | "warm" | "hot";

// Estados extendidos del lead (acuerdo con actualizaciones_crm.md)
export type LeadStatus =
  | "new"
  | "conversing"
  | "qualified"
  | "warm"
  | "hot"
  | "ready_for_call"
  | "call_scheduled"
  | "follow_up_pending"
  | "not_qualified"
  | "closed"
  | "lost"
  | "customer"
  // Mantenidos para compatibilidad con datos previos
  | "qualifying"
  | "nurturing"
  | "ready_to_buy"
  | "won";

export type LeadPriority = "low" | "medium" | "high" | "urgent";
export type FollowUpPriority = "low" | "medium" | "high";

export interface ConversationRecord {
  id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  lead_status: string;
  lead_temperature: string;
  lead_priority: string;
  lead_score: number;
  lead_source: string | null;
  ai_enabled: boolean;
  current_intent: string | null;
  desired_product: string | null;
  budget_range: string | null;
  objections: string | null;
  last_summary: string | null;
  next_step: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  is_manual: boolean;
  created_at: string;
}

export interface FollowUpRecord {
  id: string;
  conversation_id: string;
  phone_number: string;
  contact_name: string | null;
  summary: string;
  desired_product: string | null;
  customer_need: string | null;
  stage: string;
  priority: string;
  next_step: string | null;
  recommended_action: string | null;
  follow_up_date: string | null;
  last_agent_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadEventRecord {
  id: string;
  conversation_id: string;
  event_type: string;
  event_value: string | null;
  created_at: string;
}

export interface LeadEventInput {
  eventType: string;
  eventValue: string | null;
}

export interface AppSettingRecord {
  key: string;
  value: string;
  updated_at: string;
}

export interface SalesBrainAnalysis {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  customerNeed: string | null;
  desiredProduct: string | null;
  budgetRange: string | null;
  urgency: string | null;
  objections: string[];
  leadTemperature: LeadTemperature;
  leadStage: LeadStatus;
  leadScore: number;
  intentLevel: string;
  summary: string;
  nextBestAction: string;
  recommendedFollowUpMessage: string;
  followUpNeeded: boolean;
  followUpPriority: FollowUpPriority;
  followUpInHours: number | null;
  events: LeadEventInput[];
}

export interface ParsedWhatsAppMessage {
  phoneNumber: string;
  text: string;
  profileName: string | null;
  rawMessageId: string | null;
}
