"use client";

import { useEffect, useState } from "react";

export function SettingsView() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [statusMessage, setStatusMessage] = useState("");

  // Load current prompt
  useEffect(() => {
    const loadPrompt = async () => {
      try {
        const response = await fetch("/api/settings?key=valentina_prompt");
        const data = (await response.json()) as {
          value: string | null;
          error?: string;
        };

        if (data.error) {
          setStatus("error");
          setStatusMessage(data.error);
        } else {
          setPrompt(data.value || "");
        }
      } catch (error) {
        setStatus("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Error al cargar el prompt"
        );
      } finally {
        setLoading(false);
      }
    };

    void loadPrompt();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus("saving");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    </div>
  );
}
