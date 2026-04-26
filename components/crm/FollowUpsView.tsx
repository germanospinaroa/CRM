"use client";

import { useDeferredValue, useEffect, useState } from "react";

import {
  formatDate,
  formatDateTime,
  getDisplayName,
  getFollowUpPriorityLabel,
  getLeadStatusLabel,
  LEAD_STATUS_OPTIONS,
} from "@/lib/crm/format";
import { getConversationMap, sortFollowUpsByDate } from "@/lib/crm/selectors";
import type { ConversationRecord, FollowUpRecord } from "@/lib/types";

function toDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
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

        <div className="table-wrap">
          {filteredFollowUps.length === 0 ? (
            <p className="empty-state" style={{ padding: "1.2rem" }}>
              {loading
                ? "Cargando seguimiento comercial…"
                : "Aún no hay leads en seguimiento. Cuando Valentina califique a alguien, aparecerá aquí."}
            </p>
          ) : (
            <table className="follow-up-table">
              <thead>
                <tr>
                  <th>Phone number</th>
                  <th>First name</th>
                  <th>Last name</th>
                  <th>Full name</th>
                  <th>Desired product</th>
                  <th>Customer need</th>
                  <th>Summary</th>
                  <th>Stage</th>
                  <th>Priority</th>
                  <th>Next step</th>
                  <th>Recommended action</th>
                  <th>Follow-up date</th>
                  <th>Last contact</th>
                </tr>
              </thead>
              <tbody>
                {filteredFollowUps.map((followUp) => {
                  const conversation = conversationMap.get(followUp.conversation_id);
                  const isSelected = selectedFollowUp?.id === followUp.id;

                  return (
                    <tr
                      className="follow-up-row"
                      data-selected={isSelected}
                      key={followUp.id}
                      onClick={() => setSelectedFollowUpId(followUp.id)}
                    >
                      <td>{followUp.phone_number}</td>
                      <td>{conversation?.first_name ?? "Faltante"}</td>
                      <td>{conversation?.last_name ?? "Faltante"}</td>
                      <td>{getDisplayName(conversation ?? { full_name: followUp.contact_name })}</td>
                      <td>{followUp.desired_product ?? "Sin definir"}</td>
                      <td>{followUp.customer_need ?? "Sin definir"}</td>
                      <td>{followUp.summary}</td>
                      <td>{getLeadStatusLabel(followUp.stage)}</td>
                      <td>{getFollowUpPriorityLabel(followUp.priority)}</td>
                      <td>{followUp.next_step ?? "Pendiente"}</td>
                      <td>{followUp.recommended_action ?? "Pendiente"}</td>
                      <td>{formatDate(followUp.follow_up_date)}</td>
                      <td>{formatDateTime(conversation?.last_contact_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="crm-panel follow-up-detail-panel">
        {selectedFollowUp && selectedConversation ? (
          <>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Lead Inspector</span>
                <h3>{getDisplayName(selectedConversation)}</h3>
              </div>
              <span className="detail-phone">{selectedFollowUp.phone_number}</span>
            </div>

            <div className="detail-grid">
              <div>
                <dt>Resumen</dt>
                <dd>{selectedFollowUp.summary}</dd>
              </div>
              <div>
                <dt>Need detectada</dt>
                <dd>{selectedFollowUp.customer_need ?? "Sin definir"}</dd>
              </div>
              <div>
                <dt>Producto</dt>
                <dd>{selectedFollowUp.desired_product ?? "Sin definir"}</dd>
              </div>
              <div>
                <dt>Mensaje sugerido</dt>
                <dd>{selectedFollowUp.last_agent_note ?? "Sin mensaje sugerido"}</dd>
              </div>
            </div>

            <div className="editor-grid">
              <label className="field">
                <span>Stage</span>
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
                <span>Priority</span>
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
                <span>Follow-up date</span>
                <input
                  className="field-input"
                  onChange={(event) => setDraftFollowUpDate(event.target.value)}
                  type="date"
                  value={draftFollowUpDate}
                />
              </label>

              <label className="field field-full">
                <span>Next step</span>
                <textarea
                  className="field-input field-textarea"
                  onChange={(event) => setDraftNextStep(event.target.value)}
                  rows={3}
                  value={draftNextStep}
                />
              </label>

              <label className="field field-full">
                <span>Summary</span>
                <textarea
                  className="field-input field-textarea"
                  onChange={(event) => setDraftSummary(event.target.value)}
                  rows={4}
                  value={draftSummary}
                />
              </label>

              <label className="field field-full">
                <span>Recommended action</span>
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
