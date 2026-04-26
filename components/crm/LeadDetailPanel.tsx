"use client";

import { useState } from "react";

import {
  formatDateTime,
  getDisplayName,
  getLeadStatusLabel,
  getLeadTemperatureLabel,
} from "@/lib/crm/format";
import type { ConversationRecord, FollowUpRecord } from "@/lib/types";

export function LeadDetailPanel({
  conversation,
  followUp,
}: {
  conversation: ConversationRecord;
  followUp: FollowUpRecord | null;
}) {
  const [copied, setCopied] = useState(false);
  const suggestedMessage = followUp?.last_agent_note ?? null;

  async function handleCopy() {
    if (!suggestedMessage) return;
    try {
      await navigator.clipboard.writeText(suggestedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="crm-panel detail-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Lead</span>
          <h3>{getDisplayName(conversation)}</h3>
          <div className="detail-header-meta">
            <span
              className="badge"
              data-tone={conversation.lead_temperature.toLowerCase()}
            >
              {getLeadTemperatureLabel(conversation.lead_temperature)}
            </span>
            <span className="badge badge-muted">
              {getLeadStatusLabel(conversation.lead_status)}
            </span>
          </div>
        </div>
        <span className="detail-phone">{conversation.phone_number}</span>
      </div>

      <dl className="detail-grid">
        <div className="detail-card-hero">
          <dt>Mensaje sugerido para enviar</dt>
          <dd>
            {suggestedMessage ?? "Aún no hay mensaje sugerido para este lead."}
          </dd>
          {suggestedMessage ? (
            <div className="detail-card-action">
              <button
                className="button button-secondary"
                onClick={() => void handleCopy()}
                type="button"
              >
                {copied ? "✓ Copiado" : "Copiar mensaje"}
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <dt>Resumen comercial</dt>
          <dd>{conversation.last_summary ?? "Aún no hay resumen comercial."}</dd>
        </div>
        <div>
          <dt>Producto / interés</dt>
          <dd>{conversation.desired_product ?? "Sin definir"}</dd>
        </div>
        <div>
          <dt>Objeciones</dt>
          <dd>{conversation.objections ?? "Sin objeciones detectadas"}</dd>
        </div>
        <div>
          <dt>Siguiente mejor acción</dt>
          <dd>{conversation.next_step ?? "Pendiente de análisis"}</dd>
        </div>
        <div>
          <dt>Último contacto</dt>
          <dd>{formatDateTime(conversation.last_contact_at)}</dd>
        </div>
      </dl>
    </section>
  );
}
