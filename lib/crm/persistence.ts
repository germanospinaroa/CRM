import "server-only";

import {
  addHours,
  cleanNullableText,
  composeFullName,
  normalizeMissingValue,
  splitFullName,
} from "@/lib/crm/format";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import type {
  ConversationRecord,
  LeadEventInput,
  MessageRecord,
  MessageRole,
  SalesBrainAnalysis,
} from "@/lib/types";

export async function findOrCreateConversation(input: {
  phoneNumber: string;
  profileName?: string | null;
}) {
  const supabase = getServiceSupabaseClient();
  const { data: existing, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("phone_number", input.phoneNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const now = new Date().toISOString();
  const profileName = cleanNullableText(input.profileName);
  const profileParts = splitFullName(profileName);

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      last_contact_at: now,
      updated_at: now,
    };

    if (!existing.full_name && profileName) {
      updatePayload.full_name = profileName;
    }

    if (!existing.first_name && profileParts.firstName) {
      updatePayload.first_name = profileParts.firstName;
    }

    if (!existing.last_name && profileParts.lastName) {
      updatePayload.last_name = profileParts.lastName;
    }

    const { data: updated, error: updateError } = await supabase
      .from("conversations")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return updated as ConversationRecord;
  }

  const { data, error: insertError } = await supabase
    .from("conversations")
    .insert({
      phone_number: input.phoneNumber,
      full_name: profileName,
      first_name: profileParts.firstName,
      last_name: profileParts.lastName,
      last_contact_at: now,
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return data as ConversationRecord;
}

export async function saveMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
}) {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as MessageRecord;
}

export async function loadConversationMessages(conversationId: string, limit = 30) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as MessageRecord[];
}

export async function syncLeadFromAnalysis(input: {
  conversation: ConversationRecord;
  analysis: SalesBrainAnalysis;
}) {
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();
  const actualFirstName =
    normalizeMissingValue(input.analysis.firstName) ?? input.conversation.first_name;
  const actualLastName =
    normalizeMissingValue(input.analysis.lastName) ?? input.conversation.last_name;
  const actualFullName =
    normalizeMissingValue(input.analysis.fullName) ??
    input.conversation.full_name ??
    composeFullName(actualFirstName, actualLastName);

  const conversationPatch = {
    first_name: actualFirstName,
    last_name: actualLastName,
    full_name: actualFullName,
    lead_status: input.analysis.leadStage,
    lead_temperature: input.analysis.leadTemperature,
    current_intent: input.analysis.intentLevel,
    desired_product:
      normalizeMissingValue(input.analysis.desiredProduct) ??
      input.conversation.desired_product,
    budget_range:
      normalizeMissingValue(input.analysis.budgetRange) ??
      input.conversation.budget_range,
    objections:
      input.analysis.objections.length > 0
        ? input.analysis.objections.join(" | ")
        : input.conversation.objections,
    last_summary: input.analysis.summary,
    next_step: input.analysis.nextBestAction,
    last_contact_at: now,
    updated_at: now,
  };

  const { data: updatedConversation, error: conversationError } = await supabase
    .from("conversations")
    .update(conversationPatch)
    .eq("id", input.conversation.id)
    .select("*")
    .single();

  if (conversationError) {
    throw conversationError;
  }

  const followUpDate =
    input.analysis.followUpNeeded && input.analysis.followUpInHours !== null
      ? addHours(new Date(), input.analysis.followUpInHours).toISOString()
      : null;

  const followUpPayload = {
    conversation_id: input.conversation.id,
    phone_number: input.conversation.phone_number,
    contact_name: actualFullName,
    summary: input.analysis.summary,
    desired_product:
      normalizeMissingValue(input.analysis.desiredProduct) ??
      input.conversation.desired_product,
    customer_need: normalizeMissingValue(input.analysis.customerNeed),
    stage: input.analysis.leadStage,
    priority: input.analysis.followUpPriority,
    next_step: input.analysis.nextBestAction,
    recommended_action: input.analysis.nextBestAction,
    follow_up_date: followUpDate,
    last_agent_note: input.analysis.recommendedFollowUpMessage,
    updated_at: now,
  };

  const { data: existingFollowUp, error: existingFollowUpError } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("conversation_id", input.conversation.id)
    .maybeSingle();

  if (existingFollowUpError) {
    throw existingFollowUpError;
  }

  if (existingFollowUp) {
    const { error: updateFollowUpError } = await supabase
      .from("follow_ups")
      .update(followUpPayload)
      .eq("conversation_id", input.conversation.id);

    if (updateFollowUpError) {
      throw updateFollowUpError;
    }
  } else {
    const { error: insertFollowUpError } = await supabase
      .from("follow_ups")
      .insert(followUpPayload);

    if (insertFollowUpError) {
      throw insertFollowUpError;
    }
  }

  return {
    conversation: updatedConversation as ConversationRecord,
  };
}

export async function saveLeadEvents(
  conversationId: string,
  events: LeadEventInput[],
) {
  const supabase = getServiceSupabaseClient();
  const normalizedEvents = events
    .filter((event) => cleanNullableText(event.eventType))
    .map((event) => ({
      conversation_id: conversationId,
      event_type: event.eventType,
      event_value: cleanNullableText(event.eventValue),
    }));

  if (normalizedEvents.length === 0) {
    return;
  }

  const { error } = await supabase.from("lead_events").insert(normalizedEvents);

  if (error) {
    throw error;
  }
}
