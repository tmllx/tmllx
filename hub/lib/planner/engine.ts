import { AISLES, COUNTABLE, DEFAULT_IDS, DEFAULT_RECIPES, PERISH } from "./catalog";
import type { Aisle, Extra, HH, Hist, Ing, Line, Pick, PlannerState, Recipe, Votes } from "./types";

export const UNITS: Record<string, string> = {
  lb: "lb",
  lbs: "lb",
  oz: "oz",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tsp: "tsp",
  can: "can",
  cans: "can",
  jar: "jar",
  jars: "jar",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  clove: "clove",
  cloves: "clove",
  pint: "pint",
  pints: "pint",
  stalk: "stalk",
  stalks: "stalk",
  slice: "slice",
  slices: "slice",
  pack: "pack",
  packs: "pack",
  ea: "ea",
};

export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function curWeekId(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
}

export function weekDiff(a: string, b: string): number {
  return Math.round((new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) / (7 * 86400000));
}

export function weekLabel(id: string): string {
  try {
    return new Date(id + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return id;
  }
}

export function fmtQ(q: number): string {
  if (q >= 10) return String(Math.round(q));
  const r = Math.round(q * 4) / 4;
  if (r <= 0) return "¼";
  const w = Math.floor(r);
  const f = r - w;
  const fs = f === 0.25 ? "¼" : f === 0.5 ? "½" : f === 0.75 ? "¾" : "";
  return (w > 0 ? String(w) : "") + fs;
}

const PLURAL: Record<string, string> = { bunch: "bunches" };

function pluralUnit(u: string, n: number): string {
  if (n === 1) return u;
  return PLURAL[u] || (u.endsWith("s") ? u : u + "s");
}

export function qtyLabel(q: number, u: string): string {
  if (!(q > 0)) return !u || u === "ea" ? "0" : "0 " + pluralUnit(u, 0);
  if (COUNTABLE.indexOf(u) >= 0) {
    const n = Math.max(1, Math.ceil(q - 0.01));
    return u === "ea" ? String(n) : n + " " + pluralUnit(u, n);
  }
  return fmtQ(q) + " " + u;
}

/** Step size for a shopping quantity. Countable items move by 1; measured items move by a quarter. */
export function qtyStep(unit: string): number {
  return COUNTABLE.indexOf(unit) >= 0 ? 1 : 0.25;
}

/** Shopper-facing amount. Matches qtyLabel so the stepper and the copied list agree. */
export function shoppingQty(q: number, unit: string): number {
  if (!(q > 0)) return 0;
  if (COUNTABLE.indexOf(unit) >= 0) return Math.max(1, Math.ceil(q - 0.01));
  if (q >= 10) return Math.round(q);
  const quarter = Math.round(q * 4) / 4;
  return quarter > 0 ? quarter : 0.25;
}

export function isNewNow(r: Recipe, weekId: string): boolean {
  return !!r.isNew && r.addedWeek === weekId;
}

export function effIngs(r: Recipe, p: Pick, hh: HH): Ing[] {
  const f = (hh.servings / 4) * p.mult;
  return r.ing
    .filter((i) => !i.o || p.opt)
    .map((i) => ({ ...i, n: hh.gf && i.gf ? i.gf : i.n, q: i.q * f, chk: hh.gf ? i.chk : undefined }));
}

export function perish(r: Recipe, withOpt: boolean): string[] {
  const out: string[] = [];
  r.ing.forEach((i) => {
    if (PERISH.indexOf(i.a) >= 0 && (!i.o || withOpt) && out.indexOf(i.n.toLowerCase()) < 0) out.push(i.n.toLowerCase());
  });
  return out;
}

export function kidTokens(hh: HH): string[] {
  const tokens: string[] = [];
  hh.members
    .filter((m) => m.role === "kid")
    .forEach((m) =>
      m.avoids.split(",").forEach((t) => {
        const x = t.trim().toLowerCase();
        if (x && tokens.indexOf(x) < 0) tokens.push(x);
      }),
    );
  return tokens;
}

export function kidSkip(name: string, tokens: string[]): boolean {
  const l = name.toLowerCase();
  if (/oil|vinegar/.test(l)) return false;
  return tokens.some((t) => l.indexOf(t) >= 0 || l.indexOf(t.replace(/s$/, "")) >= 0);
}

export function guessAisle(name: string): Aisle {
  const l = name.toLowerCase();
  const has = (ws: string[]) => ws.some((w) => l.indexOf(w) >= 0);
  if (has(["frozen"])) return "F";
  if (has(["chicken", "beef", "pork", "turkey", "salmon", "steak", "bacon", "shrimp", "sausage", "lamb"])) return "M";
  if (has(["cheese", "feta", "parmesan", "mozzarella", "provolone", "cheddar", "pepperoni", "salami", "prosciutto"])) return "C";
  if (has(["egg", "yogurt", "milk", "butter", "cream"])) return "D";
  if (has(["soy", "tamari", "miso", "fish sauce", "curry", "harissa", "rice vinegar", "sesame oil", "nori"])) return "I";
  if (has(["mayo", "ketchup", "mustard", "tahini", "dressing", "honey", "salsa", "pesto", "sriracha", "hot sauce"])) return "S";
  if (has(["rice", "pasta", "noodle", "bread", "pita", "tortilla", "quinoa", "oats"])) return "B";
  if (has(["canned", "bean", "chickpea", "olive", "nut", "almond", "peanut", "seed", "oil", "vinegar", "pickle", "tuna", "lentil", "cumin", "paprika", "oregano", "salt", "pepper", "caper", "date"]))
    return "G";
  return "P";
}

function numOf(s: string): number {
  if (s.indexOf("/") > 0) {
    const [a, b] = s.split("/");
    return parseFloat(a) / parseFloat(b);
  }
  return parseFloat(s);
}

export function parseIngLine(line: string): Ing | null {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  let q = 1;
  let i = 0;
  if (/^[\d./]+$/.test(parts[0]) && !isNaN(numOf(parts[0]))) {
    q = numOf(parts[0]);
    i = 1;
    if (parts[1] && /^\d\/\d$/.test(parts[1])) {
      q += numOf(parts[1]);
      i = 2;
    }
  }
  let u = "ea";
  if (parts[i] && UNITS[parts[i].toLowerCase()]) {
    u = UNITS[parts[i].toLowerCase()];
    i++;
  }
  if (parts[i] && parts[i].toLowerCase() === "of") i++;
  const name = parts.slice(i).join(" ");
  if (!name) return null;
  const a = guessAisle(name);
  return { n: cap(name), q, u, a, b: a === "P" ? "chop" : a === "M" ? "stove" : undefined };
}

function cleanCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}

