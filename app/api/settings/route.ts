import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { VALENTINA_DEFAULT_PROMPT } from "@/lib/agent/prompt";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key") || "valentina_prompt";

    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      key,
      value:
        data?.value ?? (key === "valentina_prompt" ? VALENTINA_DEFAULT_PROMPT : null),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || !value) {
      return NextResponse.json(
        { error: "key and value are required" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabaseClient();

    // Upsert using the onConflict logic
    const { data, error } = await supabase
      .from("app_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() })
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
