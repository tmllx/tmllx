import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import type { Role } from "@/lib/access";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { roleForEmail } from "./allowlist";
import { readSessionToken } from "./session-cookie";

export interface Viewer {
  email: string;
  role: Role;
  userId: string;
}

export async function viewerFromEmail(email: string | null | undefined, userId = ""): Promise<Viewer | null> {
  const role = await roleForEmail(email);
  if (!role || !email) return null;
  return { email: email.trim().toLowerCase(), role, userId };
}

export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return viewerFromEmail(email, session.user.id || "");
}

export async function viewerFromSessionToken(token: string | null | undefined): Promise<Viewer | null> {
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ email: users.email, userId: users.id, expires: sessions.expires })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.sessionToken, token))
    .limit(1);
  const row = rows[0];
  if (!row?.email || row.expires.getTime() < Date.now()) return null;
  return viewerFromEmail(row.email, row.userId);
}

export async function viewerFromCookies(get: (name: string) => string | undefined): Promise<Viewer | null> {
  return viewerFromSessionToken(readSessionToken(get));
}
