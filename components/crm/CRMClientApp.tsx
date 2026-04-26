"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConversationsView } from "@/components/crm/ConversationsView";
import { DashboardView } from "@/components/crm/DashboardView";
import { FollowUpsView } from "@/components/crm/FollowUpsView";
import { LoginPanel } from "@/components/crm/LoginPanel";
import { SettingsView } from "@/components/crm/SettingsView";
import { computeCRMStats } from "@/lib/crm/selectors";
import { useCRMWorkspace } from "@/hooks/use-crm-workspace";

type CRMView = "dashboard" | "conversations" | "follow-ups" | "settings";

const viewCopy: Record<
  CRMView,
  {
    title: string;
    description: string;
  }
> = {
  dashboard: {
    title: "Dashboard",
    description:
      "Resumen comercial de Valentina, métricas del pipeline y agenda inmediata.",
  },
  conversations: {
    title: "Conversaciones",
    description:
      "Chat completo por contacto, resumen del lead y mensaje sugerido para responder.",
  },
  "follow-ups": {
    title: "Follow-ups",
    description:
      "Pipeline comercial con edición rápida de prioridad, fecha y siguiente paso.",
  },
  settings: {
    title: "Configuración",
    description:
      "Personaliza el cerebro de Valentina, datos del negocio y reglas de conversación.",
  },
};

function getInitials(email: string | undefined | null) {
  if (!email) return "U";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 1).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function CRMClientApp({ view }: { view: CRMView }) {
  const pathname = usePathname();
  const workspace = useCRMWorkspace();
  const stats = computeCRMStats(workspace.conversations, workspace.followUps);
  const userEmail = workspace.session?.user.email ?? null;

  if (workspace.authLoading) {
    return (
      <main className="boot-shell">
        <div className="boot-mark">
          <span className="eyebrow">Pórtate Mal · CRM</span>
          <h1>Cargando workspace…</h1>
          {workspace.error && (
            <p style={{ color: "#dc2626", marginTop: "1rem", fontSize: "0.875rem" }}>
              {workspace.error}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (workspace.error && !workspace.session) {
    return (
      <main className="boot-shell">
        <div className="boot-mark">
          <span className="eyebrow">Pórtate Mal · CRM</span>
          <h1>Error de carga</h1>
          <p style={{ color: "#dc2626", marginTop: "1rem", fontSize: "0.875rem" }}>
            {workspace.error}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  if (!workspace.session) {
    return (
      <LoginPanel
        configurationError={workspace.error}
        supabase={workspace.supabase}
      />
    );
  }

  return (
    <main className="crm-shell">
      <aside className="crm-sidebar">
        <div className="sidebar-brand">
          <span className="eyebrow">Pórtate Mal</span>
          <h1>CRM Valentina</h1>
        </div>

        <nav className="sidebar-nav">
          <Link
            className="nav-link"
            data-active={pathname === "/CRM"}
            href="/CRM"
          >
            <span>Dashboard</span>
            <small>{stats.totalConversations}</small>
          </Link>
          <Link
            className="nav-link"
            data-active={pathname === "/CRM/conversations"}
            href="/CRM/conversations"
          >
            <span>Conversaciones</span>
            <small>{workspace.conversations.length}</small>
          </Link>
          <Link
            className="nav-link"
            data-active={pathname === "/CRM/follow-ups"}
            href="/CRM/follow-ups"
          >
            <span>Follow-ups</span>
            <small>{stats.pendingFollowUps}</small>
          </Link>
          <Link
            className="nav-link"
            data-active={pathname === "/CRM/settings"}
            href="/CRM/settings"
          >
            <span>Configuración</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden>
              {getInitials(userEmail)}
            </div>
            <div className="sidebar-user-info">
              <span>Sesión</span>
              <strong title={userEmail ?? "Usuario autenticado"}>
                {userEmail ?? "Usuario autenticado"}
              </strong>
            </div>
          </div>
          <button
            className="button button-ghost"
            onClick={() => void workspace.signOut()}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <section className="crm-main">
        <header className="crm-topbar">
          <div>
            <span className="eyebrow">Workspace</span>
            <h2>{viewCopy[view].title}</h2>
            <p>{viewCopy[view].description}</p>
          </div>

          <div className="topbar-actions">
            <button
              className="button button-secondary"
              onClick={() => void workspace.refreshNow()}
              type="button"
              aria-label="Refrescar"
            >
              <span aria-hidden>↻</span>
              <span>Refrescar</span>
            </button>
          </div>
        </header>

        <section className="compact-stats">
          <div className="compact-stat">
            <span>Conversaciones</span>
            <strong>{stats.totalConversations}</strong>
          </div>
          <div className="compact-stat" data-tone="hot">
            <span>Leads calientes</span>
            <strong>{stats.hotLeads}</strong>
          </div>
          <div className="compact-stat">
            <span>Seguimientos</span>
            <strong>{stats.pendingFollowUps}</strong>
          </div>
          <div className="compact-stat" data-tone="ready">
            <span>Listos para comprar</span>
            <strong>{stats.readyToBuy}</strong>
          </div>
        </section>

        {workspace.error ? <p className="workspace-error">{workspace.error}</p> : null}

        <section className="crm-view" data-view={view}>
          {view === "dashboard" ? (
            <DashboardView
              conversations={workspace.conversations}
              followUps={workspace.followUps}
              loading={workspace.dataLoading}
              messages={workspace.messages}
            />
          ) : null}

          {view === "conversations" ? (
            <ConversationsView
              conversations={workspace.conversations}
              followUps={workspace.followUps}
              loading={workspace.dataLoading}
              messages={workspace.messages}
              onSelectConversation={workspace.setSelectedConversationId}
              selectedConversationId={workspace.selectedConversationId}
              onToggleAiEnabled={workspace.toggleAiEnabled}
            />
          ) : null}

          {view === "follow-ups" ? (
            <FollowUpsView
              conversations={workspace.conversations}
              followUps={workspace.followUps}
              loading={workspace.dataLoading}
              onUpdateFollowUp={workspace.updateFollowUp}
            />
          ) : null}

          {view === "settings" ? <SettingsView /> : null}
        </section>
      </section>
    </main>
  );
}
