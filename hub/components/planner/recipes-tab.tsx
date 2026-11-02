"use client";

import { useState } from "react";
import { PROTS } from "@/lib/planner/catalog";
import { cap, isNewNow, parseIngLine, perish, voteOf, weeksAgo } from "@/lib/planner/engine";
import type { PlannerState, Recipe } from "@/lib/planner/types";
import { RecipeBody, capWord } from "./recipe-body";
import { Card, Chip, btnClass, inputClass, proteinTone } from "./ui";

const EMPTY_FORM = { name: "", cuisine: "", prot: "plant", fridge: "4", prep: "30", pg: "20", veg: "2", ing: "", steps: "", kid: "" };

export function RecipesTab({
  state,
  weekId,
  originals,
  onChange,
}: {
  state: PlannerState;
  weekId: string;
  originals: Record<string, Recipe>;
  onChange: (next: PlannerState) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [protein, setProtein] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState("");
  const [editing, setEditing] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState("");
  const voters = state.hh.members.filter((member) => member.votes);
  const picked = new Set(state.picks.map((pick) => pick.id));
  const q = query.trim().toLowerCase();
  const shown = state.recipes.filter((recipe) => {
    if (filter === "new" && !isNewNow(recipe, weekId)) return false;
    if (filter === "liked" && !voters.some((member) => voteOf(state.votes, recipe.id, member.id) === "up")) return false;
    if (filter === "cabbage" && !recipe.ing.some((item) => item.n.toLowerCase().includes("cabbage"))) return false;
    if (protein !== "all" && recipe.prot !== protein) return false;
    if (q && !(recipe.name + " " + recipe.cuisine + " " + recipe.ing.map((item) => item.n).join(" ")).toLowerCase().includes(q)) return false;
    return true;
  });
  const newCount = state.recipes.filter((recipe) => isNewNow(recipe, weekId)).length;

  function patchRecipe(id: string, recipe: Recipe) {
    onChange({ ...state, recipes: state.recipes.map((item) => (item.id === id ? recipe : item)) });
  }

  function addRecipe() {
    const name = form.name.trim();
    const ing = form.ing.split("\n").map(parseIngLine).filter((item): item is NonNullable<typeof item> => !!item);
    const steps = form.steps.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!name) {
      setFormMsg("Give the recipe a name.");
      return;
    }
    if (!ing.length) {
      setFormMsg("Add at least one ingredient, one per line, like 1.5 lb ground beef.");
      return;
    }
    const id = "c" + Date.now();
    const recipe: Recipe = {
      id,
      name,
      s: name.length > 14 ? name.split(" ").slice(0, 2).join(" ").slice(0, 14) : name,
      cuisine: form.cuisine.trim() || "Family favorite",
      prot: form.prot,
      fridge: Math.max(1, Math.round(Number(form.fridge) || 4)),
      prep: Math.max(5, Math.round(Number(form.prep) || 30)),
      pg: Math.round(Number(form.pg) || 20),
      veg: Number(form.veg) || 2,
      kcal: 500,
      ing,
      steps: steps.length ? steps : ["Cook the protein, chop the vegetables, and pack in containers."],
      kid: form.kid.trim() || "Same base without sauce or spice.",
      isNew: true,
      addedWeek: weekId,
    };
    onChange({ ...state, recipes: state.recipes.concat([recipe]) });
    setForm(EMPTY_FORM);
    setAdding(false);
    setExpanded(id);
    setFormMsg("");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-gold-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl">Recipe book</h2>
            <p className="text-sm text-muted">
              {state.recipes.length} recipes · {newCount} new this week
            </p>
          </div>
          <button type="button" className={btnClass(true)} onClick={() => setAdding((value) => !value)}>
            {adding ? "Close form" : "Add a recipe"}
          </button>
        </div>
        <input className={`${inputClass} mt-3 w-full`} placeholder="Search by name, cuisine, or ingredient" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search recipes" />
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["new", "New"],
            ["liked", "Liked"],
            ["cabbage", "Cabbage"],
          ].map(([value, label]) => (
            <button key={value} type="button" className={btnClass(filter === value)} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
          <select className={inputClass} value={protein} aria-label="Protein" onChange={(event) => setProtein(event.target.value)}>
            <option value="all">All proteins</option>
            {PROTS.map((item) => (
              <option key={item} value={item}>
                {capWord(item)}
              </option>
            ))}
          </select>
        </div>
      </Card>
      {adding ? (
        <Card>
          <h3 className="font-serif text-2xl">Add a recipe</h3>
          <div className="mt-3 grid gap-2">
            <input className={inputClass} placeholder="Recipe name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-label="Recipe name" />
            <input className={inputClass} placeholder="Cuisine" value={form.cuisine} onChange={(event) => setForm({ ...form, cuisine: event.target.value })} aria-label="Cuisine" />
            <select className={inputClass} value={form.prot} aria-label="Protein" onChange={(event) => setForm({ ...form, prot: event.target.value })}>
              {PROTS.map((item) => (
                <option key={item} value={item}>
                  {cap(item)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm text-muted">Keeps (days)<input className={inputClass} type="number" value={form.fridge} onChange={(event) => setForm({ ...form, fridge: event.target.value })} /></label>
              <label className="text-sm text-muted">Prep minutes<input className={inputClass} type="number" value={form.prep} onChange={(event) => setForm({ ...form, prep: event.target.value })} /></label>
              <label className="text-sm text-muted">Protein g<input className={inputClass} type="number" value={form.pg} onChange={(event) => setForm({ ...form, pg: event.target.value })} /></label>
              <label className="text-sm text-muted">Veg servings<input className={inputClass} type="number" value={form.veg} onChange={(event) => setForm({ ...form, veg: event.target.value })} /></label>
            </div>
            <label className="text-sm text-muted">
              Ingredients for 4 servings, one per line
              <textarea className={`${inputClass} mt-1 w-full`} rows={5} value={form.ing} onChange={(event) => setForm({ ...form, ing: event.target.value })} />
            </label>
            <label className="text-sm text-muted">
              Steps, one per line
              <textarea className={`${inputClass} mt-1 w-full`} rows={4} value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} />
            </label>
            <input className={inputClass} placeholder="Kid container note" value={form.kid} onChange={(event) => setForm({ ...form, kid: event.target.value })} aria-label="Kid container note" />
            {formMsg ? <p className="text-orange">{formMsg}</p> : null}
            <button type="button" className={btnClass(true)} onClick={addRecipe}>
              Save recipe
            </button>
          </div>
        </Card>
      ) : null}
      {shown.length === 0 ? (
        <Card className="text-center">
          <h3 className="font-serif text-2xl">{filter === "liked" ? "No thumbs up yet" : "No recipes match"}</h3>
          <button type="button" className={`${btnClass()} mt-3`} onClick={() => { setFilter("all"); setProtein("all"); setQuery(""); }}>
            Clear filters
          </button>
        </Card>
      ) : (
        shown.map((recipe) => {
          const open = expanded === recipe.id || editing === recipe.id;
          const inWeek = picked.has(recipe.id);
          return (
            <Card key={recipe.id} className={`border-t-8 ${proteinTone(recipe.prot)}`}>
              <h3 className="font-serif text-2xl">{recipe.name}</h3>
              <div className="mt-2 flex flex-wrap gap-1">
                <Chip>{recipe.cuisine}</Chip>
                <Chip>{cap(recipe.prot)}</Chip>
                <Chip>keeps {recipe.fridge} days</Chip>
                {isNewNow(recipe, weekId) ? <span className="rounded-full bg-orange-soft px-2.5 py-1 text-xs text-orange">New this week</span> : null}
              </div>
              <p className="mt-2 text-sm text-muted">~{recipe.pg} g protein · {recipe.veg} veg · ~{recipe.prep} min</p>
              <p className="text-sm text-muted">Shares: {perish(recipe, false).slice(0, 5).join(", ") || "pantry staples"}</p>
              <p className="text-sm text-muted">{weeksAgo(recipe.id, state.hist, weekId) === Infinity ? "Not made yet" : "Logged in rotation history"}</p>
              {voters.map((member) => (
                <div key={member.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-muted">{member.name}</span>
                  <div className="flex gap-1">
                    {[
                      ["none", "No vote"],
                      ["up", "Thumbs up"],
                      ["down", "Thumbs down"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={btnClass(voteOf(state.votes, recipe.id, member.id) === value)}
                        onClick={() => onChange({ ...state, votes: { ...state.votes, [recipe.id]: { ...(state.votes[recipe.id] || {}), [member.id]: value } } })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnClass(!inWeek)}
                  onClick={() =>
                    onChange({
                      ...state,
                      picks: inWeek
                        ? state.picks.filter((pick) => pick.id !== recipe.id)
                        : state.picks.concat([{ id: recipe.id, mult: 1, opt: false, lock: false, day: "auto" }]),
                    })
                  }
                >
                  {inWeek ? "In this week" : "Add to week"}
                </button>
                <button type="button" className={btnClass()} onClick={() => setExpanded(expanded === recipe.id ? "" : recipe.id)}>
                  {open ? "Hide recipe" : "Ingredients and steps"}
                </button>
              </div>
              {open ? (
                <>
                  <RecipeBody recipe={recipe} hh={state.hh} editing={editing === recipe.id} onChange={(next) => patchRecipe(recipe.id, next)} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnClass()} onClick={() => setEditing(editing === recipe.id ? "" : recipe.id)}>
                      {editing === recipe.id ? "Done editing" : "Edit or substitute"}
                    </button>
                    {originals[recipe.id] ? (
                      <button type="button" className={btnClass()} onClick={() => patchRecipe(recipe.id, originals[recipe.id])}>
                        Reset to original
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={btnClass()}
                        onClick={() => onChange({ ...state, recipes: state.recipes.filter((item) => item.id !== recipe.id), picks: state.picks.filter((pick) => pick.id !== recipe.id) })}
                      >
                        Delete recipe
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}
