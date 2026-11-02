import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const [command, email, role] = process.argv.slice(2);
  const { upsertAllowedEmail, removeAllowedEmail, normalizeEmail } = await import("../lib/auth/allowlist");
  const { isRole } = await import("../lib/access");
  const { getDb } = await import("../lib/db");
  const { allowedEmails } = await import("../lib/db/schema");
  if (command === "add") {
    if (!email || !isRole(role)) {
      throw new Error("Usage: npm run allow -- add person@example.com household");
    }
    await upsertAllowedEmail(email, role);
    console.log("allowed", normalizeEmail(email), role);
    return;
  }
  if (command === "remove") {
    if (!email) throw new Error("Usage: npm run allow -- remove person@example.com");
    await removeAllowedEmail(email);
    console.log("removed", normalizeEmail(email));
    return;
  }
  if (command === "list" || !command) {
    const rows = await getDb().select().from(allowedEmails);
    for (const row of rows) console.log(row.role + "\t" + row.email);
    return;
  }
  throw new Error("Commands: add, remove, list");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Allowlist command failed");
  process.exit(1);
});
