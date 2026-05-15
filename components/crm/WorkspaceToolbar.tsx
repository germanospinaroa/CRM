"use client";

import { useEffect, useRef, useState } from "react";

import { buildOperationsSummary, convertRowsToCsv } from "@/lib/crm/export";
import { buildSupabaseAuthHeaders } from "@/lib/supabase/auth-headers";
import type {
  AppointmentRecord,
  ConversationRecord,
  FollowUpRecord,
  MessageRecord,
  TaskRecord,
} from "@/lib/types";

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getApiBasePath() {
  if (typeof window === "undefined") {
    return "/api";
  }

  return window.location.pathname.startsWith("/CRM") ? "/CRM/api" : "/api";
}

export function WorkspaceToolbar({
  view,
  conversations,
  messages,
  followUps,
  tasks,
  appointments,
}: {
  view: "dashboard" | "conversations" | "follow-ups" | "settings";
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  followUps: FollowUpRecord[];
  tasks: TaskRecord[];
  appointments: AppointmentRecord[];
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function logExport(exportType: string, exportFormat: string, rowCount: number) {
    try {
      await fetch(`${getApiBasePath()}/exports/log`, {
        method: "POST",
        headers: await buildSupabaseAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          exportType,
          exportFormat,
          rowCount,
        }),
      });
    } catch {
      // Best effort only.
    }
  }

  async function exportCsv<T extends object>(name: string, rows: T[]) {
    const csv = convertRowsToCsv(rows as Array<Record<string, unknown>>);
    downloadFile(
      `crm-${name}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8;",
    );
    await logExport(name, "csv", rows.length);
    setStatus(`Exportado ${name}`);
    setMenuOpen(false);
    window.setTimeout(() => setStatus(null), 2200);
  }

  async function exportJsonSnapshot() {
    const snapshot = {
      summary: buildOperationsSummary({
        conversations,
        messages,
        followUps,
        tasks,
        appointments,
      }),
      conversations,
      messages,
      followUps,
      tasks,
      appointments,
    };

    downloadFile(
      `crm-snapshot-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(snapshot, null, 2),
      "application/json;charset=utf-8;",
    );
    await logExport("snapshot", "json", conversations.length);
    setStatus("Snapshot exportado");
    setMenuOpen(false);
    window.setTimeout(() => setStatus(null), 2200);
  }

  return (
    <div className="workspace-toolbar" ref={toolbarRef}>
      {view !== "settings" ? (
        <div className="toolbar-menu">
          <button
            aria-expanded={menuOpen}
            className="button button-secondary"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            Exportar datos
          </button>
          {menuOpen ? (
            <div className="toolbar-popover">
              <button
                className="toolbar-popover-action"
                onClick={() => void exportCsv("conversations", conversations)}
                type="button"
              >
                Exportar leads
              </button>
              <button
                className="toolbar-popover-action"
                onClick={() => void exportCsv("followups", followUps)}
                type="button"
              >
                Exportar follow-ups
              </button>
              <button
                className="toolbar-popover-action"
                onClick={() => void exportCsv("tasks", tasks)}
                type="button"
              >
                Exportar tareas
              </button>
              <button
                className="toolbar-popover-action toolbar-popover-action-primary"
                onClick={() => void exportJsonSnapshot()}
                type="button"
              >
                Snapshot CRM
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {status ? <span className="toolbar-status">{status}</span> : null}
    </div>
  );
}
