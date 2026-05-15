"use client";

import { useEffect, useState } from "react";

import { buildSupabaseAuthHeaders } from "@/lib/supabase/auth-headers";
import type { AutomationConfig } from "@/lib/types";

interface PromptDiagnostics {
  agentName: string;
  key: string;
  value: string | null;
  updatedAt: string | null;
  promptId: string;
  version: string;
  promptChars: number;
  source: "database" | "environment" | "local_file" | "hardcoded";
  sourceLabel: string;
  isFallback?: boolean;
  preview: string;
  diagnostics?: {
    storageValueChars: number;
    isUsingStorageValue: boolean;
  };
  error?: string;
}

interface PromptTestResult {
  ok: boolean;
  error: string | null;
  model: string;
  inputMessage: string;
  response: string | null;
  prompt: {
    promptId: string;
    sourceLabel: string;
    version: string;
  };
}

interface AutomationConfigResponse {
  key: string;
  value: string | null;
  updatedAt: string | null;
}

const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  enabled: true,
  maxMessagesPerRun: 12,
  minHoursSinceLastInbound: 12,
  businessHoursStart: 8,
  businessHoursEnd: 19,
  allowedWeekdays: [1, 2, 3, 4, 5, 6],
  dailyLimit: 3,
  requireAiEnabled: true,
  attemptIntervalsHours: [4, 24, 72, 168, 336],
};

function getSettingsApiBasePath() {
  if (typeof window === "undefined") {
    return "/api";
  }

  return window.location.pathname.startsWith("/CRM") ? "/CRM/api" : "/api";
}

