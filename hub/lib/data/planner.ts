import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { plannerState } from "@/lib/db/schema";
import { defaultPlannerState, normalizePlanner } from "@/lib/planner/state";
import type { PlannerRecord, PlannerState } from "@/lib/planner/types";

export async function loadPlanner(): Promise<PlannerRecord> {
  const db = getDb();
  await db.insert(plannerState).values({ id: 1, version: 1, state: defaultPlannerState(), updatedAt: new Date() }).onConflictDoNothing();
  const rows = await db.select().from(plannerState).where(eq(plannerState.id, 1)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Planner state is missing.");
  return { version: row.version, state: normalizePlanner(row.state) };
}

export async function savePlanner(version: number, state: PlannerState): Promise<PlannerRecord | "conflict"> {
  const db = getDb();
  const next = normalizePlanner(state);
  const updated = await db
    .update(plannerState)
    .set({ state: next, version: version + 1, updatedAt: new Date() })
    .where(and(eq(plannerState.id, 1), eq(plannerState.version, version)))
    .returning({ version: plannerState.version });
  if (!updated[0]) return "conflict";
  return { version: updated[0].version, state: next };
}
