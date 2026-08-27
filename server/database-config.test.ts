import { describe, expect, it } from "vitest";
import { databaseFailureCategory, getSupabaseStorageConfiguration } from "./db.js";

describe("Supabase private storage configuration", () => {
  it("recognizes the Vercel integration's existing STORAGE-prefixed server configuration", () => {
    expect(getSupabaseStorageConfiguration({
      STORAGE_SUPABASE_URL: "https://example.supabase.co",
      STORAGE_SUPABASE_SECRET_KEY: "sb_secret_example",
    })).toEqual({ urlConfigured: true, serverKeyConfigured: true });
  });

  it("also supports the older service-role server variable when an integration provides it", () => {
    expect(getSupabaseStorageConfiguration({
      STORAGE_SUPABASE_URL: "https://example.supabase.co",
      STORAGE_SUPABASE_SERVICE_ROLE_KEY: "service-role-example",
    })).toEqual({ urlConfigured: true, serverKeyConfigured: true });
  });

  it("does not treat a browser publishable key as a server key", () => {
    expect(getSupabaseStorageConfiguration({
      STORAGE_SUPABASE_URL: "https://example.supabase.co",
    })).toEqual({ urlConfigured: true, serverKeyConfigured: false });
  });

  it("maps private-storage failures to safe readiness categories", () => {
    expect(databaseFailureCategory(new Error("JWT is invalid"))).toBe("authentication");
    expect(databaseFailureCategory(new Error("Bucket not found"))).toBe("schema");
    expect(databaseFailureCategory(new Error("network timeout"))).toBe("connection");
  });
});
