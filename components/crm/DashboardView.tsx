import Link from "next/link";

import {
  formatDateTime,
  getDisplayName,
  getLeadStatusLabel,
  getLeadTemperatureLabel,
  summarizeText,
} from "@/lib/crm/format";
import {
  computeCRMStats,
  getConversationMap,
  getLastMessageMap,
  sortFollowUpsByDate,
} from "@/lib/crm/selectors";
import type {
  ConversationRecord,
  FollowUpRecord,
  MessageRecord,
} from "@/lib/types";

export function DashboardView({
  conversations,
  followUps,
  messages,
  loading,
}: {
  conversations: ConversationRecord[];
  followUps: FollowUpRecord[];
  messages: MessageRecord[];
  loading: boolean;
}) {
  const stats = computeCRMStats(conversations, followUps);
  const lastMessageMap = getLastMessageMap(messages);
  const conversationMap = getConversationMap(conversations);
  const hotLeads = conversations
    .filter((conversation) => conversation.lead_temperature === "hot")
    .slice(0, 5);
  const nextFollowUps = sortFollowUpsByDate(followUps).slice(0, 6);
  const recentConversations = conversations.slice(0, 6);

  return (
    <div className="workspace-stack">
      <section className="crm-panel operations-hero">
        <div>
          <span className="eyebrow">Pórtate Mal</span>
          <h2>Hola 👋 Vamos a ver cómo va el día</h2>
          <p>
            Aquí tienes el pulso del pipeline: quién está caliente, qué objeción
            tiene y cuál es el siguiente paso para llevarlo a la llamada con Germán.
          </p>
        </div>

        <div className="hero-actions">
          <Link className="button button-primary" href="/CRM/conversations">
            Abrir conversaciones
          </Link>
          <Link className="button button-secondary" href="/CRM/follow-ups">
            Revisar follow-ups
          </Link>
        </div>
      </section>

      <section className="metric-strip">
        <article className="metric-block">
          <span>Total conversaciones</span>
          <strong>{stats.totalConversations}</strong>
        </article>
        <article className="metric-block">
          <span>Leads calientes</span>
          <strong>{stats.hotLeads}</strong>
        </article>
        <article className="metric-block">
          <span>Seguimientos pendientes</span>
          <strong>{stats.pendingFollowUps}</strong>
        </article>
        <article className="metric-block">
          <span>Listos para comprar</span>
          <strong>{stats.readyToBuy}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="crm-panel list-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Hot Leads</span>
              <h3>Leads con mayor intención</h3>
            </div>
            <span className="panel-count">{hotLeads.length}</span>
          </div>

          {hotLeads.length === 0 ? (
            <p className="empty-state">
              {loading
                ? "Cargando señales comerciales…"
                : "Todavía no hay leads calientes. Cuando alguien pida la llamada con Germán, aparecerá aquí."}
            </p>
          ) : (
            <div className="stack-list">
              {hotLeads.map((conversation) => {
                const lastMessage = lastMessageMap.get(conversation.id);

                return (
                  <div className="list-row" key={conversation.id}>
                    <div>
                      <strong>{getDisplayName(conversation)}</strong>
                      <p>{conversation.phone_number}</p>
                    </div>

                    <div className="row-meta">
                      <span
                        className="badge"
                        data-tone={conversation.lead_temperature.toLowerCase()}
                      >
                        {getLeadTemperatureLabel(conversation.lead_temperature)}
                      </span>
                      <span className="row-preview">
                        {summarizeText(lastMessage?.content ?? conversation.last_summary)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="crm-panel list-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Agenda</span>
              <h3>Próximos seguimientos</h3>
            </div>
            <span className="panel-count">{nextFollowUps.length}</span>
          </div>

          {nextFollowUps.length === 0 ? (
            <p className="empty-state">Aún no hay seguimientos registrados.</p>
          ) : (
            <div className="stack-list">
              {nextFollowUps.map((followUp) => {
                const conversation = conversationMap.get(followUp.conversation_id);

                return (
                  <div className="list-row" key={followUp.id}>
                    <div>
                      <strong>{followUp.contact_name ?? "Contacto sin nombre"}</strong>
                      <p>{followUp.phone_number}</p>
                    </div>

                    <div className="row-meta">
                      <span className="badge" data-tone={followUp.priority.toLowerCase()}>
                        {followUp.priority}
                      </span>
                      <span className="row-preview">
                        {formatDateTime(followUp.follow_up_date)}
                      </span>
                      <span className="row-preview">
                        {conversation ? getLeadStatusLabel(conversation.lead_status) : "Nuevo"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <section className="crm-panel activity-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Actividad reciente</span>
            <h3>Últimas conversaciones</h3>
          </div>
        </div>

        {recentConversations.length === 0 ? (
          <p className="empty-state">No hay conversaciones guardadas todavía.</p>
        ) : (
          <div className="activity-list">
            {recentConversations.map((conversation) => {
              const lastMessage = lastMessageMap.get(conversation.id);

              return (
                <div className="activity-row" key={conversation.id}>
                  <div className="activity-primary">
                    <strong>{getDisplayName(conversation)}</strong>
                    <span>{conversation.phone_number}</span>
                  </div>
                  <div className="activity-secondary">
                    <span>{getLeadStatusLabel(conversation.lead_status)}</span>
                    <span>{summarizeText(lastMessage?.content ?? conversation.last_summary)}</span>
                  </div>
                  <div className="activity-tertiary">
                    <span>{getLeadTemperatureLabel(conversation.lead_temperature)}</span>
                    <span>{formatDateTime(conversation.last_contact_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
