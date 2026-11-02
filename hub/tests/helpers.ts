import { getDb } from "@/lib/db";
import { accounts, albumLinks, allowedEmails, authenticators, plannerState, sessions, signInAttempts, users, verificationTokens } from "@/lib/db/schema";

export async function resetDb() {
  const db = getDb();
  await db.delete(verificationTokens);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(authenticators);
  await db.delete(users);
  await db.delete(signInAttempts);
  await db.delete(allowedEmails);
  await db.delete(albumLinks);
  await db.delete(plannerState);
}
