export function normalizeOtp(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function isEightDigitOtp(value: string) {
  return /^\d{8}$/.test(value);
}
