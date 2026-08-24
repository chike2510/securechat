import { describe, expect, it } from "vitest";
import { authenticateSupabaseRequest, matricNumberFromSupabaseMetadata } from "./supabaseAuth";

 describe("Supabase request authentication", () => {
  it("returns no user when a request has no bearer token", async () => {
    await expect(authenticateSupabaseRequest({})).resolves.toBeUndefined();
  });

  it("ignores malformed authorization values", async () => {
    await expect(authenticateSupabaseRequest({ authorization: "Basic not-a-bearer-token" })).resolves.toBeUndefined();
  });

  it("normalizes matric metadata and rejects missing values", () => {
    expect(matricNumberFromSupabaseMetadata({ matricNumber: " cos/8594/2021 " })).toBe("COS/8594/2021");
    expect(matricNumberFromSupabaseMetadata({})).toBeNull();
    expect(matricNumberFromSupabaseMetadata({ matricNumber: "   " })).toBeNull();
  });
});
