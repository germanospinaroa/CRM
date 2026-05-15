import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { resolveActiveValentinaPrompt } from "@/lib/agent/resolve-prompt";
import { requireAdminSession } from "@/lib/server/auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request, {
    productionMissingSessionStatus: 403,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key") || "valentina_prompt";
    const includeDiagnostics = searchParams.get("diagnostics") === "true";

    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (key !== "valentina_prompt") {
      return NextResponse.json({
        key,
        value: data?.value ?? null,
        updatedAt: data?.updated_at ?? null,
      });
    }

    const resolved = await resolveActiveValentinaPrompt();

    return NextResponse.json({
      key,
      agentName: resolved.agentName,
      value: resolved.prompt,
      updatedAt: resolved.updatedAt,
      promptId: resolved.promptId,
      version: resolved.version,
      promptChars: resolved.promptChars,
      source: resolved.source,
      sourceLabel: resolved.sourceLabel,
      isFallback: resolved.isFallback,
      preview: resolved.prompt.slice(0, 500),
      diagnostics: includeDiagnostics
        ? {
            storageValueChars: (data?.value ?? "").length,
            isUsingStorageValue: resolved.source === "database",
          }
        : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request, {
    productionMissingSessionStatus: 403,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "key and value are required" },
        { status: 400 }
      );
    }

    const normalizedValue =
      typeof value === "string" ? value : JSON.stringify(value);

    const supabase = getServiceSupabaseClient();

    // Upsert using the onConflict logic
    const { data, error } = await supabase
      .from("app_settings")
      .upsert({ key, value: normalizedValue, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
