"use client";

import { useState } from "react";
import { DEFAULT_IDS } from "@/lib/planner/catalog";
import { kidTokens, normalizeVotes, weekLabel } from "@/lib/planner/engine";
import { defaultPlannerState } from "@/lib/planner/state";
import type { AlbumLink } from "@/lib/albums";
import type { HH, Member, PlannerState } from "@/lib/planner/types";
import { Card, Field, btnClass, inputClass } from "./ui";

export function SettingsTab({
  state,
  albums,
  onChange,
  onAlbums,
}: {
  state: PlannerState;
  albums: AlbumLink[];
  onChange: (next: PlannerState) => void;
  onAlbums: (albums: { label: string; url: string }[]) => Promise<string | null>;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [shareVotes, setShareVotes] = useState(true);
  const [shareHH, setShareHH] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [albumMsg, setAlbumMsg] = useState("");
  const [draftAlbum, setDraftAlbum] = useState({ label: "", url: "" });
  const tokens = kidTokens(state.hh);

  function patchHH(partial: Partial<HH>) {
    onChange({ ...state, hh: { ...state.hh, ...partial } });
  }
  function patchMember(id: string, partial: Partial<Member>) {
    patchHH({ members: state.hh.members.map((member) => (member.id === id ? { ...member, ...partial } : member)) });
  }

  const exportText = JSON.stringify(
    {
      type: "mealprep-portfolio",
      version: 2,
      recipes: state.recipes,
      ...(shareVotes ? { votes: state.votes } : {}),
      ...(shareHH ? { household: state.hh } : {}),
    },
    null,
    2,
  );

  function doImport() {
    try {
      const parsed = JSON.parse(importText) as { type?: string; recipes?: PlannerState["recipes"]; household?: HH; votes?: unknown };
      if (parsed.type !== "mealprep-portfolio" || !Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
        setImportMsg("That does not look like an exported recipe book.");
        return;
      }
      const recipes = parsed.recipes.filter((recipe) => recipe && recipe.id && recipe.name && Array.isArray(recipe.ing) && Array.isArray(recipe.steps));
      if (!recipes.length) {
        setImportMsg("No valid recipes found.");
        return;
      }
      onChange({
        ...state,
        recipes,
        hh: parsed.household ? { ...state.hh, ...parsed.household } : state.hh,
        votes: parsed.votes ? normalizeVotes(parsed.votes) : state.votes,
        picks: state.picks.filter((pick) => recipes.some((recipe) => recipe.id === pick.id)),
        seenDefaultIds: DEFAULT_IDS.slice(),
      });
      setImportMsg("Imported " + recipes.length + " recipes.");
    } catch {
      setImportMsg("Could not read that JSON.");
    }
  }

  async function saveAlbums(next: { label: string; url: string }[]) {
    const error = await onAlbums(next);
    setAlbumMsg(error || "Album links saved.");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="font-serif text-3xl">Household</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Servings per batch">
            <input className={inputClass} type="number" min={1} value={state.hh.servings} onChange={(event) => patchHH({ servings: Math.max(1, Number(event.target.value) || 1) })} />
          </Field>
          <Field label="Minutes to cook a dinner">
            <input className={inputClass} type="number" value={state.hh.nightlyCook} onChange={(event) => patchHH({ nightlyCook: Number(event.target.value) || 0 })} />
          </Field>
          <Field label="Minutes to assemble">
            <input className={inputClass} type="number" value={state.hh.assemble} onChange={(event) => patchHH({ assemble: Number(event.target.value) || 0 })} />
          </Field>
          <Field label="Prep day 1">
            <input className={inputClass} value={state.hh.day1} onChange={(event) => patchHH({ day1: event.target.value })} />
          </Field>
          <Field label="Day 1 covers">
            <input className={inputClass} value={state.hh.day1cover} onChange={(event) => patchHH({ day1cover: event.target.value })} />
          </Field>
          <Field label="Prep day 2">
            <input className={inputClass} value={state.hh.day2} onChange={(event) => patchHH({ day2: event.target.value })} />
          </Field>
          <Field label="Day 2 covers">
            <input className={inputClass} value={state.hh.day2cover} onChange={(event) => patchHH({ day2cover: event.target.value })} />
          </Field>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={state.hh.gf} onChange={(event) => patchHH({ gf: event.target.checked })} />
          Gluten-free household (tamari, rice noodles, label checks)
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={state.hh.kidNoSauce} onChange={(event) => patchHH({ kidNoSauce: event.target.checked })} />
          No sauce on kid containers
        </label>
      </Card>

      <Card>
        <h2 className="font-serif text-3xl">Household members</h2>
        <p className="mt-1 text-sm text-muted">Names here are for the meal plan. They are not sign-in accounts. Thumbs on a recipe are one shared tally, so anyone in the household can add a vote.</p>
        <div className="mt-3 flex flex-col gap-3">
          {state.hh.members.map((member) => (
            <div key={member.id} className="flex flex-col gap-2 border-t border-line pt-3">
              <input className={inputClass} value={member.name} aria-label="Member name" onChange={(event) => patchMember(member.id, { name: event.target.value })} />
              <select className={inputClass} value={member.role} aria-label="Member role" onChange={(event) => patchMember(member.id, { role: event.target.value })}>
                <option value="adult">Adult</option>
                <option value="kid">Kid</option>
              </select>
              {member.role === "kid" ? (
                <input className={inputClass} placeholder="Foods to leave out, comma separated" value={member.avoids} aria-label="Foods to leave out" onChange={(event) => patchMember(member.id, { avoids: event.target.value })} />
              ) : null}
              <button type="button" className={btnClass()} onClick={() => patchHH({ members: state.hh.members.filter((item) => item.id !== member.id) })}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={`${btnClass()} mt-3`}
          onClick={() => patchHH({ members: state.hh.members.concat([{ id: "m" + Date.now(), name: "Member " + (state.hh.members.length + 1), role: "adult", avoids: "", votes: true }]) })}
        >
          Add member
        </button>
        <p className="mt-3 text-sm text-muted">Kid containers leave out: {tokens.length ? tokens.join(", ") : "nothing yet"}.</p>
      </Card>

      <Card>
        <h2 className="font-serif text-3xl">Photo albums</h2>
        <p className="mt-1 text-sm text-muted">Paste one or more public iCloud Shared Album links. The photos page shows them to household and photos sign-ins. Nothing is uploaded here.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {albums.map((album) => (
            <li key={album.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{album.label}</span>
              <button type="button" className={btnClass()} onClick={() => saveAlbums(albums.filter((item) => item.id !== album.id).map(({ label, url }) => ({ label, url })))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveAlbums(albums.map(({ label, url }) => ({ label, url })).concat([draftAlbum]));
            setDraftAlbum({ label: "", url: "" });
          }}
        >
          <input className={inputClass} placeholder="Label" value={draftAlbum.label} aria-label="Album label" onChange={(event) => setDraftAlbum({ ...draftAlbum, label: event.target.value })} />
          <input className={inputClass} placeholder="https://www.icloud.com/sharedalbum/#..." value={draftAlbum.url} aria-label="Album URL" onChange={(event) => setDraftAlbum({ ...draftAlbum, url: event.target.value })} />
          <button className={btnClass(true)} type="submit">Add album link</button>
        </form>
        {albumMsg ? <p className="mt-2 text-sm">{albumMsg}</p> : null}
      </Card>

      <Card>
        <h2 className="font-serif text-3xl">Rotation history</h2>
        {state.hist.length ? (
          <div className="mt-3">
            <ul className="flex flex-col gap-2 text-sm">
              {state.hist.slice(-8).reverse().map((item) => (
                <li key={item.week}>
                  <span className="font-medium">Week of {weekLabel(item.week)}. </span>
                  {item.ids.length} bowls
                </li>
              ))}
            </ul>
            <button type="button" className={`${btnClass()} mt-3`} onClick={() => onChange({ ...state, hist: [] })}>
              Clear history
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No weeks logged yet. Mark a week as made on Home and the rotation will start resting those bowls.</p>
        )}
      </Card>

      <Card>
        <h2 className="font-serif text-3xl">Share the recipe book</h2>
        <p className="mt-1 text-sm text-muted">The household already shares this menu in the database. Export is only for a copy you can paste somewhere else.</p>
        <label className="mt-3 flex min-h-11 items-center gap-2"><input type="checkbox" checked={shareVotes} onChange={(event) => setShareVotes(event.target.checked)} /> Include votes</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={shareHH} onChange={(event) => setShareHH(event.target.checked)} /> Include household settings</label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnClass(true)}
            onClick={() => navigator.clipboard.writeText(exportText).then(() => setImportMsg("Export copied.")).catch(() => setShowExport(true))}
          >
            Copy export
          </button>
          <button type="button" className={btnClass()} onClick={() => setShowExport((value) => !value)}>
            {showExport ? "Hide export" : "Show export"}
          </button>
        </div>
        {showExport ? <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl bg-paper p-3 text-xs">{exportText}</pre> : null}
        <h3 className="mt-4 font-serif text-xl">Import a recipe book</h3>
        <textarea className={`${inputClass} mt-2 w-full`} rows={5} placeholder="Paste exported JSON here" value={importText} onChange={(event) => setImportText(event.target.value)} />
        <button type="button" className={`${btnClass(true)} mt-2`} onClick={doImport} disabled={!importText.trim()}>
          Import
        </button>
        {importMsg ? <p className="mt-2 text-sm">{importMsg}</p> : null}
      </Card>

      <Card>
        <h2 className="font-serif text-3xl">Reset</h2>
        <p className="mt-1 text-sm text-muted">Changes save for the whole household. Reset returns the starter recipe book and generic member names.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {confirmReset ? (
            <button type="button" className={btnClass(true)} onClick={() => { onChange(defaultPlannerState()); setConfirmReset(false); setImportMsg("Reset to the starter recipe book."); }}>
              Confirm reset
            </button>
          ) : (
            <button type="button" className={btnClass()} onClick={() => setConfirmReset(true)}>
              Reset to starter recipe book
            </button>
          )}
          {confirmReset ? <button type="button" className={btnClass()} onClick={() => setConfirmReset(false)}>Cancel</button> : null}
        </div>
      </Card>
    </div>
  );
}
