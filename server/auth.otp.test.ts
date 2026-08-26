import { describe, expect, it } from "vitest";
import { isEightDigitOtp, normalizeOtp } from "../shared/auth";

describe("SecureChat email OTP helpers", () => {
  it("keeps only digits and caps pasted input at eight characters", () => {
    expect(normalizeOtp("12a 34567890")).toBe("12345678");
  });

  it("accepts exactly eight digits", () => {
    expect(isEightDigitOtp("12345678")).toBe(true);
    expect(isEightDigitOtp("1234567")).toBe(false);
    expect(isEightDigitOtp("123456789")).toBe(false);
    expect(isEightDigitOtp("1234567a")).toBe(false);
  });
});
