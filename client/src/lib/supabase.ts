import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const placeholderUrl = "https://placeholder.supabase.co";
const placeholderKey = "placeholder-publishable-key";

export let supabaseConfigured = false;
export let supabase: SupabaseClient = createClient(placeholderUrl, placeholderKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

function createSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export async function initializeSupabase() {
  const buildUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const buildKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  let url = buildUrl;
  let key = buildKey;

  try {
    const response = await fetch("/api/config", { headers: { Accept: "application/json" } });
    if (response.ok) {
      const runtimeConfig = (await response.json()) as { supabaseUrl?: string; supabasePublishableKey?: string };
      url = runtimeConfig.supabaseUrl || url;
      key = runtimeConfig.supabasePublishableKey || key;
    }
  } catch {
    // Build-time variables remain a valid fallback for local development.
  }

  if (!url || !key) return false;
  supabase = createSupabaseClient(url, key);
  supabaseConfigured = true;
  return true;
}
