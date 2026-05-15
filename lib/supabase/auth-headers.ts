import { getBrowserSupabaseClient, hasBrowserSupabaseEnv } from "@/lib/supabase/browser";

export async function buildSupabaseAuthHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);

  if (!hasBrowserSupabaseEnv()) {
    return nextHeaders;
  }

  const supabase = getBrowserSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    nextHeaders.set("Authorization", `Bearer ${session.access_token}`);
  }

  return nextHeaders;
}
