import type {
  ConversationRecord,
  FollowUpRecord,
  MessageRecord,
} from "@/lib/types";

export function computeCRMStats(
  conversations: ConversationRecord[],
  followUps: FollowUpRecord[],
) {
  const pendingFollowUps = followUps.filter((followUp) => {
    const stage = followUp.stage.toLowerCase();
    return stage !== "won" && stage !== "lost";
  }).length;

  return {
    totalConversations: conversations.length,
    hotLeads: conversations.filter(
      (conversation) => conversation.lead_temperature === "hot",
    ).length,
    pendingFollowUps,
    readyToBuy: conversations.filter(
      (conversation) => conversation.lead_status === "ready_to_buy",
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
      return left.updated_at.localeCompare(right.updated_at);
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
