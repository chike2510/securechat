import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME } from "../shared/const";
import { getUserById } from "./db";

type SessionRequest = { headers: { cookie?: string } };
type SessionResponse = {
  cookie: (name: string, value: string, options: Record<string, unknown>) => void;
  clearCookie: (name: string, options: Record<string, unknown>) => void;
};

const SESSION_MAX_AGE = 1000 * 60 * 60 * 12;
const secret = () => process.env.JWT_SECRET || "securechat-development-secret";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function createSessionToken(userId: number) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + SESSION_MAX_AGE })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: number; exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: SessionResponse, token: string) {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: SESSION_MAX_AGE, path: "/" });
}

export function clearSessionCookie(res: SessionResponse) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: -1, path: "/" });
}

export async function authenticateLocalRequest(req: SessionRequest) {
  const token = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session) return null;
  return getUserById(session.userId);
}
