import { describe, expect, it } from "vitest";
import { DEFAULT_HH, DEFAULT_RECIPES, NEW_WEEK } from "@/lib/planner/catalog";
import { addVote, buildShopping, dealWeek, handoffDeclaresNoOrder, isNewNow, normalizeVotes, parseIngLine } from "@/lib/planner/engine";
import { defaultPlannerState, normalizePlanner } from "@/lib/planner/state";
import type { HH, PlannerState } from "@/lib/planner/types";

const quiet = () => 0;

function hh(extra: Partial<HH> = {}): HH {
  return {
    ...DEFAULT_HH,
    ...extra,
    members: extra.members || [
      { id: "a", name: "Adult 1", role: "adult", avoids: "", votes: true },
      { id: "k", name: "Child 1", role: "kid", avoids: "", votes: false },
    ],
  };
}

describe("planner", () => {
  it("ships the starter book without personal names", () => {
    expect(DEFAULT_RECIPES.length).toBeGreaterThanOrEqual(25);
    const state = defaultPlannerState();
    expect(state.hh.members.map((member) => member.name)).toEqual(["Adult 1", "Adult 2", "Child 1", "Child 2"]);
    expect(state.hh.members.every((member) => member.avoids === "")).toBe(true);
  });

  it("marks the November 2026 additions as new only that week", () => {
    const fresh = DEFAULT_RECIPES.find((recipe) => recipe.id === "greengoddess");
    expect(fresh && isNewNow(fresh, NEW_WEEK)).toBe(true);
    expect(fresh && isNewNow(fresh, "2026-11-08")).toBe(false);
    expect(isNewNow(DEFAULT_RECIPES[0], NEW_WEEK)).toBe(false);
  });

  it("weights thumbs and can skip a veto", () => {
    const recipes = DEFAULT_RECIPES.slice(0, 2);
    const liked = dealWeek({
      recipes,
      picks: [],
      votes: { [recipes[0].id]: { up: 1, down: 0 }, [recipes[1].id]: { up: 0, down: 1 } },
      hist: [],
      hh: hh({ forceNew: false }),
      count: 1,
      bias: false,
      weekId: "2020-01-05",
      random: quiet,
    });
    expect(liked.picks.map((pick) => pick.id)).toEqual([recipes[0].id]);

    const skipped = dealWeek({
      recipes: DEFAULT_RECIPES,
      picks: [],
      votes: { burger: { up: 0, down: 1 } },
      hist: [],
      hh: hh({ forceNew: false, vetoSkip: true }),
      count: 4,
      bias: true,
      weekId: "2020-01-05",
      random: quiet,
    });
    expect(skipped.picks.some((pick) => pick.id === "burger")).toBe(false);
  });

  it("ranks a net thumbs-up above a bowl with no votes", () => {
    const recipes = DEFAULT_RECIPES.slice(0, 2);
    const dealt = dealWeek({
      recipes,
      picks: [],
      votes: { [recipes[0].id]: { up: 2, down: 1 } },
      hist: [],
      hh: hh({ forceNew: false }),
      count: 1,
      bias: false,
      weekId: "2020-01-05",
      random: quiet,
    });
    expect(dealt.picks.map((pick) => pick.id)).toEqual([recipes[0].id]);
    expect(dealt.why[recipes[0].id].some((line) => line.includes("Net +1"))).toBe(true);
  });

  it("folds per-person votes into one tally and keeps later clicks", () => {
    expect(
      normalizeVotes({
        burger: { m1: "up", m2: "down", m3: "none", m4: "up" },
        taco: { up: 3, down: 1 },
        eggsalad: { a: "none" },
      }),
    ).toEqual({
      burger: { up: 2, down: 1 },
      taco: { up: 3, down: 1 },
    });
    const loaded = normalizePlanner({
      ...defaultPlannerState(),
      votes: { burger: { m1: "up", m2: "down" } } as unknown as PlannerState["votes"],
    });
    expect(loaded.votes.burger).toEqual({ up: 1, down: 1 });
    expect(addVote(loaded.votes, "burger", "up").burger).toEqual({ up: 2, down: 1 });
  });

  it("includes a new recipe when the household asks for one", () => {
    const dealt = dealWeek({
      recipes: DEFAULT_RECIPES,
      picks: [],
      votes: {},
      hist: [],
      hh: hh({ forceNew: true }),
      count: 1,
      bias: true,
      weekId: NEW_WEEK,
      random: quiet,
    });
    expect(dealt.ok).toBe(true);
    const recipe = DEFAULT_RECIPES.find((item) => item.id === dealt.picks[0]?.id);
    expect(recipe && isNewNow(recipe, NEW_WEEK)).toBe(true);
  });

  it("builds one gluten-free list and does not order anything", () => {
    const state: PlannerState = {
      ...defaultPlannerState(),
      picks: [
        { id: "broccoli", mult: 1, opt: false, lock: false, day: "auto" },
        { id: "misosalmon", mult: 1, opt: false, lock: false, day: "auto" },
      ],
      hh: { ...defaultPlannerState().hh, gf: true, servings: 8 },
    };
    const shop = buildShopping(state);
    const tamari = shop.included.filter((line) => line.name === "Tamari");
    expect(tamari).toHaveLength(1);
    expect(tamari[0].q).toBeGreaterThan(3);
    expect(shop.included.some((line) => line.name === "Soy sauce")).toBe(false);
    expect(shop.included.some((line) => line.name.toLowerCase().includes("ground beef"))).toBe(false);
    expect(handoffDeclaresNoOrder(shop.text)).toBe(true);
    expect(shop.json).toContain("No order is placed");
    expect(parseIngLine("1.5 lb ground beef")?.a).toBe("M");
  });

  it("keeps an edited shopping qty on the list", () => {
    const state: PlannerState = {
      ...defaultPlannerState(),
      picks: [{ id: "broccoli", mult: 1, opt: false, lock: false, day: "auto" }],
      hh: { ...defaultPlannerState().hh, gf: true, servings: 4 },
      qty: { "tamari|tbsp": 6 },
    };
    const shop = buildShopping(state);
    const tamari = shop.included.find((line) => line.name === "Tamari");
    expect(tamari?.q).toBe(6);
    expect(shop.text).toContain("6 tbsp Tamari");
    expect(shop.json).toContain('"quantity": 6');
  });
});
