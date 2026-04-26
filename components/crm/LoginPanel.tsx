"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function LoginPanel({
  supabase,
  configurationError,
}: {
  supabase: SupabaseClient | null;
  configurationError?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(configurationError ?? null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError(
        configurationError ??
          "Supabase no está configurado todavía. Revisa las variables públicas.",
      );
      return;
    }

    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    }

    setSubmitting(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-story">
        <span className="eyebrow">Pórtate Mal · CRM Valentina</span>
        <h1>WhatsApp, calificación y seguimiento de leads en una sola vista.</h1>
        <p>
          El panel vive en <strong>/CRM</strong>. El webhook público vive en{" "}
          <strong>/api/webhook</strong>. Valentina responde, Sales Brain analiza,
          el equipo cierra.
        </p>

        <div className="auth-highlights">
          <div>
            <span>Meta WhatsApp Cloud API</span>
            <strong>Webhook listo en /api/webhook</strong>
          </div>
          <div>
            <span>Valentina + Sales Brain</span>
            <strong>Respuesta automática y calificación</strong>
          </div>
          <div>
            <span>Supabase Realtime</span>
            <strong>Leads y follow-ups en vivo</strong>
          </div>
        </div>
      </section>

      <section className="auth-panel auth-form-panel">
        <div className="auth-heading">
          <span className="eyebrow">Acceso</span>
          <h2>Inicia sesión con email y password</h2>
          <p>Usa una cuenta autenticada de Supabase para entrar al dashboard.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              className="field-input"
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ventas@germanospina.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="field-input"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="button button-primary" disabled={submitting} type="submit">
            {submitting ? "Entrando..." : "Entrar al CRM"}
          </button>
        </form>
      </section>
    </main>
  );
}
