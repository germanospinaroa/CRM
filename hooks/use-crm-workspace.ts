"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { hasBrowserSupabaseEnv, getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type {
  ConversationRecord,
  FollowUpRecord,
  MessageRecord,
} from "@/lib/types";

type FollowUpPatch = Partial<
  Pick<
    FollowUpRecord,
    "stage" | "priority" | "next_step" | "follow_up_date" | "summary" | "recommended_action"
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
  error: string | null;
  selectedConversationId: string | null;
  setSelectedConversationId: (conversationId: string | null) => void;
  signOut: () => Promise<void>;
  refreshNow: () => Promise<void>;
  updateFollowUp: (followUpId: string, patch: FollowUpPatch) => Promise<boolean>;
  toggleAiEnabled: (conversationId: string, enabled: boolean) => Promise<boolean>;
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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  refreshRef.current = async () => {
    if (!supabase || !session) {
      setConversations([]);
      setMessages([]);
      setFollowUps([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setError(null);

    const [conversationResponse, messageResponse, followUpResponse] =
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
      ]);

    if (conversationResponse.error || messageResponse.error || followUpResponse.error) {
      const errorMessage =
        conversationResponse.error?.message ??
        messageResponse.error?.message ??
        followUpResponse.error?.message ??
        "No fue posible cargar el CRM.";

      console.error("[CRM Data Load Error]", {
        conversations: conversationResponse.error?.message,
        messages: messageResponse.error?.message,
        followUps: followUpResponse.error?.message,
      });

      setError(errorMessage);
      setDataLoading(false);
      return;
    }

    const nextConversations = (conversationResponse.data ?? []) as ConversationRecord[];
    const nextMessages = (messageResponse.data ?? []) as MessageRecord[];
    const nextFollowUps = (followUpResponse.data ?? []) as FollowUpRecord[];

    setConversations(nextConversations);
    setMessages(nextMessages);
    setFollowUps(nextFollowUps);

    startTransition(() => {
      setSelectedConversationId((currentId) => {
        if (
          currentId &&
          nextConversations.some((conversation) => conversation.id === currentId)
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

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        ai_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    await refreshRef.current();
    return true;
  }

  return {
    supabase,
    session,
    authLoading,
    dataLoading,
    conversations,
    messages,
    followUps,
    error,
    selectedConversationId,
    setSelectedConversationId,
    signOut,
    refreshNow,
    updateFollowUp,
    toggleAiEnabled,
  };
}
