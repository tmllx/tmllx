import { getDb } from "@/lib/db";
import { tradingSnapshots } from "@/lib/db/schema";
import { isTradingSnapshotName, TRADING_SNAPSHOT_NAMES, type JsonValue, type TradingSnapshotName } from "@/lib/trading/types";

export type TradingSnapshotMap = {
  files: Partial<Record<TradingSnapshotName, JsonValue>>;
  updatedAt: Partial<Record<TradingSnapshotName, string>>;
};

export async function listTradingSnapshots(): Promise<TradingSnapshotMap> {
  const rows = await getDb().select().from(tradingSnapshots);
  const files: TradingSnapshotMap["files"] = {};
  const updatedAt: TradingSnapshotMap["updatedAt"] = {};
  for (const row of rows) {
    if (!isTradingSnapshotName(row.name)) continue;
    files[row.name] = row.json;
    updatedAt[row.name] = row.updatedAt.toISOString();
  }
  return { files, updatedAt };
}

export async function upsertTradingSnapshots(entries: { name: TradingSnapshotName; data: JsonValue }[]): Promise<TradingSnapshotName[]> {
  if (!entries.length) return [];
  const now = new Date();
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await tx
        .insert(tradingSnapshots)
        .values({ name: entry.name, json: entry.data, updatedAt: now })
        .onConflictDoUpdate({
          target: tradingSnapshots.name,
          set: { json: entry.data, updatedAt: now },
        });
    }
  });
  const written = new Set(entries.map((entry) => entry.name));
  return TRADING_SNAPSHOT_NAMES.filter((name) => written.has(name));
}
