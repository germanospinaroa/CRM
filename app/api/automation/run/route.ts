import { NextResponse } from "next/server";

import { runFollowUpAutomation } from "@/lib/crm/automation";
import { requireCronSecret } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireCronSecret(request, {
    allowAdminSession: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const result = await runFollowUpAutomation();
    return NextResponse.json(result);
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

export async function POST(request: Request) {
  return GET(request);
}
