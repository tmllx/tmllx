import { DEFAULT_HH, DEFAULT_IDS, DEFAULT_PANTRY, DEFAULT_PICKS, DEFAULT_RECIPES } from "./catalog";
import { mergeCatalog } from "./engine";
import type { PlannerState } from "./types";

export function defaultPlannerState(): PlannerState {
  return {
    recipes: DEFAULT_RECIPES.map((r) => ({ ...r, ing: r.ing.map((i) => ({ ...i })), steps: r.steps.slice() })),
    hh: {
      ...DEFAULT_HH,
      members: DEFAULT_HH.members.map((m) => ({ ...m })),
    },
    votes: {},
    picks: DEFAULT_PICKS.map((p) => ({ ...p })),
    why: {},
    hist: [],
    off: [],
    subs: {},
    pantry: DEFAULT_PANTRY.slice(),
    extras: [],
    count: 5,
    bias: true,
    seenDefaultIds: DEFAULT_IDS.slice(),
  };
}

export function normalizePlanner(input: Partial<PlannerState> | null | undefined): PlannerState {
  const base = defaultPlannerState();
  if (!input || !Array.isArray(input.recipes)) return base;
  const merged = mergeCatalog(input.recipes, input.seenDefaultIds);
  return {
    recipes: merged.recipes,
    hh: { ...base.hh, ...(input.hh || {}), members: input.hh?.members?.length ? input.hh.members : base.hh.members },
    votes: input.votes || {},
    picks: Array.isArray(input.picks) ? input.picks : base.picks,
    why: input.why || {},
    hist: Array.isArray(input.hist) ? input.hist : [],
    off: Array.isArray(input.off) ? input.off : [],
    subs: input.subs || {},
    pantry: Array.isArray(input.pantry) ? input.pantry : base.pantry,
    extras: Array.isArray(input.extras) ? input.extras : [],
    count: typeof input.count === "number" ? input.count : 5,
    bias: typeof input.bias === "boolean" ? input.bias : true,
    seenDefaultIds: merged.seenDefaultIds,
  };
}

export function isPlannerState(value: unknown): value is PlannerState {
  if (!value || typeof value !== "object") return false;
  const v = value as PlannerState;
  return Array.isArray(v.recipes) && !!v.hh && Array.isArray(v.hh.members) && Array.isArray(v.picks);
}
