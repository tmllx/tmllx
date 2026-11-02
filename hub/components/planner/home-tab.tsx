"use client";

import { useState } from "react";
import { cap, dealWeek, isNewNow, qtyLabel, suggestionsFor, voteOf, weekLabel, weeksAgo, buildShopping } from "@/lib/planner/engine";
import { mergeDealtWeek } from "@/lib/planner/save";
import type { HH, Pick, PlannerState, Recipe } from "@/lib/planner/types";
import { RecipeBody } from "./recipe-body";
import { Card, Chip, btnClass, proteinTone, recipeById } from "./ui";

export function HomeTab({
  state,
  weekId,
  onChange,
}: {
  state: PlannerState;
  weekId: string;
  onChange: (next: PlannerState | ((state: PlannerState) => PlannerState)) => void;
}) {
  const [showOpts, setShowOpts] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState("");
  const [openId, setOpenId] = useState("");
  const [wheelIds, setWheelIds] = useState<string[]>(state.recipes.slice(0, 8).map((recipe) => recipe.id));
  const [rotation, setRotation] = useState(0);
  const [showNutrition, setShowNutrition] = useState(false);
  const byId = recipeById(state.recipes);
  const live = state.picks.filter((pick) => byId[pick.id]);
  const voters = state.hh.members.filter((member) => member.votes);
  const shop = buildShopping(state);
  const ideas = suggestionsFor(state);
  const meals = live.reduce((sum, pick) => sum + pick.mult, 0);

  function patch(partial: Partial<PlannerState>) {
    onChange({ ...state, ...partial });
  }
  function patchHH(partial: Partial<HH>) {
    patch({ hh: { ...state.hh, ...partial } });
  }
  function patchPick(id: string, partial: Partial<Pick>) {
    patch({ picks: state.picks.map((pick) => (pick.id === id ? { ...pick, ...partial } : pick)) });
  }

  function spin() {
    if (spinning) return;
    const result = dealWeek({
      recipes: state.recipes,
      picks: state.picks,
      votes: state.votes,
      hist: state.hist,
      hh: state.hh,
      count: state.count,
      bias: state.bias,
      weekId,
    });
    setMessage(result.message);
    if (!result.ok) return;
    const ring = result.ring.filter((id) => byId[id]);
    const slice = ring.length ? 360 / ring.length : 360;
    const first = Math.max(0, ring.indexOf(result.chosen[0]));
    const center = first * slice + slice / 2;
    const current = ((rotation % 360) + 360) % 360;
    const delta = (((360 - center - current) % 360) + 360) % 360;
    setWheelIds(ring);
    setSpinning(true);
    setRotation(rotation + 360 * 4 + delta);
    const picks = result.picks;
    const why = result.why;
    window.setTimeout(() => {
      onChange((latest) => mergeDealtWeek(latest, picks, why));
      setSpinning(false);
    }, 900);
  }

  const dayOf = assign(live, byId);
  const plans = ["d1", "d2"].map((day) => buildDay(day, live, dayOf, byId, state.hh));
  const prepTotal = plans[0].mins + plans[1].mins;
  const savedMin = meals * state.hh.nightlyCook - (prepTotal + meals * state.hh.assemble);
  const avg = (fn: (recipe: Recipe, pick: Pick) => number) => (meals ? Math.round((live.reduce((sum, pick) => sum + fn(byId[pick.id], pick) * pick.mult, 0) / meals) * 10) / 10 : 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-pine-soft">
        <p className="text-sm text-muted">Week of {weekLabel(weekId)}</p>
        <h2 className="font-serif text-3xl tracking-tight">{live.length ? "Menu for this week" : "Plan the week in one tap"}</h2>
        <p className="mt-1 text-muted">
          {live.length
            ? meals + " dinners, prepped in two sessions."
            : "Deal a week of smash bowls. Shared ingredients keep the shopping list short."}
        </p>
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">Dinners this week</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Dinner count">
            {[3, 4, 5, 6, 7].map((count) => (
              <button key={count} type="button" className={btnClass(state.count === count)} onClick={() => patch({ count })}>
                {count}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnClass(true)} onClick={spin} disabled={spinning}>
            {spinning ? "Dealing the week..." : live.length ? "Deal a fresh week" : "Deal my week"}
          </button>
          <button type="button" className={btnClass()} onClick={() => setShowOpts((value) => !value)}>
            {showOpts ? "Hide options" : "Rotation options"}
          </button>
        </div>
        {showOpts ? (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Toggle label="Prefer bowls that share ingredients" checked={state.bias} onChange={(bias) => patch({ bias })} />
            <Toggle label="Always include a recipe that is new this week" checked={state.hh.forceNew} onChange={(forceNew) => patchHH({ forceNew })} />
            <Toggle label="Skip bowls with a thumbs down" checked={state.hh.vetoSkip} onChange={(vetoSkip) => patchHH({ vetoSkip })} />
            <p className="text-muted">Rotation weighs thumbs, how long since you made a bowl, and shared ingredients. Locked picks stay.</p>
          </div>
        ) : null}
        {message ? <p className="mt-3 font-medium">{message}</p> : null}
        <Wheel ids={wheelIds.filter((id) => byId[id])} byId={byId} rotation={rotation} spinning={spinning} />
      </Card>

      {!live.length ? (
        <Card className="text-center">
          <h3 className="font-serif text-2xl">Nothing on the menu yet</h3>
          <p className="mt-1 text-muted">Deal a week, or add bowls from the recipe book.</p>
        </Card>
      ) : null}

      {live.map((pick) => {
        const recipe = byId[pick.id];
        const open = openId === pick.id;
        return (
          <Card key={pick.id} className={`border-l-8 ${proteinTone(recipe.prot)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-2xl">{recipe.name}</h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Chip>{recipe.cuisine}</Chip>
                  <Chip>{cap(recipe.prot)}</Chip>
                  <Chip>keeps {recipe.fridge} days</Chip>
                  <Chip>prep {dayOf[pick.id] === "d1" ? state.hh.day1 : state.hh.day2}</Chip>
                  {isNewNow(recipe, weekId) ? <span className="rounded-full bg-orange-soft px-2.5 py-1 text-xs text-orange">New this week</span> : null}
                </div>
              </div>
              <p className="text-sm text-muted">
                ~{recipe.pg + (pick.opt && recipe.optPg ? recipe.optPg : 0)} g protein
                <br />
                {recipe.veg} veg servings
              </p>
            </div>
            {state.why[pick.id]?.length ? <p className="mt-3 text-sm text-muted">Why this one: {state.why[pick.id].join(" · ")}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 2, 3].map((mult) => (
                <button key={mult} type="button" className={btnClass(pick.mult === mult)} onClick={() => patchPick(pick.id, { mult })}>
                  {mult}x
                </button>
              ))}
              {[
                ["auto", "Auto"],
                ["d1", state.hh.day1.slice(0, 3)],
                ["d2", state.hh.day2.slice(0, 3)],
              ].map(([value, label]) => (
                <button key={value} type="button" className={btnClass(pick.day === value)} onClick={() => patchPick(pick.id, { day: value })}>
                  {label}
                </button>
              ))}
              {recipe.ing.some((item) => item.o) ? (
                <Toggle label="Protein add" checked={pick.opt} onChange={(opt) => patchPick(pick.id, { opt })} />
              ) : null}
            </div>
            {voters.length ? (
              <div className="mt-3 flex flex-col gap-2">
                {voters.map((member) => (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-muted">{member.name}</span>
                    <div className="flex gap-1" role="group" aria-label={member.name + " vote"}>
                      {[
                        ["none", "No vote"],
                        ["up", "Thumbs up"],
                        ["down", "Thumbs down"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={voteOf(state.votes, recipe.id, member.id) === value}
                          className={btnClass(voteOf(state.votes, recipe.id, member.id) === value)}
                          onClick={() =>
                            patch({
                              votes: { ...state.votes, [recipe.id]: { ...(state.votes[recipe.id] || {}), [member.id]: value } },
                            })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-sm text-muted">{weeksAgo(recipe.id, state.hist, weekId) === Infinity ? "Not made yet" : "In the rotation history"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnClass()} onClick={() => setOpenId(open ? "" : pick.id)}>
                {open ? "Hide ingredients and steps" : "Ingredients and steps"}
              </button>
              <button type="button" className={btnClass(pick.lock)} onClick={() => patchPick(pick.id, { lock: !pick.lock })}>
                {pick.lock ? "Locked" : "Lock"}
              </button>
              <button type="button" className={btnClass()} onClick={() => patch({ picks: state.picks.filter((item) => item.id !== pick.id) })}>
                Remove
              </button>
            </div>
            {open ? <RecipeBody recipe={recipe} hh={state.hh} editing={false} /> : null}
          </Card>
        );
      })}

      {live.length ? (
        <Card>
          <h3 className="font-serif text-2xl">The week at a glance</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Prep time" value={prepTotal + " min"} />
            <Stat label="Time saved" value={(savedMin >= 0 ? "" : "-") + Math.abs(savedMin) + " min"} />
            <Stat label="Protein" value={Math.round(avg((recipe, pick) => recipe.pg + (pick.opt && recipe.optPg ? recipe.optPg : 0))) + " g"} />
            <Stat label="Pairing" value={shop.score + "/100 " + shop.grade} />
          </div>
          {shop.shared.length ? (
            <p className="mt-3 text-sm text-muted">
              Shared: {shop.shared.slice(0, 8).map((item) => cap(item.name) + " x" + item.count).join(", ")}. {shop.saves} fewer purchases.
            </p>
          ) : null}
          {ideas.length ? (
            <div className="mt-3 flex flex-col gap-2">
              <h4 className="font-medium">Add one more without adding waste</h4>
              {ideas.map((idea) => (
                <div key={idea.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{idea.name}</p>
                    <p className="text-sm text-muted">Shares {idea.hit.slice(0, 4).join(", ")}</p>
                  </div>
                  <button
                    type="button"
                    className={btnClass()}
                    onClick={() => patch({ picks: state.picks.concat([{ id: idea.id, mult: 1, opt: false, lock: false, day: "auto" }]) })}
                  >
                    Add to week
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <button type="button" className={`${btnClass()} mt-3`} onClick={() => setShowNutrition((value) => !value)}>
            {showNutrition ? "Hide nutrition" : "Nutrition by bowl"}
          </button>
          {showNutrition ? (
            <div className="mt-3 overflow-x-auto text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1">Bowl</th>
                    <th>Protein g</th>
                    <th>Veg</th>
                    <th>kcal</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((pick) => (
                    <tr key={pick.id}>
                      <td className="py-1">{byId[pick.id].s}</td>
                      <td>{byId[pick.id].pg + (pick.opt && byId[pick.id].optPg ? byId[pick.id].optPg || 0 : 0)}</td>
                      <td>{byId[pick.id].veg}</td>
                      <td>{byId[pick.id].kcal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-muted">Estimates only, not a dietitian plan.</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {live.length ? (
        <div className="grid gap-3">
          {[
            { title: state.hh.day1, cover: state.hh.day1cover, plan: plans[0] },
            { title: state.hh.day2, cover: state.hh.day2cover, plan: plans[1] },
          ].map((day) => (
            <Card key={day.title}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-2xl">{day.title}</h3>
                <span className="rounded-full bg-gold-soft px-3 py-1 text-sm">about {day.plan.mins} min</span>
              </div>
              <p className="text-sm text-muted">Covers {day.cover}</p>
              {day.plan.steps.length ? (
                <ol className="mt-3 flex flex-col gap-3">
                  {day.plan.steps.map((step, index) => (
                    <li key={step.title}>
                      <p className="font-medium">
                        {index + 1}. {step.title}
                      </p>
                      {step.lines.map((line) => (
                        <p key={line} className="text-sm">
                          {line}
                        </p>
                      ))}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-muted">Nothing assigned to this day.</p>
              )}
            </Card>
          ))}
        </div>
      ) : null}

      {live.length ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl">All set for the week?</h3>
            <p className="text-sm text-muted">Mark it as made and the next rotation will rest these bowls.</p>
          </div>
          <button
            type="button"
            className={btnClass(true)}
            onClick={() => patch({ hist: state.hist.filter((item) => item.week !== weekId).concat([{ week: weekId, ids: live.map((pick) => pick.id) }]) })}
          >
            {state.hist.some((item) => item.week === weekId) ? "Update history for this week" : "Mark this week as made"}
          </button>
        </Card>
      ) : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-serif text-2xl">{value}</p>
    </div>
  );
}

function Wheel({ ids, byId, rotation, spinning }: { ids: string[]; byId: Record<string, Recipe>; rotation: number; spinning: boolean }) {
  const slice = ids.length ? 360 / ids.length : 360;
  const point = (deg: number) => ({ x: 100 + 78 * Math.sin((deg * Math.PI) / 180), y: 100 - 78 * Math.cos((deg * Math.PI) / 180) });
  return (
    <div className="mx-auto mt-4 w-52">
      <div className="mx-auto h-0 w-0 border-x-8 border-t-14 border-x-transparent border-t-ink" />
      <div style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 0.9s ease" : "none" }}>
        <svg viewBox="0 0 200 200" role="img" aria-label="Recipe wheel">
          {ids.map((id, index) => {
            const start = index * slice;
            const end = (index + 1) * slice;
            const a = point(start);
            const b = point(end);
            const label = byId[id].s.length > 12 ? byId[id].s.slice(0, 11) + "." : byId[id].s;
            return (
              <g key={id}>
                <path d={`M100 100 L${a.x} ${a.y} A78 78 0 ${slice > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`} className={index % 3 === 0 ? "fill-orange-soft" : index % 3 === 1 ? "fill-pine-soft" : "fill-gold-soft"} stroke="#e2d8c8" />
                <text x="100" y="100" fill="#1c1915" fontSize="8" transform={`rotate(${start + slice / 2 - 90} 100 100) translate(28 0)`}>
                  {label}
                </text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="10" fill="#fffaf2" stroke="#e2d8c8" />
        </svg>
      </div>
    </div>
  );
}

function assign(picks: Pick[], byId: Record<string, Recipe>) {
  const dayOf: Record<string, string> = {};
  const target = Math.ceil(picks.length / 2);
  let count = picks.filter((pick) => pick.day === "d1").length;
  picks.filter((pick) => pick.day === "d1" || pick.day === "d2").forEach((pick) => {
    dayOf[pick.id] = pick.day;
  });
  picks
    .filter((pick) => pick.day === "auto")
    .forEach((pick) => {
      if (count < target) {
        dayOf[pick.id] = "d1";
        count += 1;
      } else dayOf[pick.id] = "d2";
    });
  void byId;
  return dayOf;
}

function buildDay(day: string, picks: Pick[], dayOf: Record<string, string>, byId: Record<string, Recipe>, hh: HH) {
  const todays = picks.filter((pick) => dayOf[pick.id] === day);
  const groups: Record<string, { title: string; line: string }> = {};
  const sauces: string[] = [];
  todays.forEach((pick) => {
    const recipe = byId[pick.id];
    const bits: string[] = [];
    recipe.ing
      .filter((item) => !item.o || pick.opt)
      .forEach((item) => {
        const name = hh.gf && item.gf ? item.gf : item.n;
        if (!item.b) return;
        if (item.b === "sauce") {
          bits.push(qtyLabel(item.q * (hh.servings / 4) * pick.mult, item.u) + " " + name.toLowerCase());
          return;
        }
        const key = item.b + name.toLowerCase();
        groups[key] = { title: item.b, line: name.toLowerCase() + (item.how ? ": " + item.how : "") + " (" + recipe.s + ")" };
      });
    if (bits.length) sauces.push(recipe.s + ": " + bits.join(", "));
  });
  const steps: { title: string; lines: string[] }[] = [];
  (["oven", "stove", "chop"] as const).forEach((phase) => {
    const lines = Object.values(groups)
      .filter((group) => group.title === phase)
      .map((group) => group.line);
    if (lines.length) steps.push({ title: phase === "oven" ? "Oven first" : phase === "stove" ? "Stove while the oven runs" : "Chop once, split across bowls", lines });
  });
  if (sauces.length) steps.push({ title: "Sauces and dressings", lines: sauces });
  if (todays.length) {
    steps.push({
      title: "Assemble, lid and label",
      lines: todays.map((pick) => byId[pick.id].name + " x" + pick.mult + ". " + (byId[pick.id].steps.at(-1) || "") + (hh.kidNoSauce ? " No sauce on the kid container." : "")),
    });
  }
  const mins = Math.max(todays.length ? 15 : 0, Math.round((todays.reduce((sum, pick) => sum + byId[pick.id].prep, 0) + (todays.length ? 10 : 0)) / 5) * 5);
  return { steps, mins };
}
