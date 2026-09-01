import { describe, expect, it } from "vitest";
import { friendRequestResult, isDiscoverableProfile, selectLatestProfileImagePath, selectSupabaseProfile } from "./db.js";

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
    const elisha = { id: 14, name: "Elisha Onovo", username: "elisha", email: "elisha@example.com", matricNumber: "COS/2024/0117" };

    expect(isDiscoverableProfile(elisha, 8, "")).toBe(true);
    expect(isDiscoverableProfile(elisha, 8, "elisha")).toBe(true);
    expect(isDiscoverableProfile(elisha, 8, "COS/2024")).toBe(true);
    expect(isDiscoverableProfile(elisha, 8, "@elisha")).toBe(true);
    expect(isDiscoverableProfile(elisha, 14, "elisha")).toBe(false);
  });

  it("selects the newest valid profile-image object for a subject", () => {
    expect(selectLatestProfileImagePath("supabase-user", ["notes.json", "1700.bin", "1900.bin", "avatar.webp"])).toBe("profile-images/supabase-user/1900.bin");
    expect(selectLatestProfileImagePath("supabase-user", ["notes.json", "avatar.webp"])).toBeNull();
  });

  it("marks an existing pending friend request without creating a second one", () => {
    expect(friendRequestResult()).toEqual({ status: "pending", alreadyPending: false });
    expect(friendRequestResult("pending")).toEqual({ status: "pending", alreadyPending: true });
  });
});
