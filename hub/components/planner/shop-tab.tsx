"use client";

import { useState } from "react";
import { AISLES } from "@/lib/planner/catalog";
import { buildShopping, qtyStep } from "@/lib/planner/engine";
import type { Aisle, PlannerState } from "@/lib/planner/types";
import { Card, btnClass, inputClass } from "./ui";

export function ShopTab({ state, onChange, onHome }: { state: PlannerState; onChange: (next: PlannerState) => void; onHome: () => void }) {
  const shop = buildShopping(state);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"text" | "json">("text");
  const [copyMsg, setCopyMsg] = useState("");
  const [subKey, setSubKey] = useState("");
  const [subVal, setSubVal] = useState("");
  const [extra, setExtra] = useState({ name: "", qty: "", a: "P" });
  const hasPicks = state.picks.length > 0;

  async function copyList() {
    const text = format === "json" ? shop.json : shop.text;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(format === "json" ? "JSON copied." : "List copied.");
    } catch {
      setCopyMsg("Select the text and copy it.");
    }
  }

  if (!hasPicks) {
    return (
      <Card className="text-center">
        <h2 className="font-serif text-3xl">The list builds itself</h2>
        <p className="mt-2 text-muted">Deal a week on Home and every ingredient lands here, grouped by aisle.</p>
        <button type="button" className={`${btnClass(true)} mt-4`} onClick={onHome}>
          Go to Home
        </button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-orange-soft">
        <h2 className="font-serif text-3xl">Shopping list</h2>
        <p className="text-sm text-muted">{shop.itemCount} items. Uncheck what you already have.</p>
        <p className="mt-2 text-sm">This list is for shopping. The hub does not order anything and never stores payment or store credentials.</p>
        <button type="button" className={`${btnClass(true)} mt-3`} onClick={() => { setOpen(true); setCopyMsg(""); }}>
          Copy handoff
        </button>
      </Card>
      {open ? (
        <Card>
          <h3 className="font-serif text-2xl">Handoff</h3>
          <p className="text-sm text-muted">Text or JSON for a person to shop from. Nothing is ordered.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnClass(format === "text")} onClick={() => setFormat("text")}>Text</button>
            <button type="button" className={btnClass(format === "json")} onClick={() => setFormat("json")}>JSON</button>
            <button type="button" className={btnClass(true)} onClick={copyList}>Copy</button>
          </div>
          {copyMsg ? <p className="mt-2 text-sm">{copyMsg}</p> : null}
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-paper p-3 text-xs">{format === "json" ? shop.json : shop.text}</pre>
        </Card>
      ) : null}
      {state.hh.gf && shop.flagged.length ? (
        <Card className="bg-gold-soft">
          <h3 className="font-serif text-xl">Gluten-free label checks</h3>
          {shop.flagged.map((line) => (
            <p key={line.key} className="mt-1 text-sm">
              {(state.subs[line.key] || line.name) + ": " + line.chk}
            </p>
          ))}
        </Card>
      ) : null}
      {AISLES.map(([aisle, label]) => {
        const lines = shop.active.filter((line) => line.a === aisle);
        const extras = state.extras.filter((item) => item.a === aisle);
        if (!lines.length && !extras.length) return null;
        return (
          <Card key={aisle}>
            <h3 className="font-serif text-2xl">{label}</h3>
            {lines.map((line) => {
              const on = !state.off.includes(line.key);
              const name = state.subs[line.key] || line.name;
              return (
                <div key={line.key} className={`flex flex-wrap items-center gap-3 border-t border-line py-3 ${on ? "" : "opacity-50"}`}>
                  <input className="h-6 w-6" type="checkbox" checked={on} aria-label={name} onChange={() => onChange({ ...state, off: on ? state.off.concat(line.key) : state.off.filter((key) => key !== line.key) })} />
                  <div className="min-w-40 flex-1">
                    <p className={on ? "font-medium" : "font-medium line-through"}>{name}</p>
                    <p className="text-sm text-muted">{line.from.join(", ")}{line.chk ? " · check label" : ""}</p>
                  </div>
                  <QtyControl
                    name={name}
                    value={line.q}
                    unit={line.u === "ea" ? "" : line.u}
                    step={qtyStep(line.u)}
                    onChange={(next) => onChange({ ...state, qty: { ...state.qty, [line.key]: next } })}
                  />
                  {subKey === line.key ? (
                    <div className="flex flex-wrap gap-2">
                      <input className={inputClass} value={subVal} aria-label="Substitute" onChange={(event) => setSubVal(event.target.value)} />
                      <button
                        type="button"
                        className={btnClass(true)}
                        onClick={() => {
                          const subs = { ...state.subs };
                          if (subVal.trim()) subs[line.key] = subVal.trim();
                          else delete subs[line.key];
                          onChange({ ...state, subs });
                          setSubKey("");
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnClass()} onClick={() => { setSubKey(line.key); setSubVal(state.subs[line.key] || ""); }}>
                        {state.subs[line.key] ? "Edit sub" : "Sub"}
                      </button>
                      <button type="button" className={btnClass()} onClick={() => onChange({ ...state, pantry: state.pantry.concat([line.name.toLowerCase()]) })}>
                        Always have
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {extras.map((item) => {
              const key = "x:" + item.id;
              const on = !state.off.includes(key);
              const parts = splitExtraQty(item.qty);
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3">
                  <input className="h-6 w-6" type="checkbox" checked={on} aria-label={item.name} onChange={() => onChange({ ...state, off: on ? state.off.concat(key) : state.off.filter((value) => value !== key) })} />
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted">added by you</p>
                  </div>
                  <QtyControl
                    name={item.name}
                    value={parts.amount}
                    unit={parts.suffix.trim()}
                    step={extraStep(parts.suffix)}
                    onChange={(next) => {
                      const qty = (String(next) + parts.suffix).trim();
                      onChange({ ...state, extras: state.extras.map((extraItem) => (extraItem.id === item.id ? { ...extraItem, qty } : extraItem)) });
                    }}
                  />
                  <button type="button" className={btnClass()} onClick={() => onChange({ ...state, extras: state.extras.filter((extraItem) => extraItem.id !== item.id) })}>
                    Delete
                  </button>
                </div>
              );
            })}
          </Card>
        );
      })}
      <Card>
        <h3 className="font-serif text-2xl">Add an item</h3>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!extra.name.trim()) return;
            onChange({ ...state, extras: state.extras.concat([{ id: String(Date.now()), name: extra.name.trim(), qty: extra.qty.trim(), a: extra.a as Aisle }]) });
            setExtra({ name: "", qty: "", a: extra.a });
          }}
        >
          <input className={`${inputClass} min-w-40 flex-1`} placeholder="Item" value={extra.name} aria-label="Extra item" onChange={(event) => setExtra({ ...extra, name: event.target.value })} />
          <input className={`${inputClass} w-24`} placeholder="Qty" value={extra.qty} aria-label="Qty" onChange={(event) => setExtra({ ...extra, qty: event.target.value })} />
          <select className={inputClass} value={extra.a} aria-label="Aisle" onChange={(event) => setExtra({ ...extra, a: event.target.value })}>
            {AISLES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className={btnClass(true)} type="submit">Add</button>
        </form>
      </Card>
      {shop.pantryLines.length ? (
        <Card>
          <h3 className="font-serif text-2xl">Already have</h3>
          {shop.pantryLines.map((line) => (
            <div key={line.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2">
              <p className="min-w-36 flex-1 text-muted">{line.name}</p>
              <QtyControl
                name={line.name}
                value={line.q}
                unit={line.u === "ea" ? "" : line.u}
                step={qtyStep(line.u)}
                onChange={(next) => onChange({ ...state, qty: { ...state.qty, [line.key]: next } })}
              />
              <button type="button" className={btnClass()} onClick={() => onChange({ ...state, pantry: state.pantry.filter((item) => item !== line.name.toLowerCase()) })}>
                Need it
              </button>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function QtyControl({
  name,
  value,
  unit,
  step,
  onChange,
}: {
  name: string;
  value: number;
  unit: string;
  step: number;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft === null ? String(value) : draft;
  const stepClass = "inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-lg leading-none disabled:opacity-40";

  function write(next: number) {
    const snapped = snapQty(next, step);
    setDraft(null);
    if (snapped !== value) onChange(snapped);
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={"Qty for " + name}>
      <span className="text-xs font-medium text-muted">Qty</span>
      <button type="button" className={stepClass} aria-label={"Decrease qty for " + name} onClick={() => write(value - step)} disabled={value <= 0}>
        −
      </button>
      <input
        className={`${inputClass} w-20 appearance-none px-2 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        aria-label={"Qty for " + name}
        value={shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const raw = event.currentTarget.value.trim();
          const next = Number(raw);
          if (raw === "" || !Number.isFinite(next) || next < 0) {
            setDraft(null);
            return;
          }
          write(next);
        }}
      />
      <button type="button" className={stepClass} aria-label={"Increase qty for " + name} onClick={() => write(value + step)}>
        +
      </button>
      {unit ? <span className="text-sm text-muted">{unit}</span> : null}
    </div>
  );
}

function snapQty(value: number, step: number): number {
  if (!(value > 0)) return 0;
  const snapped = Math.round(value / step) * step;
  return Math.round(snapped * 1000) / 1000;
}

function splitExtraQty(qty: string): { amount: number; suffix: string } {
  const trimmed = qty.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { amount: 0, suffix: trimmed ? " " + trimmed : "" };
  return { amount: Number(match[1]), suffix: match[2] };
}

function extraStep(suffix: string): number {
  const unit = suffix.trim().toLowerCase().replace(/s$/, "");
  if (unit === "lb" || unit === "oz" || unit === "cup" || unit === "tbsp" || unit === "tsp") return 0.25;
  return 1;
}
