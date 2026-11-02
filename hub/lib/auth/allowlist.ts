import { eq } from "drizzle-orm";
import { isRole, type Role } from "../access";
import { getDb } from "../db";
import { allowedEmails } from "../db/schema";

export function normalizeEmail(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export async function roleForEmail(email: string | null | undefined): Promise<Role | null> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) return null;
  const rows = await getDb().select().from(allowedEmails).where(eq(allowedEmails.email, normalized)).limit(1);
  const role = rows[0]?.role;
  return isRole(role) ? role : null;
}

export async function upsertAllowedEmail(email: string, role: Role): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) throw new Error("Enter a valid email address.");
  if (!isRole(role)) throw new Error("Role must be household or photos.");
  await getDb()
    .insert(allowedEmails)
    .values({ email: normalized, role })
    .onConflictDoUpdate({ target: allowedEmails.email, set: { role } });
}

export async function removeAllowedEmail(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await getDb().delete(allowedEmails).where(eq(allowedEmails.email, normalized));
}
