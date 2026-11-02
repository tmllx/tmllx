import { and, eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { signInAttempts } from "../db/schema";
import { normalizeEmail, roleForEmail } from "./allowlist";

export const SIGNIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS_PER_EMAIL = 5;
export const MAX_ATTEMPTS_PER_IP = 20;

export type MagicLinkGate = "send" | "silent" | "limited";

export function clientIp(headerValue: string | null): string {
  const first = (headerValue || "").split(",")[0]?.trim();
  return first || "unknown";
}

async function countSince(column: "email" | "ip", value: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: signInAttempts.id })
    .from(signInAttempts)
    .where(and(eq(signInAttempts[column], value), gte(signInAttempts.createdAt, since)));
  return rows.length;
}

export async function prepareMagicLink(emailRaw: string, ipRaw: string, now = new Date()): Promise<MagicLinkGate> {
  const email = normalizeEmail(emailRaw);
  const ip = (ipRaw || "unknown").slice(0, 80) || "unknown";
  if (!email || !email.includes("@")) return "silent";
  const since = new Date(now.getTime() - SIGNIN_WINDOW_MS);
  const [emailCount, ipCount] = await Promise.all([countSince("email", email, since), countSince("ip", ip, since)]);
  if (emailCount >= MAX_ATTEMPTS_PER_EMAIL || ipCount >= MAX_ATTEMPTS_PER_IP) return "limited";
  await getDb().insert(signInAttempts).values({ email, ip, createdAt: now });
  const role = await roleForEmail(email);
  return role ? "send" : "silent";
}
