"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_RECIPES } from "@/lib/planner/catalog";
import { curWeekId } from "@/lib/planner/engine";
import { reconcilePlannerSave } from "@/lib/planner/save";
import type { PlannerRecord, PlannerState } from "@/lib/planner/types";
import type { AlbumLink } from "@/lib/albums";
import { HomeTab } from "./home-tab";
import { RecipesTab } from "./recipes-tab";
import { SettingsTab } from "./settings-tab";
import { ShopTab } from "./shop-tab";
import { btnClass } from "./ui";

const TABS = [
  ["home", "Home"],
  ["recipes", "Recipes"],
  ["shop", "Shopping"],
  ["settings", "Settings"],
] as const;

type Tab = (typeof TABS)[number][0];

export function PlannerApp({ initial, initialAlbums }: { initial: PlannerRecord; initialAlbums: AlbumLink[] }) {
  const [record, setRecord] = useState(initial);
  const [albums, setAlbums] = useState(initialAlbums);
  const [tab, setTab] = useState<Tab>("home");
  const [status, setStatus] = useState("Saved for the household");
  const [conflict, setConflict] = useState<PlannerRecord | null>(null);
  const dirty = useRef(false);
  const retries = useRef(0);
  const recordRef = useRef(record);
  const originals = Object.fromEntries(DEFAULT_RECIPES.map((recipe) => [recipe.id, recipe]));
  const weekId = curWeekId();

  async function persist(sent: PlannerRecord) {
    setStatus("Saving...");
    let res: Response;
    try {
      res = await fetch("/api/planner", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sent),
      });
    } catch {
      setStatus("Could not save");
      return;
    }
    const body = res.status === 200 || res.status === 409 ? ((await res.json()) as PlannerRecord) : null;
    const outcome = reconcilePlannerSave({
      sent,
      local: recordRef.current,
      httpStatus: res.status,
      body,
      retries: retries.current,
    });
    retries.current = outcome.dirty ? retries.current + 1 : 0;
    dirty.current = outcome.dirty;
    setConflict(outcome.conflict);
    setStatus(outcome.status);
    setRecord(outcome.record);
  }

  useEffect(() => {
    recordRef.current = record;
    if (!dirty.current) return;
    const handle = window.setTimeout(() => {
      void persist(recordRef.current);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [record]);

  function update(next: PlannerState | ((state: PlannerState) => PlannerState)) {
    dirty.current = true;
    setConflict(null);
    setRecord((current) => {
      const state = typeof next === "function" ? next(current.state) : next;
      return { ...current, state };
    });
  }

  async function saveAlbums(next: { label: string; url: string }[]) {
    const res = await fetch("/api/albums", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ albums: next }),
    });
    const body = (await res.json()) as { albums?: AlbumLink[]; error?: string };
    if (!res.ok) return body.error || "Could not save album links.";
    setAlbums(body.albums || []);
    return null;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted">Shared menu</p>
          <h1 className="font-serif text-4xl tracking-tight">Meals</h1>
        </div>
        <p className="text-sm text-muted" aria-live="polite">{status}</p>
      </div>
      {conflict ? (
        <div className="mb-4 rounded-3xl border border-orange bg-orange-soft p-4">
          <p>The household copy changed on another screen. Your edits are still on this screen.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnClass(true)}
              onClick={() => {
                dirty.current = true;
                retries.current = 0;
                setConflict(null);
                setRecord({ version: conflict.version, state: recordRef.current.state });
              }}
            >
              Save my edits
            </button>
            <button
              type="button"
              className={btnClass()}
              onClick={() => {
                dirty.current = false;
                setRecord(conflict);
                setConflict(null);
                setStatus("Loaded the shared copy");
              }}
            >
              Load the shared copy
            </button>
          </div>
        </div>
      ) : null}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Meal planner">
        {TABS.map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={btnClass(tab === value, true)} onClick={() => setTab(value)}>
            {label}
            {value === "recipes" ? " " + record.state.recipes.length : ""}
          </button>
        ))}
      </div>
      {tab === "home" ? <HomeTab state={record.state} weekId={weekId} onChange={update} /> : null}
      {tab === "recipes" ? <RecipesTab state={record.state} weekId={weekId} originals={originals} onChange={update} /> : null}
      {tab === "shop" ? <ShopTab state={record.state} onChange={update} onHome={() => setTab("home")} /> : null}
      {tab === "settings" ? <SettingsTab state={record.state} albums={albums} onChange={update} onAlbums={saveAlbums} /> : null}
    </div>
  );
}
