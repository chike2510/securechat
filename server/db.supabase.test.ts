import { describe, expect, it } from "vitest";
import { isDiscoverableProfile, selectSupabaseProfile } from "./db.js";

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

  it("lists another active profile while excluding only the signed-in account", () => {
    const elisha = { id: 14, name: "Elisha Onovo", email: "elisha@example.com", matricNumber: "COS/2024/0117" };

    expect(isDiscoverableProfile(elisha, 8, "")).toBe(true);
    expect(isDiscoverableProfile(elisha, 8, "elisha")).toBe(true);
    expect(isDiscoverableProfile(elisha, 8, "COS/2024")).toBe(true);
    expect(isDiscoverableProfile(elisha, 14, "elisha")).toBe(false);
  });
});
