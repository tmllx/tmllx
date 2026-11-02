import type { Recipe } from "@/lib/planner/types";

export function btnClass(primary = false, compact = false) {
  return (
    "inline-flex min-h-11 items-center justify-center rounded-full py-2 text-sm font-medium " +
    (compact ? "px-3 " : "px-4 ") +
    (primary ? "bg-orange text-white" : "border border-line bg-card text-ink")
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-paper px-2.5 py-1 text-xs text-muted">{children}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-card p-4 ${className}`}>{children}</section>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm text-muted">
      {label}
      {children}
    </label>
  );
}

export const inputClass = "min-h-11 rounded-2xl border border-line bg-paper px-3 text-ink outline-none focus:border-pine";

export function proteinTone(prot: string): string {
  if (prot === "beef" || prot === "pork" || prot === "deli") return "border-orange";
  if (prot === "chicken" || prot === "turkey" || prot === "egg") return "border-gold";
  return "border-pine";
}

export function recipeById(recipes: Recipe[]): Record<string, Recipe> {
  const map: Record<string, Recipe> = {};
  recipes.forEach((recipe) => {
    map[recipe.id] = recipe;
  });
  return map;
}
