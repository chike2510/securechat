import { createClient } from "@supabase/supabase-js";
import type { IncomingHttpHeaders } from "node:http";
import type { User } from "../drizzle/schema.js";
import { getOrCreateSupabaseUser, getUserByMatricNumber, getUserByOpenId } from "./db.js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.STORAGE_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.STORAGE_SUPABASE_PUBLISHABLE_KEY ?? process.env.STORAGE_SUPABASE_ANON_KEY ?? "";

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function bearerToken(headers: IncomingHttpHeaders | Headers) {
  const value = headers instanceof Headers ? headers.get("authorization") : headers.authorization;
  if (typeof value !== "string" || !value.toLowerCase().startsWith("bearer ")) return null;
  return value.slice(7).trim() || null;
}

export function matricNumberFromSupabaseMetadata(metadata: Record<string, unknown>) {
  const value = metadata.matricNumber;
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
}

export async function signInSupabaseWithMatric(matricNumber: string, password: string) {
  if (!supabase) return { error: "Authentication is not configured for this deployment." } as const;
  const profile = await getUserByMatricNumber(matricNumber);
  if (!profile?.email) return { error: "No account was found for that matric number." } as const;
  const { data, error } = await supabase.auth.signInWithPassword({ email: profile.email, password });
  if (error || !data.session) return { error: error?.message ?? "Email or password is incorrect." } as const;
  return { session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } } as const;
}

export async function authenticateSupabaseRequest(headers: IncomingHttpHeaders | Headers): Promise<User | undefined> {
  const token = bearerToken(headers);
  if (!supabase) {
    console.error("[SupabaseAuth] verifier is not configured");
    return undefined;
  }
  if (!token) {
    console.warn("[SupabaseAuth] request has no bearer token");
    return undefined;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.error("[SupabaseAuth] token verification failed", error?.message ?? "user not returned");
    return undefined;
  }
  try {
    const openId = `supabase:${data.user.id}`;
    const existing = await getUserByOpenId(openId);
    if (existing) return existing;
    const matricNumber = matricNumberFromSupabaseMetadata(data.user.user_metadata ?? {});
    if (!matricNumber) return undefined;
    return getOrCreateSupabaseUser({
      openId,
      email: data.user.email ?? null,
      name: String(data.user.user_metadata?.name ?? data.user.email ?? "SecureChat user"),
      matricNumber,
    });
  } catch (provisioningError) {
    console.error("[SupabaseAuth] profile provisioning failed", provisioningError);
    return undefined;
  }
}
