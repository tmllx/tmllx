export type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

export const TRADING_SNAPSHOT_NAMES = [
  "positions",
  "trades",
  "equity_live",
  "recommendations",
  "status",
  "backtest",
  "kronos_eval",
  "how_it_works",
  "alpha",
] as const;

export type TradingSnapshotName = (typeof TRADING_SNAPSHOT_NAMES)[number];

export function isTradingSnapshotName(value: string): value is TradingSnapshotName {
  return (TRADING_SNAPSHOT_NAMES as readonly string[]).includes(value);
}
