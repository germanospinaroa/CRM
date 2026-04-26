"use client";

import { useDeferredValue, useEffect, useState } from "react";

import {
  formatDate,
  getDisplayName,
  getFollowUpPriorityLabel,
  getFollowUpPriorityTone,
  getLeadStatusLabel,
  getLeadStatusTone,
  getLeadTemperatureLabel,
  LEAD_STATUS_OPTIONS,
  summarizeText,
} from "@/lib/crm/format";
import { getConversationMap, sortFollowUpsByDate } from "@/lib/crm/selectors";
import type { ConversationRecord, FollowUpRecord } from "@/lib/types";

function toDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function FollowUpsView({
  conversations,
  followUps,
  loading,
  onUpdateFollowUp,
}: {
  conversations: ConversationRecord[];
  followUps: FollowUpRecord[];
  loading: boolean;
  onUpdateFollowUp: (
    followUpId: string,
    patch: Partial<
      Pick<
        FollowUpRecord,
        "stage" | "priority" | "next_step" | "follow_up_date" | "summary" | "recommended_action"
      >
    >,
  ) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(null);
  const [draftStage, setDraftStage] = useState("new");
  const [draftPriority, setDraftPriority] = useState("medium");
  const [draftNextStep, setDraftNextStep] = useState("");
  const [draftFollowUpDate, setDraftFollowUpDate] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftRecommendedAction, setDraftRecommendedAction] = useState("");
  const [saving, setSaving] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const conversationMap = getConversationMap(conversations);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredFollowUps = sortFollowUpsByDate(followUps).filter((followUp) => {
    if (!normalizedQuery) {
      return true;
    }

    const conversation = conversationMap.get(followUp.conversation_id);
    const haystack = [
      followUp.phone_number,
      followUp.contact_name,
      followUp.desired_product,
      followUp.customer_need,
      followUp.summary,
      conversation?.first_name,
      conversation?.last_name,
      conversation?.full_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  useEffect(() => {
    if (filteredFollowUps.length === 0) {
      setSelectedFollowUpId(null);
      return;
    }

    if (
      !selectedFollowUpId ||
      !filteredFollowUps.some((followUp) => followUp.id === selectedFollowUpId)
    ) {
      setSelectedFollowUpId(filteredFollowUps[0]?.id ?? null);
    }
  }, [filteredFollowUps, selectedFollowUpId]);

  const selectedFollowUp =
    filteredFollowUps.find((followUp) => followUp.id === selectedFollowUpId) ?? null;
  const selectedConversation = selectedFollowUp
    ? conversationMap.get(selectedFollowUp.conversation_id) ?? null
    : null;

  useEffect(() => {
    if (!selectedFollowUp) {
      return;
    }

    setDraftStage(selectedFollowUp.stage);
    setDraftPriority(selectedFollowUp.priority);
    setDraftNextStep(selectedFollowUp.next_step ?? "");
    setDraftFollowUpDate(toDateInput(selectedFollowUp.follow_up_date));
    setDraftSummary(selectedFollowUp.summary);
    setDraftRecommendedAction(selectedFollowUp.recommended_action ?? "");
  }, [selectedFollowUp]);

  async function handleSave() {
    if (!selectedFollowUp) {
      return;
    }

    setSaving(true);

    await onUpdateFollowUp(selectedFollowUp.id, {
      stage: draftStage,
      priority: draftPriority,
      next_step: draftNextStep || null,
      follow_up_date: draftFollowUpDate
        ? new Date(`${draftFollowUpDate}T09:00:00.000Z`).toISOString()
        : null,
      summary: draftSummary,
      recommended_action: draftRecommendedAction || null,
    });

    setSaving(false);
  }

  return (
    <div className="follow-up-layout">
      <section className="crm-panel follow-up-table-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Follow-ups</span>
            <h3>Seguimiento comercial por contacto</h3>
          </div>
          <span className="panel-count">{filteredFollowUps.length}</span>
        </div>

        <label className="field search-field">
          <span>Buscar</span>
          <input
            className="field-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, telefono, necesidad o producto"
            type="search"
            value={query}
          />
        </label>

        <div className="follow-up-list">
          {filteredFollowUps.length === 0 ? (
            <p className="empty-state">
              {loading
                ? "Cargando seguimiento comercial…"
                : "Aún no hay leads en seguimiento. Cuando Valentina califique a alguien, aparecerá aquí."}
            </p>
          ) : (
            filteredFollowUps.map((followUp) => {
              const conversation = conversationMap.get(followUp.conversation_id);
              const isSelected = selectedFollowUp?.id === followUp.id;

              return (
                <button
                  className="follow-up-card"
                  data-selected={isSelected}
                  key={followUp.id}
                  onClick={() => setSelectedFollowUpId(followUp.id)}
                  type="button"
                >
                  <div className="follow-up-card-head">
                    <div>
                      <strong>
                        {getDisplayName(
                          conversation ?? { full_name: followUp.contact_name },
                        )}
                      </strong>
                      <span>{followUp.phone_number}</span>
                    </div>
                    <span
                      className="badge"
                      data-tone={getFollowUpPriorityTone(followUp.priority)}
                    >
                      {getFollowUpPriorityLabel(followUp.priority)}
                    </span>
                  </div>

                  <p>{summarizeText(followUp.summary, 128)}</p>

                  <div className="follow-up-card-meta">
                    <span
                      className="badge"
                      data-tone={getLeadStatusTone(followUp.stage)}
                    >
                      {getLeadStatusLabel(followUp.stage)}
                    </span>
                    {conversation ? (
                      <span
                        className="badge"
                        data-tone={
                          conversation.lead_temperature?.toLowerCase() ?? "cold"
                        }
                      >
                        {getLeadTemperatureLabel(conversation.lead_temperature)}
                      </span>
                    ) : null}
                    <span>{formatDate(followUp.follow_up_date)}</span>
                  </div>

                  <div className="follow-up-next-step">
                    {followUp.next_step ?? followUp.recommended_action ?? "Definir siguiente acción"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="crm-panel follow-up-detail-panel">
        {selectedFollowUp ? (
          <>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Detalle</span>
                <h3>
                  {getDisplayName(
                    selectedConversation ?? {
                      full_name: selectedFollowUp.contact_name,
                    },
                  )}
                </h3>
                <div className="detail-header-meta">
                  <span
                    className="badge"
                    data-tone={getLeadStatusTone(selectedFollowUp.stage)}
                  >
                    {getLeadStatusLabel(selectedFollowUp.stage)}
                  </span>
                  <span
                    className="badge"
                    data-tone={getFollowUpPriorityTone(selectedFollowUp.priority)}
                  >
                    {getFollowUpPriorityLabel(selectedFollowUp.priority)}
                  </span>
                </div>
              </div>
              <span className="detail-phone">{selectedFollowUp.phone_number}</span>
            </div>

            <div className="detail-grid">
              <div>
                <dt>Resumen comercial</dt>
                <dd>{selectedFollowUp.summary}</dd>
              </div>
              <div>
                <dt>Necesidad detectada</dt>
                <dd>{selectedFollowUp.customer_need ?? "Sin definir"}</dd>
              </div>
              <div>
                <dt>Producto o servicio de interés</dt>
                <dd>{selectedFollowUp.desired_product ?? "Sin definir"}</dd>
              </div>
              <div>
                <dt>Mensaje sugerido</dt>
                <dd>{selectedFollowUp.last_agent_note ?? "Sin mensaje sugerido"}</dd>
              </div>
            </div>

            <div className="editor-grid">
              <label className="field">
                <span>Estado</span>
                <select
                  className="field-input"
                  onChange={(event) => setDraftStage(event.target.value)}
                  value={draftStage}
                >
                  {LEAD_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Prioridad</span>
                <select
                  className="field-input"
                  onChange={(event) => setDraftPriority(event.target.value)}
                  value={draftPriority}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </label>

              <label className="field">
                <span>Fecha de seguimiento</span>
                <input
                  className="field-input"
                  onChange={(event) => setDraftFollowUpDate(event.target.value)}
                  type="date"
                  value={draftFollowUpDate}
                />
              </label>

              <label className="field field-full">
                <span>Siguiente acción</span>
                <textarea
                  className="field-input field-textarea"
                  onChange={(event) => setDraftNextStep(event.target.value)}
                  rows={3}
                  value={draftNextStep}
                />
              </label>

              <label className="field field-full">
                <span>Resumen</span>
                <textarea
                  className="field-input field-textarea"
                  onChange={(event) => setDraftSummary(event.target.value)}
                  rows={4}
                  value={draftSummary}
                />
              </label>

              <label className="field field-full">
                <span>Acción recomendada</span>
                <textarea
                  className="field-input field-textarea"
                  onChange={(event) => setDraftRecommendedAction(event.target.value)}
                  rows={3}
                  value={draftRecommendedAction}
                />
              </label>
            </div>

            <button
              className="button button-primary"
              disabled={saving}
              onClick={() => void handleSave()}
              type="button"
            >
              {saving ? "Guardando..." : "Guardar seguimiento"}
            </button>
          </>
        ) : (
          <div className="empty-panel-content" style={{ margin: "auto" }}>
            <strong>Sin lead seleccionado</strong>
            <p>Elige un lead de la tabla para editar su seguimiento.</p>
          </div>
        )}
      </section>
    </div>
  );
}