/** Accept a tally, or an older map of member id to "up" | "down" | "none". */
export function tallyFrom(raw: unknown): { up: number; down: number } {
  if (!raw || typeof raw !== "object") return { up: 0, down: 0 };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.up === "number" || typeof obj.down === "number") {
    return { up: cleanCount(obj.up), down: cleanCount(obj.down) };
  }
  let up = 0;
  let down = 0;
  Object.values(obj).forEach((value) => {
    if (value === "up") up += 1;
    else if (value === "down") down += 1;
  });
  return { up, down };
}

export function voteTally(votes: Votes | undefined, id: string): { up: number; down: number } {
  return tallyFrom(votes ? votes[id] : undefined);
}

export function addVote(votes: Votes, id: string, side: "up" | "down"): Votes {
  const tally = voteTally(votes, id);
  return {
    ...votes,
    [id]: {
      up: tally.up + (side === "up" ? 1 : 0),
      down: tally.down + (side === "down" ? 1 : 0),
    },
  };
}

/** Fold per-person votes into one tally per recipe. Empty tallies are dropped. */
export function normalizeVotes(votes: unknown): Votes {
  if (!votes || typeof votes !== "object") return {};
  const out: Votes = {};
  Object.entries(votes as Record<string, unknown>).forEach(([id, raw]) => {
    const tally = tallyFrom(raw);
    if (tally.up > 0 || tally.down > 0) out[id] = tally;
  });
  return out;
}

