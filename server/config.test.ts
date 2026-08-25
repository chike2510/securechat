import { describe, expect, it } from "vitest";
import { getPublicSupabaseConfig } from "../api/config.js";

describe("public Supabase runtime config", () => {
  it("returns only safe URL and publishable key values", () => {
    const config = getPublicSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://public.example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "must-not-be-returned",
    });

    expect(config).toEqual({
      supabaseUrl: "https://public.example.supabase.co",
      supabasePublishableKey: "anon-key",
    });
    expect(JSON.stringify(config)).not.toContain("must-not-be-returned");
  });

  it("supports the storage-prefixed Supabase integration names", () => {
    expect(getPublicSupabaseConfig({
      STORAGE_SUPABASE_URL: "https://storage.example.supabase.co",
      STORAGE_SUPABASE_ANON_KEY: "storage-anon-key",
    })).toEqual({
      supabaseUrl: "https://storage.example.supabase.co",
      supabasePublishableKey: "storage-anon-key",
    });
  });
});
