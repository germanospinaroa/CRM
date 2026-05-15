import "server-only";

import { NextResponse } from "next/server";

import { getServiceSupabaseClient } from "@/lib/supabase/service";

const warnedKeys = new Set<string>();

function warnMissingEnvOnce(envName: string, context: string) {
  const key = `${envName}:${context}`;
  if (warnedKeys.has(key)) {
    return;
  }

  warnedKeys.add(key);
  console.warn(`[Security] Missing ${envName}. ${context}`);
}

function buildErrorResponse(status: number, error: string) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status },
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function requireAdminSession(
  request: Request,
  options?: {
    productionMissingSessionStatus?: 401 | 403;
  },
) {
  const token = getBearerToken(request);
  const productionMissingSessionStatus =
    process.env.NODE_ENV === "production"
      ? (options?.productionMissingSessionStatus ?? 403)
      : 401;

  if (!token) {
    return buildErrorResponse(
      productionMissingSessionStatus,
      "Admin session required.",
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return buildErrorResponse(
      productionMissingSessionStatus,
      "Admin session required.",
    );
  }

  return {
    user: data.user,
  };
}

export async function requireCronSecret(
  request: Request,
  options?: {
    allowAdminSession?: boolean;
  },
) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const receivedSecret = request.headers.get("x-cron-secret")?.trim();

  if (!cronSecret) {
    warnMissingEnvOnce(
      "CRON_SECRET",
      "Cron-protected endpoints will reject unauthenticated cron requests.",
    );
  }

  if (cronSecret && receivedSecret && receivedSecret === cronSecret) {
    return {
      kind: "cron" as const,
    };
  }

  if (options?.allowAdminSession) {
    const adminSession = await requireAdminSession(request, {
      productionMissingSessionStatus: 403,
    });

    if (!(adminSession instanceof NextResponse)) {
      return {
        kind: "admin" as const,
        user: adminSession.user,
      };
    }
  }

  return buildErrorResponse(403, "Invalid cron secret.");
}
