import type { JsonValue } from "./types";
import type { SnapshotIssue } from "./how-it-works";

/** Loose cap while the alpha document is still changing. A multi-year daily series fits under this. */
export const MAX_ALPHA_BYTES = 512 * 1024;

export type AlphaPoint = { date: string; strategy: number | null; spy: number | null };

export type AlphaView = {
  startDate: string | null;
  startEquity: number | null;
  strategyEquity: number | null;
  strategyReturn: number | null;
  spyValue: number | null;
  spyReturn: number | null;
  excessReturn: number | null;
  strategyDrawdown: number | null;
  spyDrawdown: number | null;
  /** `null` means the producer sent null. `undefined` means the field was omitted. */
  beta: number | null | undefined;
  alpha: number | null | undefined;
  series: AlphaPoint[];
  backtestNote: string | null;
};

function plainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  return value as Record<string, unknown>;
}

/** Any JSON object is accepted. Fields are optional. Non-objects are rejected. */
export function validateAlpha(data: JsonValue): SnapshotIssue {
  if (!plainObject(data)) return { ok: false, status: 400, error: "invalid_json" };
  if (Buffer.byteLength(JSON.stringify(data), "utf8") > MAX_ALPHA_BYTES) {
    return { ok: false, status: 413, error: "too_large" };
  }
  return { ok: true };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null | undefined {
  let seenNull = false;
  let seenKey = false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    seenKey = true;
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value === null) seenNull = true;
  }
  if (!seenKey) return undefined;
  return seenNull ? null : undefined;
}

function nestedNumber(source: Record<string, unknown>, nest: string, keys: string[]): number | null | undefined {
  const child = plainObject(source[nest]);
  if (!child) return undefined;
  return firstNumber(child, keys);
}

function coalesce(...values: (number | null | undefined)[]): number | null | undefined {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function clip(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 240) return trimmed;
  return `${trimmed.slice(0, 237)}...`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function backtestNote(value: unknown): string | null {
  if (typeof value === "string") return clip(value) || null;
  const record = plainObject(value);
  if (!record) return null;
  for (const key of ["note", "summary", "label"]) {
    if (typeof record[key] === "string" && record[key].trim()) return clip(record[key]);
  }
  const cagr = finiteNumber(record.cagr);
  if (cagr === null) return null;
  const start = typeof record.start === "string" ? record.start : "";
  const end = typeof record.end === "string" ? record.end : "";
  const range = start && end ? ` (${start} to ${end})` : "";
  return `Backtest CAGR ${percent(cagr)}${range}`;
}

function readSeries(value: unknown): AlphaPoint[] {
  if (!Array.isArray(value)) return [];
  const points: AlphaPoint[] = [];
  for (const item of value) {
    const row = plainObject(item);
    if (!row || typeof row.date !== "string" || !row.date.trim()) continue;
    points.push({
      date: row.date,
      strategy: finiteNumber(row.strategy_ret) ?? finiteNumber(row.strategy_return),
      spy: finiteNumber(row.spy_ret) ?? finiteNumber(row.spy_return),
    });
  }
  return points;
}

/**
 * Reads the fields the scorecard knows how to show. Missing fields stay empty.
 * `beta` and `alpha` preserve an explicit null so the page can say the series is still short.
 */
export function readAlpha(data: unknown): AlphaView | null {
  const record = plainObject(data);
  if (!record) return null;
  const strategyReturn = coalesce(
    firstNumber(record, ["strategy_return", "strategy_ret"]),
    nestedNumber(record, "strategy", ["return", "ret", "strategy_return"]),
  );
  const spyReturn = coalesce(
    firstNumber(record, ["spy_return", "spy_ret"]),
    nestedNumber(record, "spy", ["return", "ret", "spy_return"]),
  );
  const excessField = firstNumber(record, ["excess_return", "excess", "excess_ret"]);
  const excessReturn =
    excessField !== undefined
      ? excessField
      : typeof strategyReturn === "number" && typeof spyReturn === "number"
        ? strategyReturn - spyReturn
        : undefined;
  const drawdownBag =
    plainObject(record.max_drawdowns) ?? plainObject(record.drawdowns) ?? plainObject(record.max_drawdown);
  const seriesValue = record.series ?? record.daily ?? record.daily_series;
  const backtestValue = record.backtest ?? record.backtest_context ?? record.context;
  const startDate = typeof record.start_date === "string" && record.start_date.trim() ? record.start_date.trim() : null;
  return {
    startDate,
    startEquity: firstNumber(record, ["start_equity"]) ?? null,
    strategyEquity: coalesce(firstNumber(record, ["strategy_equity", "equity"]), nestedNumber(record, "strategy", ["equity", "value"])) ?? null,
    strategyReturn: strategyReturn ?? null,
    spyValue: coalesce(firstNumber(record, ["spy_value", "spy_equity"]), nestedNumber(record, "spy", ["value", "equity", "price"])) ?? null,
    spyReturn: spyReturn ?? null,
    excessReturn: excessReturn ?? null,
    strategyDrawdown:
      coalesce(
        firstNumber(record, ["strategy_max_drawdown", "strategy_drawdown"]),
        nestedNumber(record, "strategy", ["max_drawdown", "drawdown"]),
        drawdownBag ? firstNumber(drawdownBag, ["strategy", "strategy_max_drawdown"]) : undefined,
        firstNumber(record, ["max_drawdown"]),
      ) ?? null,
    spyDrawdown:
      coalesce(
        firstNumber(record, ["spy_max_drawdown", "spy_drawdown"]),
        nestedNumber(record, "spy", ["max_drawdown", "drawdown"]),
        drawdownBag ? firstNumber(drawdownBag, ["spy", "spy_max_drawdown"]) : undefined,
      ) ?? null,
    beta: firstNumber(record, ["beta"]),
    alpha: firstNumber(record, ["alpha"]),
    series: readSeries(seriesValue),
    backtestNote: backtestNote(backtestValue),
  };
}

/** Compound daily simple returns into an index that starts at 100. */
export function cumulativeIndex(points: AlphaPoint[], key: "strategy" | "spy"): [string, number][] {
  const ordered = points.filter((point) => point[key] !== null).slice().sort((a, b) => a.date.localeCompare(b.date));
  const out: [string, number][] = [];
  let level = 100;
  for (const point of ordered) {
    const change = point[key];
    if (change === null) continue;
    level *= 1 + change;
    if (!Number.isFinite(level)) break;
    out.push([point.date, level]);
  }
  return out;
}
