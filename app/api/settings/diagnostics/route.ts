import { NextRequest, NextResponse } from "next/server";

import { resolveActiveValentinaPrompt } from "@/lib/agent/resolve-prompt";
import { cleanNullableText } from "@/lib/crm/format";
import { getOpenAIModel } from "@/lib/openai/client";
import { generateDiagnosticReply } from "@/lib/openai/respond";
import { requireAdminSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request, {
    productionMissingSessionStatus: 403,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const resolvedPrompt = await resolveActiveValentinaPrompt();

    return NextResponse.json({
      ok: true,
      prompt: {
        ...resolvedPrompt,
        preview: resolvedPrompt.prompt.slice(0, 500),
      },
      model: getOpenAIModel(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      },
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
    const payload = (await request.json()) as {
      message?: string;
    };
    const message =
      cleanNullableText(payload.message) ??
      "¿Cuánto cuesta?";

    const result = await generateDiagnosticReply({
      message,
    });

    return NextResponse.json({
      ok: result.ok,
      error: result.error,
      model: result.model,
      prompt: {
        ...result.prompt,
        preview: result.prompt.prompt.slice(0, 500),
      },
      inputMessage: message,
      response: result.response,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}
