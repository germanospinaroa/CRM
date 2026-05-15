"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { buildSupabaseAuthHeaders } from "@/lib/supabase/auth-headers";
import { hasBrowserSupabaseEnv, getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { loadDeletedConversationIds } from "@/lib/crm/deleted-conversations";
import type {
  AppointmentRecord,
  ConversationRecord,
  FollowUpRecord,
  LeadEventRecord,
  MessageRecord,
  TaskRecord,
} from "@/lib/types";

type FollowUpPatch = Partial<
  Pick<
    FollowUpRecord,
    | "stage"
    | "priority"
    | "follow_up_type"
    | "follow_up_status"
    | "next_step"
    | "follow_up_date"
    | "summary"
    | "recommended_action"
    | "agreement_note"
  >
>;

interface CRMWorkspaceState {
  supabase: SupabaseClient | null;
  session: Session | null;
  authLoading: boolean;
  dataLoading: boolean;
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  followUps: FollowUpRecord[];
  tasks: TaskRecord[];
  appointments: AppointmentRecord[];
  leadEvents: LeadEventRecord[];
  error: string | null;
  selectedConversationId: string | null;
  setSelectedConversationId: (conversationId: string | null) => void;
  clearSelectedConversation: () => void;
  signOut: () => Promise<void>;
  refreshNow: () => Promise<void>;
  updateFollowUp: (followUpId: string, patch: FollowUpPatch) => Promise<boolean>;
  toggleAiEnabled: (conversationId: string, enabled: boolean) => Promise<boolean>;
  sendManualReply: (conversationId: string, message: string) => Promise<boolean>;
  deleteConversations: (conversationIds: string[]) => Promise<boolean>;
}

export function useCRMWorkspace(): CRMWorkspaceState {
  const [supabase] = useState<SupabaseClient | null>(() =>
    hasBrowserSupabaseEnv() ? getBrowserSupabaseClient() : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [leadEvents, setLeadEvents] = useState<LeadEventRecord[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const allowAutoSelectRef = useRef(true);

  function getApiBasePath() {
    if (typeof window === "undefined") {
      return "/api";
    }

    return window.location.pathname.startsWith("/CRM") ? "/CRM/api" : "/api";
  }

  function isMissingRelationErrorMessage(message: string | undefined) {
    const normalized = (message ?? "").toLowerCase();
    return normalized.includes("relation") || normalized.includes("does not exist");
  }

  refreshRef.current = async () => {
    if (!supabase || !session) {
      setConversations([]);
      setMessages([]);
      setFollowUps([]);
      setTasks([]);
      setAppointments([]);
      setLeadEvents([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setError(null);

    const [
      conversationResponse,
      messageResponse,
      followUpResponse,
      taskResponse,
      appointmentResponse,
      leadEventsResponse,
      deletedIds,
    ] =
      await Promise.all([
        supabase
          .from("conversations")
          .select("*")
          .order("last_contact_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("follow_ups")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("*")
          .order("due_at", { ascending: true, nullsFirst: false }),
        supabase
          .from("appointments")
          .select("*")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("lead_events")
          .select("*")
          .order("created_at", { ascending: false }),
        loadDeletedConversationIds(supabase),
      ]);

    const tasksUnavailable = isMissingRelationErrorMessage(taskResponse.error?.message);
    const appointmentsUnavailable = isMissingRelationErrorMessage(
      appointmentResponse.error?.message,
    );

    if (
      conversationResponse.error ||
      messageResponse.error ||
      followUpResponse.error ||
      (taskResponse.error && !tasksUnavailable) ||
      (appointmentResponse.error && !appointmentsUnavailable)
      || leadEventsResponse.error
    ) {
      const errorMessage =
        conversationResponse.error?.message ??
        messageResponse.error?.message ??
        followUpResponse.error?.message ??
        taskResponse.error?.message ??
        appointmentResponse.error?.message ??
        leadEventsResponse.error?.message ??
        "No fue posible cargar el CRM.";

      console.error("[CRM Data Load Error]", {
        conversations: conversationResponse.error?.message,
        messages: messageResponse.error?.message,
        followUps: followUpResponse.error?.message,
        tasks: taskResponse.error?.message,
        appointments: appointmentResponse.error?.message,
        leadEvents: leadEventsResponse.error?.message,
      });

      setError(errorMessage);
      setDataLoading(false);
      return;
    }

    const nextConversations = (conversationResponse.data ?? []) as ConversationRecord[];
    const activeConversationIds = new Set(
      nextConversations
        .filter((conversation) => !deletedIds.has(conversation.id))
        .map((conversation) => conversation.id),
    );
    const nextMessages = (messageResponse.data ?? []).filter((message) =>
      activeConversationIds.has((message as MessageRecord).conversation_id),
    ) as MessageRecord[];
    const nextFollowUps = (followUpResponse.data ?? []).filter((followUp) => {
      const typedFollowUp = followUp as FollowUpRecord;
      return (
        activeConversationIds.has(typedFollowUp.conversation_id) &&
        typedFollowUp.follow_up_status !== "cancelled"
      );
    }) as FollowUpRecord[];
    const nextTasks = tasksUnavailable
      ? []
      : ((taskResponse.data ?? []).filter((task) =>
          activeConversationIds.has((task as TaskRecord).conversation_id),
        ) as TaskRecord[]);
    const nextAppointments = appointmentsUnavailable
      ? []
      : ((appointmentResponse.data ?? []).filter((appointment) =>
          activeConversationIds.has((appointment as AppointmentRecord).conversation_id),
        ) as AppointmentRecord[]);
    const nextLeadEvents = (leadEventsResponse.data ?? []).filter((event) =>
      activeConversationIds.has((event as LeadEventRecord).conversation_id),
    ) as LeadEventRecord[];

    setConversations(
      nextConversations.filter((conversation) => !deletedIds.has(conversation.id)),
    );
    setMessages(nextMessages);
    setFollowUps(nextFollowUps);
    setTasks(nextTasks);
    setAppointments(nextAppointments);
    setLeadEvents(nextLeadEvents);

    startTransition(() => {
      setSelectedConversationId((currentId) => {
        if (!allowAutoSelectRef.current) {
          return currentId && activeConversationIds.has(currentId)
            ? currentId
            : null;
        }

        if (
          currentId &&
          activeConversationIds.has(currentId)
        ) {
          return currentId;
        }

        return nextConversations[0]?.id ?? null;
      });
    });

    setDataLoading(false);
  };

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setError(
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY para iniciar el CRM.",
      );
      return;
    }

    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const initAuth = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (sessionError) {
          console.error("[CRM Auth Error]", sessionError);
          setError(`Error de autenticación: ${sessionError.message}`);
          setAuthLoading(false);
          return;
        }

        setSession(data.session);
        setAuthLoading(false);
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error("[CRM Init Auth Error]", err);
        setError(
          err instanceof Error ? err.message : "Error desconocido en autenticación"
        );
        setAuthLoading(false);
      }
    };

    // Timeout de 10 segundos para evitar bloqueos indefinidos
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("[CRM Auth Timeout] getSession tomó más de 10 segundos");
        setError("Timeout en autenticación. Por favor recarga la página.");
        setAuthLoading(false);
      }
    }, 10000);

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session) {
      setConversations([]);
      setMessages([]);
      setFollowUps([]);
      setTasks([]);
      setAppointments([]);
      setLeadEvents([]);
      setSelectedConversationId(null);
      setDataLoading(false);
      return;
    }

    void refreshRef.current();
  }, [session, supabase]);

  useEffect(() => {
    if (!supabase || !session) {
      return;
    }

    const handleRealtimeChange = () => {
      startTransition(() => {
        void refreshRef.current();
      });
    };

    const channel = supabase
      .channel("crm-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        handleRealtimeChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        handleRealtimeChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lead_events",
        },
        handleRealtimeChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        handleRealtimeChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        handleRealtimeChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follow_ups",
        },
        handleRealtimeChange,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, supabase]);

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
  }

  async function refreshNow() {
    await refreshRef.current();
  }

  function selectConversationId(conversationId: string | null) {
    allowAutoSelectRef.current = true;
    setSelectedConversationId(conversationId);
  }

  function clearSelectedConversation() {
    allowAutoSelectRef.current = false;
    setSelectedConversationId(null);
  }

  async function updateFollowUp(followUpId: string, patch: FollowUpPatch) {
    if (!supabase) {
      return false;
    }

    const { error: updateError } = await supabase
      .from("follow_ups")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", followUpId);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    await refreshRef.current();
    return true;
  }

  async function toggleAiEnabled(conversationId: string, enabled: boolean) {
    if (!supabase) {
      return false;
    }

    const now = new Date().toISOString();
    const updateWithMode = await supabase
      .from("conversations")
      .update({
        ai_enabled: enabled,
        ai_mode: enabled ? "auto" : "manual",
        updated_at: now,
      })
      .eq("id", conversationId);

    let updateError = updateWithMode.error;

    if (updateError && updateError.message.toLowerCase().includes("ai_mode")) {
      const fallbackUpdate = await supabase
        .from("conversations")
        .update({
          ai_enabled: enabled,
          updated_at: now,
        })
        .eq("id", conversationId);
      updateError = fallbackUpdate.error;
    }

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    await refreshRef.current();
    return true;
  }

  async function sendManualReply(conversationId: string, message: string) {
    const content = message.trim();

    if (!content) {
      setError("El mensaje manual no puede estar vacío.");
      return false;
    }

    try {
      const apiBasePath = getApiBasePath();
      const response = await fetch(
        `${apiBasePath}/conversations/${conversationId}/manual-reply`,
        {
          method: "POST",
          headers: await buildSupabaseAuthHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            message: content,
          }),
        },
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "No se pudo enviar el mensaje manual.");
        return false;
      }

      await refreshRef.current();
      return true;
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar el mensaje manual.",
      );
      return false;
    }
  }

  async function deleteConversations(conversationIds: string[]) {
    const ids = conversationIds.filter(Boolean);

    if (ids.length === 0) {
      setError("No hay conversaciones seleccionadas para borrar.");
      return false;
    }

    if (!supabase || !session) {
      setError("Debes iniciar sesión para borrar conversaciones.");
      return false;
    }

    try {
      const apiBasePath = getApiBasePath();
      const response = await fetch(`${apiBasePath}/conversations/delete`, {
        method: "POST",
        headers: await buildSupabaseAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          conversationIds: ids,
          deletedBy: session.user.email ?? session.user.id,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "No se pudieron borrar las conversaciones.");
        return false;
      }

      await refreshRef.current();
      return true;
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudieron borrar las conversaciones.",
      );
      return false;
    }
  }

  return {
    supabase,
    session,
    authLoading,
    dataLoading,
    conversations,
    messages,
    followUps,
    tasks,
    appointments,
    leadEvents,
    error,
    selectedConversationId,
    setSelectedConversationId: selectConversationId,
    clearSelectedConversation,
    signOut,
    refreshNow,
    updateFollowUp,
    toggleAiEnabled,
    sendManualReply,
    deleteConversations,
  };
}