export function weeksAgo(id: string, hist: Hist[], weekId: string): number {
  let best = Infinity;
  hist.forEach((h) => {
    if (h.ids.indexOf(id) >= 0) {
      const d = weekDiff(weekId, h.week);
      if (d < best) best = d;
    }
  });
  return best;
}

export function mergeCatalog(recipes: Recipe[], seenDefaultIds: string[] | undefined): { recipes: Recipe[]; seenDefaultIds: string[] } {
  const seen = seenDefaultIds ?? recipes.map((r) => r.id);
  const extras = DEFAULT_RECIPES.filter((d) => seen.indexOf(d.id) < 0 && !recipes.some((r) => r.id === d.id));
  return { recipes: recipes.concat(extras), seenDefaultIds: DEFAULT_IDS.slice() };
}

export interface DealInput {
  recipes: Recipe[];
  picks: Pick[];
  votes: Votes;
  hist: Hist[];
  hh: HH;
  count: number;
  bias: boolean;
  weekId: string;
  random?: () => number;
}

export interface DealResult {
  ok: boolean;
  message: string;
  picks: Pick[];
  why: Record<string, string[]>;
  chosen: string[];
  ring: string[];
}

export function dealWeek(input: DealInput): DealResult {
  const random = input.random ?? Math.random;
  const byId: Record<string, Recipe> = {};
  input.recipes.forEach((r) => {
    byId[r.id] = r;
  });
  const locked = input.picks.filter((p) => p.lock && byId[p.id]);
  const need = input.count - locked.length;
  const empty: DealResult = { ok: false, message: "", picks: input.picks, why: {}, chosen: [], ring: [] };
  if (need <= 0) {
    return { ...empty, message: "All " + input.count + " slots are locked. Unlock one or raise the count." };
  }
  const tallyOf = (id: string) => voteTally(input.votes, id);
  const vetoed = (id: string) => tallyOf(id).down > 0;
  const sel: string[] = locked.map((p) => p.id);
  const nm: Record<string, string[]> = {};
  const addN = (id: string, withOpt: boolean) =>
    perish(byId[id], withOpt).forEach((n) => {
      if (!nm[n]) nm[n] = [];
      nm[n].push(byId[id].s);
    });
  locked.forEach((p) => addN(p.id, p.opt));
  const dealtIds = input.picks.filter((p) => !p.lock).map((p) => p.id);
  const pool = input.recipes.filter((r) => sel.indexOf(r.id) < 0 && !(input.hh.vetoSkip && vetoed(r.id)));
  const baseOf = (r: Recipe): number => {
    const tally = tallyOf(r.id);
    const net = tally.up - tally.down;
    let b = net > 0 ? 1 + 0.6 * net : net < 0 ? Math.pow(0.25, -net) : 1;
    const wa = weeksAgo(r.id, input.hist, input.weekId);
    b *= wa === Infinity ? 1.25 : wa <= 1 ? 0.25 : wa === 2 ? 0.5 : wa === 3 ? 0.75 : 1;
    if (dealtIds.indexOf(r.id) >= 0) b *= 0.3;
    return b * (0.9 + random() * 0.2);
  };
  const freq = (n: string) => input.recipes.filter((x) => x.ing.some((i) => i.n.toLowerCase() === n)).length / input.recipes.length;
  const gainOf = (r: Recipe) => {
    const shared = perish(r, false)
      .filter((n) => !!nm[n])
      .sort((x, y) => freq(x) - freq(y));
    let g = 0;
    shared.forEach((n) => {
      g += n.indexOf("cabbage") >= 0 || n.indexOf("kale") >= 0 ? 1.5 : Math.max(0.2, 1 - 2 * freq(n));
    });
    return { g, shared };
  };
  const whyMap: Record<string, string[]> = {};
  const chosen: string[] = [];
  const take = (r: Recipe) => {
    const rs: string[] = [];
    if (isNewNow(r, input.weekId)) rs.push("New this week");
    const tally = tallyOf(r.id);
    if (tally.up || tally.down) {
      const net = tally.up - tally.down;
      rs.push("Net " + (net > 0 ? "+" : "") + net + " (" + tally.up + " up, " + tally.down + " down)");
    }
    const wa = weeksAgo(r.id, input.hist, input.weekId);
    rs.push(wa === Infinity ? "Not made yet" : wa <= 0 ? "Made this week" : wa === 1 ? "Made last week, so ranked lower" : "Last made " + wa + " weeks ago");
    const gi = gainOf(r);
    if (gi.shared.length) {
      const withs: string[] = [];
      gi.shared.forEach((n) => nm[n].forEach((s) => { if (withs.indexOf(s) < 0) withs.push(s); }));
      rs.push("Shares " + gi.shared.slice(0, 3).join(", ") + " with " + withs.slice(0, 3).join(", "));
    } else if (sel.length === 0) rs.push("Anchor pick for the week");
    whyMap[r.id] = rs;
    chosen.push(r.id);
    sel.push(r.id);
    addN(r.id, false);
    pool.splice(pool.indexOf(r), 1);
  };
  if (input.hh.forceNew && !sel.some((id) => byId[id] && isNewNow(byId[id], input.weekId))) {
    const cands = pool
      .filter((r) => isNewNow(r, input.weekId))
      .map((r) => ({ r, s: baseOf(r) * (1 + 0.5 * gainOf(r).g) }))
      .sort((a, b) => b.s - a.s);
    if (cands.length) take(cands[0].r);
  }
  while (chosen.length < need && pool.length > 0) {
    const scored = pool
      .map((r) => {
        let s = baseOf(r) * (1 + (input.bias ? 0.5 : 0) * gainOf(r).g);
        const same = sel.filter((id) => byId[id].prot === r.prot).length;
        s *= same >= 2 ? 0.3 : same === 1 ? 0.7 : 1;
        if (isNewNow(r, input.weekId) && sel.some((id) => isNewNow(byId[id], input.weekId))) s *= 0.55;
        return { r, s };
      })
      .sort((a, b) => b.s - a.s);
    take(scored[0].r);
  }
  if (chosen.length === 0) {
    return { ...empty, message: "Nothing new to deal. Add a recipe or unlock a slot." };
  }
  const others = pool
    .map((r) => ({ id: r.id, s: baseOf(r) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(0, 12 - chosen.length))
    .map((x) => x.id);
  const ring = chosen
    .concat(others)
    .map((id) => ({ id, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.id);
  const picks = locked.concat(chosen.map((id) => ({ id, mult: 1, opt: false, lock: false, day: "auto" })));
  return {
    ok: true,
    message: "The wheel landed on " + byId[chosen[0]].name + ". Your week is dealt below, with the reason for each pick.",
    picks,
    why: whyMap,
    chosen,
    ring,
  };
}

export function assignDays(picks: Pick[], byId: Record<string, Recipe>): Record<string, string> {
  const live = picks.filter((p) => byId[p.id]);
  const dayOf: Record<string, string> = {};
  const forced1 = live.filter((p) => p.day === "d1").length;
  const target1 = Math.ceil(live.length / 2);
  let c1 = forced1;
  live.filter((p) => p.day === "d1" || p.day === "d2").forEach((p) => {
    dayOf[p.id] = p.day;
  });
  live
    .filter((p) => p.day === "auto")
    .sort((x, y) => {
      const a = byId[x.id];
      const b = byId[y.id];
      return a.prot === b.prot ? b.fridge - a.fridge : a.prot < b.prot ? -1 : 1;
    })
    .forEach((p) => {
      if (c1 < target1) {
        dayOf[p.id] = "d1";
        c1++;
      } else dayOf[p.id] = "d2";
    });
  return dayOf;
}

export interface ShopItem {
  name: string;
  quantity: number;
  unit: string;
  aisle: string;
  forRecipes: string[];
  checkLabel: string;
  searchQuery: string;
}

export interface ShoppingList {
  lines: Line[];
  active: Line[];
  pantryLines: Line[];
  included: Line[];
  flagged: Line[];
  extrasIn: Extra[];
  itemCount: number;
  text: string;
  json: string;
  shared: { name: string; count: number; bowls: string[] }[];
  score: number;
  saves: number;
  grade: string;
}

/** Stepper amount plus the leftover unit text for a freeform extra qty.
 *  A blank qty is 1, same as the JSON handoff. Fractions such as "1/2 cup"
 *  stay one amount so the unit is not split off and rewritten.
 */
export function splitExtraQty(qty: string): { amount: number; suffix: string } {
  const trimmed = qty.trim();
  if (!trimmed) return { amount: 1, suffix: "" };

  const mixed = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)(.*)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    if (den) return { amount: round3(Number(mixed[1]) + Number(mixed[2]) / den), suffix: mixed[4] };
    return { amount: 1, suffix: " " + trimmed };
  }

  const frac = trimmed.match(/^(\d+)\s*\/\s*(\d+)(.*)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den) return { amount: round3(Number(frac[1]) / den), suffix: frac[3] };
    return { amount: 1, suffix: " " + trimmed };
  }

  const whole = trimmed.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (whole) return { amount: Number(whole[1]), suffix: whole[2] };
  return { amount: 1, suffix: " " + trimmed };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function leadingAmount(qty: string): number {
  return splitExtraQty(qty).amount;
}

export function buildShopping(state: PlannerState): ShoppingList {
  const byId: Record<string, Recipe> = {};
  state.recipes.forEach((r) => {
    byId[r.id] = r;
  });
  const live = state.picks.filter((p) => byId[p.id]);
  const lines: Line[] = [];
  const lineMap: Record<string, Line> = {};
  live.forEach((p) => {
    const r = byId[p.id];
    effIngs(r, p, state.hh).forEach((i) => {
      const key = i.n.toLowerCase() + "|" + i.u;
      if (!lineMap[key]) {
        lineMap[key] = { key, name: i.n, q: 0, u: i.u, a: i.a, from: [] };
        lines.push(lineMap[key]);
      }
      lineMap[key].q += i.q;
      if (i.chk) lineMap[key].chk = i.chk;
      if (lineMap[key].from.indexOf(r.s) < 0) lineMap[key].from.push(r.s);
    });
  });
  const overrides = state.qty || {};
  lines.forEach((line) => {
    const custom = overrides[line.key];
    if (typeof custom === "number" && Number.isFinite(custom) && custom >= 0) line.q = Math.round(custom * 1000) / 1000;
    else line.q = shoppingQty(line.q, line.u);
  });
  const inPantry = (l: Line) => state.pantry.indexOf(l.name.toLowerCase()) >= 0;
  const active = lines.filter((l) => !inPantry(l));
  const pantryLines = lines.filter(inPantry);
  const dispName = (l: Line) => state.subs[l.key] || l.name;
  const included = active.filter((l) => state.off.indexOf(l.key) < 0);
  const flagged = included.filter((l) => !!l.chk);
  const extrasIn = state.extras.filter((x) => state.off.indexOf("x:" + x.id) < 0);
  const itemCount = included.length + extrasIn.length;
  let text = "Shopping list. Handoff for a person to shop. Nothing is ordered and no store account is used." + (state.hh.gf ? " Gluten-free household." : "") + "\n";
  AISLES.forEach((a) => {
    const ls = included.filter((l) => l.a === a[0]);
    const xs = extrasIn.filter((x) => x.a === a[0]);
    if (!ls.length && !xs.length) return;
    text += "\n" + a[1] + "\n";
    ls.forEach((l) => {
      text += "- " + qtyLabel(l.q, l.u) + " " + dispName(l) + " (" + l.from.join(", ") + ")" + (l.chk ? " [check label: " + l.chk + "]" : "") + "\n";
    });
    xs.forEach((x) => {
      const typed = x.qty.trim();
      text += "- " + (typed ? typed + " " : "1 ") + x.name + " (added)\n";
    });
  });
  const items: ShopItem[] = included
    .map((l) => ({
      name: dispName(l),
      quantity: Math.round(l.q * 1000) / 1000,
      unit: l.u,
      aisle: AISLES.filter((a) => a[0] === l.a)[0][1],
      forRecipes: l.from,
      checkLabel: l.chk || "",
      searchQuery: (state.hh.gf ? "gluten free " : "") + dispName(l),
    }))
    .concat(
      extrasIn.map((x) => ({
        name: x.name,
        quantity: leadingAmount(x.qty),
        unit: "",
        aisle: AISLES.filter((a) => a[0] === x.a)[0][1],
        forRecipes: [],
        checkLabel: "",
        searchQuery: x.name,
      })),
    );
  const json = JSON.stringify(
    {
      type: "mealprep-shopping-handoff",
      version: 1,
      purpose: "A shopping list only. No order is placed. Do not attach payment or store credentials.",
      glutenFree: state.hh.gf,
      servingsPerBatch: state.hh.servings,
      meals: live.map((p) => ({ recipe: byId[p.id].name, multiplier: p.mult })),
      items,
    },
    null,
    2,
  );
  const pickNames: Record<string, string[]> = {};
  live.forEach((p) => {
    perish(byId[p.id], p.opt).forEach((n) => {
      if (!pickNames[n]) pickNames[n] = [];
      pickNames[n].push(byId[p.id].s);
    });
  });
  const distinct = Object.keys(pickNames).length;
  const sharedNames = Object.keys(pickNames)
    .filter((n) => pickNames[n].length >= 2)
    .sort((a, b) => pickNames[b].length - pickNames[a].length);
  const score = distinct > 0 ? Math.round((100 * sharedNames.length) / distinct) : 0;
  const saves = sharedNames.reduce((a, n) => a + pickNames[n].length - 1, 0);
  const grade = score >= 45 ? "Great" : score >= 30 ? "Good" : "Loose";
  return {
    lines,
    active,
    pantryLines,
    included,
    flagged,
    extrasIn,
    itemCount,
    text,
    json,
    shared: sharedNames.map((n) => ({ name: n, count: pickNames[n].length, bowls: pickNames[n] })),
    score,
    saves,
    grade,
  };
}

export function suggestionsFor(state: PlannerState): { id: string; name: string; hit: string[] }[] {
  const byId: Record<string, Recipe> = {};
  state.recipes.forEach((r) => {
    byId[r.id] = r;
  });
  const live = state.picks.filter((p) => byId[p.id]);
  const pickNames: Record<string, string[]> = {};
  live.forEach((p) => {
    perish(byId[p.id], p.opt).forEach((n) => {
      if (!pickNames[n]) pickNames[n] = [];
      pickNames[n].push(byId[p.id].s);
    });
  });
  const picked = live.map((p) => p.id);
  return state.recipes
    .filter((r) => picked.indexOf(r.id) < 0)
    .map((r) => {
      const ns = perish(r, false);
      const hit = ns.filter((n) => !!pickNames[n]);
      return { r, hit, gain: hit.length - 0.3 * (ns.length - hit.length) };
    })
    .filter((x) => x.hit.length > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map((x) => ({ id: x.r.id, name: x.r.name, hit: x.hit }));
}

const HANDOFF_NOTE = "Nothing is ordered";

export function handoffDeclaresNoOrder(text: string): boolean {
  return text.includes(HANDOFF_NOTE);
}
