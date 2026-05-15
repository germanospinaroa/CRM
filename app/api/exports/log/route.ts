import { NextRequest, NextResponse } from "next/server";

import { cleanNullableText } from "@/lib/crm/format";
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
    const payload = (await request.json()) as {
      exportType?: string;
      exportFormat?: string;
      rowCount?: number;
      requestedBy?: string | null;
      filters?: Record<string, unknown> | null;
    };

    const exportType = cleanNullableText(payload.exportType);
    const exportFormat = cleanNullableText(payload.exportFormat);

    if (!exportType || !exportFormat) {
      return NextResponse.json(
        { ok: false, error: "exportType y exportFormat son requeridos." },
        { status: 400 },
      );
    }

    const supabase = getServiceSupabaseClient();
    const { error } = await supabase.from("data_exports").insert({
      export_type: exportType,
      export_format: exportFormat,
      row_count: Math.max(0, payload.rowCount ?? 0),
      requested_by: cleanNullableText(payload.requestedBy),
      filters: payload.filters ?? null,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
