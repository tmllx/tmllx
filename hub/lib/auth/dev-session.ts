import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { normalizeEmail, roleForEmail } from "./allowlist";
import { devLoginEnabled } from "./session-cookie";

export async function createDevSession(emailRaw: string): Promise<{ token: string; expires: Date } | null> {
  if (!devLoginEnabled()) return null;
  const email = normalizeEmail(emailRaw);
  const role = await roleForEmail(email);
  if (!role) return null;
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let userId = existing[0]?.id;
  if (!userId) {
    userId = crypto.randomUUID();
    await db.insert(users).values({ id: userId, email, emailVerified: new Date(), name: email });
  }
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken: token, userId, expires });
  return { token, expires };
}
