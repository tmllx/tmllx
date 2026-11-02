export type Aisle = "P" | "M" | "D" | "C" | "B" | "G" | "S" | "I" | "F" | "O";
export type Phase = "oven" | "stove" | "chop" | "sauce";
export type VoteValue = "none" | "up" | "down";

export interface Ing {
  n: string;
  q: number;
  u: string;
  a: Aisle;
  b?: Phase;
  o?: boolean;
  gf?: string;
  how?: string;
  chk?: string;
}

export interface Recipe {
  id: string;
  name: string;
  s: string;
  cuisine: string;
  prot: string;
  fridge: number;
  prep: number;
  pg: number;
  veg: number;
  kcal: number;
  optPg?: number;
  ing: Ing[];
  steps: string[];
  kid: string;
  isNew?: boolean;
  addedWeek?: string;
}

export interface Member {
  id: string;
  name: string;
  role: "adult" | "kid" | string;
  avoids: string;
  votes: boolean;
}

export interface HH {
  servings: number;
  members: Member[];
  gf: boolean;
  kidNoSauce: boolean;
  vetoSkip: boolean;
  forceNew: boolean;
  nightlyCook: number;
  assemble: number;
  day1: string;
  day1cover: string;
  day2: string;
  day2cover: string;
}

export interface Pick {
  id: string;
  mult: number;
  opt: boolean;
  lock: boolean;
  day: string;
}

export interface Extra {
  id: string;
  name: string;
  qty: string;
  a: Aisle;
}

export interface Line {
  key: string;
  name: string;
  q: number;
  u: string;
  a: Aisle;
  from: string[];
  chk?: string;
}

export interface Hist {
  week: string;
  ids: string[];
}

export type Votes = Record<string, Record<string, VoteValue | string>>;

export interface PlannerState {
  recipes: Recipe[];
  hh: HH;
  votes: Votes;
  picks: Pick[];
  why: Record<string, string[]>;
  hist: Hist[];
  off: string[];
  subs: Record<string, string>;
  pantry: string[];
  extras: Extra[];
  count: number;
  bias: boolean;
  seenDefaultIds: string[];
}

export interface PlannerRecord {
  version: number;
  state: PlannerState;
}
