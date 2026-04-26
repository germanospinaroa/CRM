import type {
  ConversationRecord,
  FollowUpRecord,
  MessageRecord,
} from "@/lib/types";
import { isClosedLeadStatus, isReadyForCallStatus } from "@/lib/crm/format";

export function computeCRMStats(
  conversations: ConversationRecord[],
  followUps: FollowUpRecord[],
) {
  const pendingFollowUps = followUps.filter((followUp) => {
    return !isClosedLeadStatus(followUp.stage);
  }).length;

  return {
    totalConversations: conversations.length,
    hotLeads: conversations.filter(
      (conversation) => conversation.lead_temperature?.toLowerCase() === "hot",
    ).length,
    pendingFollowUps,
    readyToBuy: conversations.filter(
      (conversation) => isReadyForCallStatus(conversation.lead_status),
    ).length,
  };
}

export function getLastMessageMap(messages: MessageRecord[]) {
  const map = new Map<string, MessageRecord>();

  for (const message of messages) {
    map.set(message.conversation_id, message);
  }

  return map;
}

export function getConversationMessages(
  messages: MessageRecord[],
  conversationId: string,
) {
  return messages.filter((message) => message.conversation_id === conversationId);
}

export function getConversationMap(conversations: ConversationRecord[]) {
  return new Map(conversations.map((conversation) => [conversation.id, conversation]));
}

export function sortFollowUpsByDate(followUps: FollowUpRecord[]) {
  return [...followUps].sort((left, right) => {
    if (!left.follow_up_date && !right.follow_up_date) {
      return right.updated_at.localeCompare(left.updated_at);
    }

    if (!left.follow_up_date) {
      return 1;
    }

    if (!right.follow_up_date) {
      return -1;
    }

    return left.follow_up_date.localeCompare(right.follow_up_date);
  });
}
