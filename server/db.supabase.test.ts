import { describe, expect, it } from "vitest";
import { selectSupabaseProfile } from "./db.js";

describe("Supabase profile reuse", () => {
  it("prefers the Supabase identity, then matric number, then email", () => {
    const byOpenId = { id: 1 };
    const byMatricNumber = { id: 2 };
    const byEmail = { id: 3 };

    expect(selectSupabaseProfile(byOpenId, byMatricNumber, byEmail)).toBe(byOpenId);
    expect(selectSupabaseProfile(undefined, byMatricNumber, byEmail)).toBe(byMatricNumber);
    expect(selectSupabaseProfile(undefined, undefined, byEmail)).toBe(byEmail);
    expect(selectSupabaseProfile(undefined, undefined, undefined)).toBeUndefined();
  });
});
