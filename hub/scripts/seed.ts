import { config } from "dotenv";

config({ path: ".env.local" });

const allowlist = process.env.SEED_ALLOWLIST || "";

async function main() {
  const { upsertAllowedEmail } = await import("../lib/auth/allowlist");
  const { isRole } = await import("../lib/access");
  const { loadPlanner } = await import("../lib/data/planner");
  const entries = allowlist
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const [email, role] = entry.split(":").map((part) => part.trim());
    if (!email || !isRole(role)) {
      throw new Error("SEED_ALLOWLIST entries look like email@example.com:household");
    }
    await upsertAllowedEmail(email, role);
    console.log("allowed", email, role);
  }
  await loadPlanner();
  console.log("planner ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
