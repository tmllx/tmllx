import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { replaceAlbums, listAlbums } from "@/lib/data/albums";
import { loadPlanner, savePlanner } from "@/lib/data/planner";
import { getDb } from "@/lib/db";
import { mergeDealtWeek, reconcilePlannerSave } from "@/lib/planner/save";
import { defaultPlannerState } from "@/lib/planner/state";
import type { PlannerRecord } from "@/lib/planner/types";
import { resetDb } from "./helpers";

function record(version: number, count: number): PlannerRecord {
  return { version, state: { ...defaultPlannerState(), count } };
}

describe("planner save concurrency", () => {
  beforeEach(resetDb);

  it("rejects a stale version and keeps the first write", async () => {
    const first = await loadPlanner();
    const saved = await savePlanner(first.version, { ...first.state, count: 3 });
    expect(saved).not.toBe("conflict");
    const stale = await savePlanner(first.version, { ...first.state, count: 7 });
    expect(stale).toBe("conflict");
    const current = await loadPlanner();
    expect(current.version).toBe(first.version + 1);
    expect(current.state.count).toBe(3);
  });

  it("keeps newer local edits and advances the version after an overlapping save", () => {
    const sent = record(4, 5);
    const local = record(4, 7);
    const outcome = reconcilePlannerSave({
      sent,
      local,
      httpStatus: 200,
      body: record(5, 5),
      retries: 0,
    });
    expect(outcome.dirty).toBe(true);
    expect(outcome.conflict).toBeNull();
    expect(outcome.record.version).toBe(5);
    expect(outcome.record.state.count).toBe(7);
  });

  it("rebases a 409 onto the server version instead of dropping the edit", () => {
    const sent = record(4, 5);
    const local = record(4, 6);
    const outcome = reconcilePlannerSave({
      sent,
      local,
      httpStatus: 409,
      body: record(9, 3),
      retries: 0,
    });
    expect(outcome.dirty).toBe(true);
    expect(outcome.record.version).toBe(9);
    expect(outcome.record.state.count).toBe(6);
  });

  it("applies a dealt week onto the menu as it is now", () => {
    const latest = { ...defaultPlannerState(), count: 7, votes: { burger: { a: "up" } } };
    const merged = mergeDealtWeek(latest, [{ id: "taco", mult: 1, opt: false, lock: false, day: "auto" }], { taco: ["Anchor pick"] });
    expect(merged.count).toBe(7);
    expect(merged.votes.burger.a).toBe("up");
    expect(merged.picks.map((pick) => pick.id)).toEqual(["taco"]);
    expect(merged.why.taco).toEqual(["Anchor pick"]);
    expect(latest.picks).not.toEqual(merged.picks);
  });
});

describe("album replacement", () => {
  beforeEach(resetDb);

  it("replaces the whole list in one transaction", async () => {
    await replaceAlbums([{ label: "Old", url: "https://www.icloud.com/sharedalbum/#old" }]);
    const next = await replaceAlbums([
      { label: "Summer", url: "https://www.icloud.com/sharedalbum/#summer" },
      { label: "Winter", url: "https://share.icloud.com/photos/winter" },
    ]);
    expect(Array.isArray(next)).toBe(true);
    if (!Array.isArray(next)) return;
    expect(next.map((album) => album.label)).toEqual(["Summer", "Winter"]);
    expect((await listAlbums()).map((album) => album.label)).toEqual(["Summer", "Winter"]);
  });

  it("keeps the previous albums when the new insert fails", async () => {
    await replaceAlbums([{ label: "Keep", url: "https://www.icloud.com/sharedalbum/#keep" }]);
    const db = getDb();
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION hub_test_album_fail() RETURNS trigger AS $$
      BEGIN
        IF NEW.label = '__fail__' THEN
          RAISE EXCEPTION 'album insert failed';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.execute(sql`
      DROP TRIGGER IF EXISTS hub_test_album_fail_trg ON album_link;
      CREATE TRIGGER hub_test_album_fail_trg
      BEFORE INSERT ON album_link
      FOR EACH ROW EXECUTE FUNCTION hub_test_album_fail()
    `);
    try {
      await expect(
        replaceAlbums([{ label: "__fail__", url: "https://www.icloud.com/sharedalbum/#nope" }]),
      ).rejects.toThrow();
      expect((await listAlbums()).map((album) => album.label)).toEqual(["Keep"]);
    } finally {
      await db.execute(sql`DROP TRIGGER IF EXISTS hub_test_album_fail_trg ON album_link`);
      await db.execute(sql`DROP FUNCTION IF EXISTS hub_test_album_fail()`);
    }
  });
});
