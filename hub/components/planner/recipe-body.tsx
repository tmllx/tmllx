import { AISLES } from "@/lib/planner/catalog";
import { cap, fmtQ, kidSkip, kidTokens } from "@/lib/planner/engine";
import type { Aisle, HH, Ing, Recipe } from "@/lib/planner/types";
import { btnClass, inputClass } from "./ui";

export function RecipeBody({
  recipe,
  hh,
  editing,
  onChange,
}: {
  recipe: Recipe;
  hh: HH;
  editing: boolean;
  onChange?: (recipe: Recipe) => void;
}) {
  const tokens = kidTokens(hh);
  const factor = hh.servings / 4;
  const leave = recipe.ing.filter((item) => kidSkip(item.n, tokens)).map((item) => item.n.toLowerCase());
  const phases: [string, string][] = [
    ["oven", "Oven"],
    ["stove", "Stove"],
    ["chop", "Chop"],
    ["sauce", "Sauce"],
  ];
  const phaseLine = phases
    .map(([phase, label]) => {
      const names = recipe.ing.filter((item) => item.b === phase && (phase === "sauce" || !item.o)).map((item) => item.n.toLowerCase());
      return names.length ? label + ": " + names.join(", ") : "";
    })
    .filter(Boolean)
    .join(" · ");

  function patchIng(index: number, patch: Partial<Ing>) {
    if (!onChange) return;
    onChange({ ...recipe, ing: recipe.ing.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
      <div>
        <h3 className="font-serif text-xl">Ingredients, {hh.servings} servings</h3>
        {editing && onChange ? (
          <div className="mt-3 flex flex-col gap-2">
            {recipe.ing.map((item, index) => (
              <div key={index} className="flex flex-wrap gap-2">
                <input className={`${inputClass} w-20`} type="number" value={item.q} onChange={(event) => patchIng(index, { q: Number(event.target.value) })} aria-label="Quantity" />
                <input className={`${inputClass} w-20`} value={item.u} onChange={(event) => patchIng(index, { u: event.target.value })} aria-label="Unit" />
                <input className={`${inputClass} min-w-40 flex-1`} value={item.n} onChange={(event) => patchIng(index, { n: event.target.value })} aria-label="Ingredient" />
                <button type="button" className={btnClass()} onClick={() => onChange({ ...recipe, ing: recipe.ing.filter((_, i) => i !== index) })}>
                  Remove
                </button>
              </div>
            ))}
            <AddIngredient
              onAdd={(item) => onChange({ ...recipe, ing: recipe.ing.concat([item]) })}
            />
          </div>
        ) : (
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {recipe.ing.map((item, index) => (
              <li key={index}>
                <span className="font-medium">{fmtQ(item.q * factor) + (item.u === "ea" ? " " : " " + item.u + " ")}</span>
                {hh.gf && item.gf ? item.gf : item.n}
                <span className="text-sm text-muted">
                  {(item.o ? " optional" : "") +
                    (kidSkip(item.n, tokens) ? " adult only" : "") +
                    (hh.gf && item.gf ? " gluten-free swap" : "") +
                    (hh.gf && item.chk ? " check label: " + item.chk : "")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-serif text-xl">Steps</h3>
        <ol className="mt-2 flex flex-col gap-2">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine-soft text-sm">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      {phaseLine ? (
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">Prep-day components. </span>
          {phaseLine}
        </p>
      ) : null}
      <div>
        <h3 className="font-serif text-xl">Kid container</h3>
        <p className="mt-1">{recipe.kid}</p>
        {leave.length ? (
          <p className="mt-1 text-sm text-muted">
            Leaves out: {leave.join(", ")}
            {hh.kidNoSauce ? ". No sauce or dressing." : "."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AddIngredient({ onAdd }: { onAdd: (item: Ing) => void }) {
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") || "").trim();
        if (!name) return;
        onAdd({
          n: name,
          q: Number(data.get("q") || 1),
          u: String(data.get("u") || "ea"),
          a: String(data.get("a") || "P") as Aisle,
        });
        event.currentTarget.reset();
      }}
    >
      <input className={`${inputClass} w-20`} name="q" type="number" defaultValue={1} aria-label="New quantity" />
      <input className={`${inputClass} w-20`} name="u" defaultValue="ea" aria-label="New unit" />
      <input className={`${inputClass} min-w-36 flex-1`} name="name" placeholder="New ingredient" aria-label="New ingredient" />
      <select className={inputClass} name="a" aria-label="Aisle" defaultValue="P">
        {AISLES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button className={btnClass(true)} type="submit">
        Add
      </button>
    </form>
  );
}

export function capWord(value: string) {
  return cap(value);
}
