import { NextRequest, NextResponse } from "next/server";

import { cleanNullableText } from "@/lib/crm/format";
import { saveLeadEvents } from "@/lib/crm/persistence";
import { addDeletedConversationIds } from "@/lib/crm/deleted-conversations";
import { requireAdminSession } from "@/lib/server/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request, {
    productionMissingSessionStatus: 403,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      conversationIds?: string[];
      deletedBy?: string | null;
    };

    const conversationIds = Array.isArray(body.conversationIds)
      ? body.conversationIds.map((id) => cleanNullableText(id)).filter(Boolean)
      : [];
    const deletedBy = cleanNullableText(body.deletedBy);

    if (conversationIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Debes seleccionar al menos una conversación.",
        },
        { status: 400 },
      );
    }

    const supabase = getServiceSupabaseClient();
    const now = new Date().toISOString();

    const { data: activeConversations, error: loadError } = await supabase
      .from("conversations")
      .select("id")
      .in("id", conversationIds);

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,
          error: loadError.message,
        },
        { status: 400 },
      );
    }

    const activeIds = (activeConversations ?? []).map((conversation) => conversation.id);

    if (activeIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se encontraron conversaciones activas para borrar.",
        },
        { status: 404 },
      );
    }

    await addDeletedConversationIds(supabase, activeIds);

    const { error: followUpError } = await supabase
      .from("follow_ups")
      .update({
        follow_up_status: "cancelled",
        updated_at: now,
      })
      .in("conversation_id", activeIds);

    if (followUpError) {
      console.error("Failed cancelling follow-ups for deleted conversations:", {
        followUpError,
        activeIds,
      });
    }

    await Promise.all(
      activeIds.map((conversationId) =>
        saveLeadEvents(conversationId, [
          {
            eventType: "conversation_deleted",
            eventValue: JSON.stringify({
              action: "conversation_deleted",
              conversation_id: conversationId,
              deleted_by: deletedBy ?? "system",
              deleted_at: now,
            }),
          },
        ]),
      ),
    );

    return NextResponse.json({
      ok: true,
      deletedCount: activeIds.length,
    });
  } catch (error) {
    console.error("Conversation delete endpoint failed:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudieron borrar las conversaciones.",
      },
      { status: 500 },
    );
  }
}
