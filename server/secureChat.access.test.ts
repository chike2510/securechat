import { describe, expect, it } from "vitest";
import { assertParticipantAccess } from "./accessControl";

describe("SecureChat participant access", () => {
  it("rejects reading a conversation when membership cannot be verified", () => {
    expect(() => assertParticipantAccess(true, false, "Unauthorized conversation access"))
      .toThrow("Unauthorized conversation access");
  });

  it("rejects status updates for an unverified message participant", () => {
    expect(() => assertParticipantAccess(true, false, "Unauthorized message access"))
      .toThrow("Unauthorized message access");
  });

  it("rejects access when the protected resource does not exist", () => {
    expect(() => assertParticipantAccess(false, true, "Unauthorized message access"))
      .toThrow("Unauthorized message access");
  });
});
