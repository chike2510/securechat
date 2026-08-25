export function normalizeOtp(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isSixDigitOtp(value: string) {
  return /^\d{6}$/.test(value);
}