export function SettingsView() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PromptDiagnostics | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [testMessage, setTestMessage] = useState("¿Cuánto cuesta?");
  const [testingPrompt, setTestingPrompt] = useState(false);
  const [testResult, setTestResult] = useState<PromptTestResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig>(
    DEFAULT_AUTOMATION_CONFIG,
  );
  const [automationLoading, setAutomationLoading] = useState(true);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationRunResult, setAutomationRunResult] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [statusMessage, setStatusMessage] = useState("");

  async function loadPromptDiagnostics() {
    try {
      setDiagnosticLoading(true);
      const apiBasePath = getSettingsApiBasePath();
      const response = await fetch(
        `${apiBasePath}/settings?key=valentina_prompt&diagnostics=true`,
        {
          cache: "no-store",
          headers: await buildSupabaseAuthHeaders(),
        }
      );
      const data = (await response.json()) as PromptDiagnostics;

      if (data.error) {
        setStatus("error");
        setStatusMessage(data.error);
      } else {
        setPrompt(data.value || "");
        setDiagnostics(data);
      }
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Error al cargar el prompt"
      );
    } finally {
      setDiagnosticLoading(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPromptDiagnostics();
    void loadAutomationConfig();
  }, []);

  async function loadAutomationConfig() {
    try {
      setAutomationLoading(true);
      const apiBasePath = getSettingsApiBasePath();
      const response = await fetch(
        `${apiBasePath}/settings?key=automation_config`,
        {
          cache: "no-store",
          headers: await buildSupabaseAuthHeaders(),
        },
      );
      const data = (await response.json()) as AutomationConfigResponse & {
        error?: string;
      };

      if (data.error) {
        setAutomationConfig(DEFAULT_AUTOMATION_CONFIG);
        return;
      }

      if (!data.value) {
        setAutomationConfig(DEFAULT_AUTOMATION_CONFIG);
        return;
      }

      setAutomationConfig({
        ...DEFAULT_AUTOMATION_CONFIG,
        ...(JSON.parse(data.value) as Partial<AutomationConfig>),
      });
    } catch {
      setAutomationConfig(DEFAULT_AUTOMATION_CONFIG);
    } finally {
      setAutomationLoading(false);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    setStatus("saving");

    try {
      const apiBasePath = getSettingsApiBasePath();
      const response = await fetch(`${apiBasePath}/settings`, {
        method: "POST",
        headers: await buildSupabaseAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          key: "valentina_prompt",
          value: prompt,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (data.error) {
        setStatus("error");
        setStatusMessage(data.error);
      } else {
        await loadPromptDiagnostics();
        setStatus("saved");
        setStatusMessage("Cambios guardados correctamente");
        setTimeout(() => setStatus("idle"), 2000);
      }
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Error al guardar"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReloadActiveConfig = async () => {
    await loadPromptDiagnostics();
    setStatus("saved");
    setStatusMessage("Configuración activa recargada correctamente.");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const handleCopyPrompt = async () => {
    const currentPrompt = diagnostics?.value ?? "";
    if (!currentPrompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 1800);
    } catch {
      setCopiedPrompt(false);
      setStatus("error");
      setStatusMessage("No se pudo copiar el prompt activo.");
    }
  };

  const handlePromptTest = async () => {
    setTestingPrompt(true);
    setTestResult(null);

    try {
      const apiBasePath = getSettingsApiBasePath();
      const response = await fetch(`${apiBasePath}/settings/diagnostics`, {
        method: "POST",
        headers: await buildSupabaseAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          message: testMessage,
        }),
      });

      const data = (await response.json()) as PromptTestResult & {
        error?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setStatusMessage(data.error || "No se pudo probar el prompt");
      } else {
        setTestResult(data);
      }
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "No se pudo probar el prompt"
      );
    } finally {
      setTestingPrompt(false);
    }
  };

  const handleAutomationSave = async () => {
    setAutomationSaving(true);

    try {
      const apiBasePath = getSettingsApiBasePath();
      const response = await fetch(`${apiBasePath}/settings`, {
        method: "POST",
        headers: await buildSupabaseAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          key: "automation_config",
          value: automationConfig,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (data.error || !response.ok) {
        setStatus("error");
        setStatusMessage(data.error ?? "No se pudo guardar la automatización.");
        return;
      }

      setStatus("saved");
      setStatusMessage("Reglas de automatización guardadas.");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "No se pudo guardar la automatización.",
      );
    } finally {
      setAutomationSaving(false);
    }
  };

  const handleAutomationRun = async () => {
    setAutomationRunning(true);
    setAutomationRunResult(null);
    try {
      const apiBasePath = getSettingsApiBasePath();
      const response = await fetch(`${apiBasePath}/automation/run`, {
        method: "POST",
        headers: await buildSupabaseAuthHeaders(),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        processed?: number;
        skipped?: number;
        reason?: string | null;
        error?: string;
      };

      if (!response.ok || data.ok === false) {
        setAutomationRunResult(data.error ?? "No se pudo ejecutar la automatización.");
        return;
      }

      setAutomationRunResult(
        `Procesados: ${data.processed ?? 0} · Omitidos: ${data.skipped ?? 0}${
          data.reason ? ` · Motivo: ${data.reason}` : ""
        }`,
      );
    } catch (error) {
      setAutomationRunResult(
        error instanceof Error ? error.message : "No se pudo ejecutar la automatización.",
      );
    } finally {
      setAutomationRunning(false);
    }
  };

  const formattedUpdatedAt = diagnostics?.updatedAt
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(diagnostics.updatedAt))
    : "Sin fecha";

  if (loading) {
    return (
      <div className="settings-view">
        <div className="settings-section">
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <div className="settings-section">
        <h3>Cerebro de Valentina (Prompt)</h3>
        <p className="settings-description">
          Edita el prompt que usa Valentina para responder. Los cambios se
          aplican inmediatamente sin necesidad de redeploy.
        </p>

        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="prompt">Prompt del sistema</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder="Ingresa el prompt del sistema para Valentina"
              rows={20}
              disabled={saving}
              className="form-textarea"
            />
            <small className="form-hint">
              Caracteres: {prompt.length}
            </small>
          </div>

          <div className="form-actions">
            <button
              onClick={handleSave}
              disabled={saving}
              className="button button-primary"
              type="button"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>

            {status === "saved" && (
              <div className="status-message status-success">
                ✓ {statusMessage}
              </div>
            )}

            {status === "error" && (
              <div className="status-message status-error">
                ✗ {statusMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Diagnóstico de Valentina</h3>
        <p className="settings-description">
          Verifica exactamente qué prompt está activo y desde qué fuente se está
          enviando al modelo.
        </p>

        {diagnosticLoading ? (
          <p className="settings-description">Cargando diagnóstico...</p>
        ) : null}

        {diagnostics ? (
          <div className="diagnostic-grid">
            <div className="diagnostic-item">
              <span>Nombre del agente</span>
              <strong>{diagnostics.agentName}</strong>
            </div>
            <div className="diagnostic-item">
              <span>Prompt activo actual</span>
              <strong>{diagnostics.key}</strong>
            </div>
            <div className="diagnostic-item">
              <span>Fuente del prompt</span>
              <strong>{diagnostics.sourceLabel}</strong>
            </div>
            <div className="diagnostic-item">
              <span>Fecha de última actualización</span>
              <strong>{formattedUpdatedAt}</strong>
            </div>
            <div className="diagnostic-item">
              <span>Versión del prompt</span>
              <strong>{diagnostics.version}</strong>
            </div>
            <div className="diagnostic-item">
              <span>Prompt ID</span>
              <strong>{diagnostics.promptId}</strong>
            </div>
            <div className="diagnostic-item">
              <span>Caracteres</span>
              <strong>{diagnostics.promptChars}</strong>
            </div>
          </div>
        ) : null}

        <div className="settings-form">
          <label className="form-group">
            <span>Primeros 500 caracteres del prompt</span>
            <textarea
              className="form-textarea diagnostic-preview"
              value={
                showFullPrompt
                  ? diagnostics?.value || ""
                  : diagnostics?.preview || ""
              }
              disabled
            />
          </label>

          <div className="form-actions">
            <button
              className="button button-secondary"
              onClick={() => setShowFullPrompt((current) => !current)}
              type="button"
            >
              {showFullPrompt ? "Ocultar prompt completo" : "Ver prompt completo"}
            </button>
            <button
              className="button button-secondary"
              onClick={() => void handleCopyPrompt()}
              type="button"
            >
              {copiedPrompt ? "✓ Prompt copiado" : "Copiar prompt activo"}
            </button>
            <button
              className="button button-secondary"
              onClick={() => void handleReloadActiveConfig()}
              type="button"
            >
              Recargar configuración activa
            </button>
          </div>
        </div>

        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="diagnostic-test-message">
              Probar respuesta con este prompt
            </label>
            <input
              id="diagnostic-test-message"
              type="text"
              value={testMessage}
              onChange={(event) => setTestMessage(event.currentTarget.value)}
              className="form-input"
              placeholder="¿Cuánto cuesta?"
              disabled={testingPrompt}
            />
          </div>
          <div className="form-actions">
            <button
              className="button button-secondary"
              onClick={handlePromptTest}
              type="button"
              disabled={testingPrompt}
            >
              {testingPrompt ? "Probando..." : "Probar respuesta con este prompt"}
            </button>
          </div>
          {testResult ? (
            <div className="diagnostic-test-result">
              <p>
                <strong>Modelo:</strong> {testResult.model}
              </p>
              <p>
                <strong>Prompt ID:</strong> {testResult.prompt.promptId}
              </p>
              <p>
                <strong>Fuente:</strong> {testResult.prompt.sourceLabel}
              </p>
              <p>
                <strong>Versión:</strong> {testResult.prompt.version}
              </p>
              <p>
                <strong>Respuesta:</strong> {testResult.response || "Sin respuesta"}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="settings-section">
        <h3>Datos del negocio</h3>
        <p className="settings-description">
          Información general del proyecto (más opciones próximamente).
        </p>

        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="project-name">Nombre del proyecto</label>
            <input
              id="project-name"
              type="text"
              placeholder="Pórtate Mal"
              defaultValue="Pórtate Mal"
              className="form-input"
              disabled
            />
            <small className="form-hint">
              Editable desde la consola Supabase por ahora
            </small>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Motor de seguimiento automático</h3>
        <p className="settings-description">
          Controla cuándo el agente puede reactivar conversaciones, cuánto puede tocar
          por corrida y en qué ventana operativa puede escribir.
        </p>

        <div className="editor-grid">
          <label className="field">
            <span>Automatización activa</span>
            <select
              className="field-input"
              value={automationConfig.enabled ? "true" : "false"}
              onChange={(event) =>
                setAutomationConfig((current) => ({
                  ...current,
                  enabled: event.currentTarget.value === "true",
                }))
              }
              disabled={automationLoading || automationSaving}
            >
              <option value="true">Activa</option>
              <option value="false">Pausada</option>
            </select>
          </label>

          <label className="field">
            <span>Mensajes máximos por corrida</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={50}
              value={automationConfig.maxMessagesPerRun}
              onChange={(event) =>
                setAutomationConfig((current) => ({
                  ...current,
                  maxMessagesPerRun: Number(event.currentTarget.value || 1),
                }))
              }
              disabled={automationLoading || automationSaving}
            />
          </label>

          <label className="field">
            <span>Horas mínimas desde el último mensaje del lead</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={168}
              value={automationConfig.minHoursSinceLastInbound}
              onChange={(event) =>
                setAutomationConfig((current) => ({
                  ...current,
                  minHoursSinceLastInbound: Number(event.currentTarget.value || 1),
                }))
              }
              disabled={automationLoading || automationSaving}
            />
          </label>

          <label className="field">
            <span>Límite diario por conversación</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={10}
              value={automationConfig.dailyLimit}
              onChange={(event) =>
                setAutomationConfig((current) => ({
                  ...current,
                  dailyLimit: Number(event.currentTarget.value || 1),
                }))
              }
              disabled={automationLoading || automationSaving}
            />
          </label>

          <label className="field">
            <span>Hora inicio UTC</span>
            <input
              className="field-input"
              type="number"
              min={0}
              max={23}
              value={automationConfig.businessHoursStart}
              onChange={(event) =>
                setAutomationConfig((current) => ({
                  ...current,
                  businessHoursStart: Number(event.currentTarget.value || 0),
                }))
              }
              disabled={automationLoading || automationSaving}
            />
          </label>

          <label className="field">
            <span>Hora fin UTC</span>
            <input
              className="field-input"
              type="number"
              min={0}
              max={23}
              value={automationConfig.businessHoursEnd}
              onChange={(event) =>
                setAutomationConfig((current) => ({
                  ...current,
                  businessHoursEnd: Number(event.currentTarget.value || 0),
                }))
              }
              disabled={automationLoading || automationSaving}
            />
          </label>

          {automationConfig.attemptIntervalsHours.map((interval, index) => (
            <label className="field" key={`attempt-interval-${index}`}>
              <span>{`Acercamiento ${index + 1} (horas)`}</span>
              <input
                className="field-input"
                type="number"
                min={1}
                max={24 * 30}
                value={interval}
                onChange={(event) =>
                  setAutomationConfig((current) => ({
                    ...current,
                    attemptIntervalsHours: current.attemptIntervalsHours.map((currentValue, currentIndex) =>
                      currentIndex === index
                        ? Number(event.currentTarget.value || currentValue)
                        : currentValue,
                    ),
                  }))
                }
                disabled={automationLoading || automationSaving}
              />
            </label>
          ))}
        </div>

        <div className="form-actions">
          <button
            className="button button-primary"
            onClick={handleAutomationSave}
            type="button"
            disabled={automationLoading || automationSaving}
          >
            {automationSaving ? "Guardando..." : "Guardar reglas"}
          </button>
          <button
            className="button button-secondary"
            onClick={handleAutomationRun}
            type="button"
            disabled={automationRunning}
          >
            {automationRunning ? "Ejecutando..." : "Ejecutar seguimiento ahora"}
          </button>
          {automationRunResult ? (
            <div className="status-message status-success">{automationRunResult}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
