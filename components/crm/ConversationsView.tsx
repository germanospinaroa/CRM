"use client";

import { useDeferredValue, useState } from "react";

import { LeadDetailPanel } from "@/components/crm/LeadDetailPanel";
import {
  formatDateTime,
  getDisplayName,
  getLeadStatusLabel,
  getLeadTemperatureLabel,
  summarizeText,
} from "@/lib/crm/format";
import {
  getConversationMessages,
  getLastMessageMap,
} from "@/lib/crm/selectors";
import type {
  ConversationRecord,
  FollowUpRecord,
  MessageRecord,
} from "@/lib/types";

export function ConversationsView({
  conversations,
  messages,
  followUps,
  loading,
  selectedConversationId,
  onSelectConversation,
  onToggleAiEnabled,
}: {
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  followUps: FollowUpRecord[];
  loading: boolean;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onToggleAiEnabled: (conversationId: string, enabled: boolean) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const lastMessageMap = getLastMessageMap(messages);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredConversations = conversations.filter((conversation) => {
    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      conversation.phone_number,
      conversation.full_name,
      conversation.first_name,
      conversation.last_name,
      conversation.desired_product,
      conversation.last_summary,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const selectedConversation =
    filteredConversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? filteredConversations[0] ?? null;
  const selectedMessages = selectedConversation
    ? getConversationMessages(messages, selectedConversation.id)
    : [];
  const selectedFollowUp = selectedConversation
    ? followUps.find((followUp) => followUp.conversation_id === selectedConversation.id) ??
      null
    : null;

  return (
    <div className="conversation-layout">
      <section className="crm-panel conversation-list-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Bandeja</span>
            <h3>Conversaciones</h3>
          </div>
          <span className="panel-count">{filteredConversations.length}</span>
        </div>

        <label className="field search-field">
          <span>Buscar</span>
          <input
            className="field-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, teléfono o producto"
            type="search"
            value={query}
          />
        </label>

        <div className="conversation-list">
          {filteredConversations.length === 0 ? (
            <p className="empty-state">
              {loading
                ? "Cargando conversaciones…"
                : "Aún no hay conversaciones. Cuando llegue un mensaje de WhatsApp, aparecerá aquí."}
            </p>
          ) : (
            filteredConversations.map((conversation) => {
              const lastMessage = lastMessageMap.get(conversation.id);
              const isSelected = selectedConversation?.id === conversation.id;

              return (
                <button
                  className="conversation-item"
                  data-selected={isSelected}
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  type="button"
                >
                  <div className="conversation-item-headline">
                    <strong className="conversation-contact-name">
                      {getDisplayName(conversation)}
                    </strong>
                    <span className="conversation-contact-phone">
                      {conversation.phone_number}
                    </span>
                  </div>

                  <p className="conversation-item-preview">
                    {summarizeText(lastMessage?.content ?? conversation.last_summary)}
                  </p>

                  <div className="conversation-item-meta">
                    <span
                      className="badge"
                      data-tone={conversation.lead_temperature.toLowerCase()}
                    >
                      {getLeadTemperatureLabel(conversation.lead_temperature)}
                    </span>
                    <span className="badge badge-muted">
                      {getLeadStatusLabel(conversation.lead_status)}
                    </span>
                    <span
                      className="badge"
                      data-tone={conversation.ai_enabled ? "default" : "warning"}
                    >
                      {conversation.ai_enabled ? "IA" : "Manual"}
                    </span>
                    <span className="conversation-item-date">
                      {formatDateTime(conversation.last_contact_at)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="conversation-main">
        {selectedConversation ? (
          <div className="conversation-workspace">
            <article className="crm-panel chat-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Chat</span>
                  <h3>{getDisplayName(selectedConversation)}</h3>
                </div>
                <div className="chat-meta">
                  <span>{selectedConversation.phone_number}</span>
                  <span>{formatDateTime(selectedConversation.last_contact_at)}</span>
                </div>
              </div>

              <div className="chat-actions">
                <button
                  className="button button-secondary"
                  onClick={async () => {
                    setTogglingId(selectedConversation.id);
                    await onToggleAiEnabled(
                      selectedConversation.id,
                      !selectedConversation.ai_enabled
                    );
                    setTogglingId(null);
                  }}
                  disabled={togglingId === selectedConversation.id}
                  type="button"
                  title={
                    selectedConversation.ai_enabled
                      ? "Desactiva Valentina (tomar control manual)"
                      : "Activa Valentina (automatizado)"
                  }
                >
                  {togglingId === selectedConversation.id
                    ? "Cambiando…"
                    : selectedConversation.ai_enabled
                      ? "Tomar control"
                      : "Activar IA"}
                </button>
                <span
                  className="status-indicator"
                  data-state={
                    selectedConversation.ai_enabled ? "auto" : "manual"
                  }
                >
                  {selectedConversation.ai_enabled ? "IA activa" : "Control manual"}
                </span>
              </div>

              <div className="chat-thread">
                {selectedMessages.length === 0 ? (
                  <p className="empty-state">No hay mensajes guardados para este lead.</p>
                ) : (
                  selectedMessages.map((message) => {
                    const role =
                      message.role === "assistant" ? "assistant" : "user";
                    return (
                      <article
                        className="message-row"
                        data-role={role}
                        key={message.id}
                      >
                        <div className="message-label">
                          {role === "assistant" ? "Valentina" : "Lead"}
                        </div>
                        <div className="message-bubble" data-role={role}>
                          <p>{message.content}</p>
                          <span>{formatDateTime(message.created_at)}</span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </article>

            <LeadDetailPanel
              conversation={selectedConversation}
              followUp={selectedFollowUp}
            />
          </div>
        ) : (
          <section className="crm-panel empty-panel">
            <div className="empty-panel-content">
              <strong>Sin conversación seleccionada</strong>
              <p>
                Elige una conversación de la izquierda para ver el chat con
                Valentina y el detalle del lead.
              </p>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
