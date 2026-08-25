import { describe, expect, it } from "vitest";
import { isSixDigitOtp, normalizeOtp } from "../shared/auth";

describe("SecureChat email OTP helpers", () => {
  it("keeps only digits and caps pasted input at six characters", () => {
    expect(normalizeOtp("12a 345678")).toBe("123456");
  });

  it("accepts exactly six digits", () => {
    expect(isSixDigitOtp("123456")).toBe(true);
    expect(isSixDigitOtp("12345")).toBe(false);
    expect(isSixDigitOtp("1234567")).toBe(false);
    expect(isSixDigitOtp("12345a")).toBe(false);
  });
});
