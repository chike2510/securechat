type VercelRequest = { method?: string };
type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => VercelResponse;
  json: (body: unknown) => void;
};

type PublicConfigEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  STORAGE_SUPABASE_URL?: string;
  STORAGE_SUPABASE_PUBLISHABLE_KEY?: string;
  STORAGE_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
};

export function getPublicSupabaseConfig(env: PublicConfigEnv = process.env as PublicConfigEnv) {
  return {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? env.STORAGE_SUPABASE_URL ?? "",
    supabasePublishableKey:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      env.SUPABASE_PUBLISHABLE_KEY ??
      env.SUPABASE_ANON_KEY ??
      env.STORAGE_SUPABASE_PUBLISHABLE_KEY ??
      env.STORAGE_SUPABASE_ANON_KEY ??
      "",
  };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).setHeader("Allow", "GET").json({ error: "Method not allowed" });
  }

  return res.status(200).setHeader("Cache-Control", "no-store").json(getPublicSupabaseConfig());
}
