import { LineChart, type ChartSeries } from "@/components/trading/chart";
import { cumulativeIndex, readAlpha, type AlphaView } from "@/lib/trading/alpha";

const PINE = "#2f5d45";
const MUTED = "#8a8175";
const PENDING = "needs 20 days of data";

function usd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function signedPct(value: number): string {
  const body = `${(value * 100).toFixed(1)}%`;
  return value >= 0 ? `+${body}` : body;
}

function tone(value: number): string {
  if (value === 0) return "";
  return value > 0 ? "text-pine" : "text-orange";
}

function started(view: AlphaView): string | null {
  if (view.startDate && view.startEquity !== null) return `Since ${view.startDate} from ${usd(view.startEquity)}`;
  if (view.startDate) return `Since ${view.startDate}`;
  if (view.startEquity !== null) return `Started at ${usd(view.startEquity)}`;
  return null;
}

function Stat({ label, value, sub, pending, color }: { label: string; value: string; sub?: string; pending?: boolean; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-3 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      {pending ? (
        <dd className="mt-1 text-sm text-muted">{value}</dd>
      ) : (
        <dd className={`mt-1 font-serif text-2xl tracking-tight tabular-nums ${color ?? ""}`}>{value}</dd>
      )}
      {sub ? <dd className="mt-1 text-xs text-muted tabular-nums">{sub}</dd> : null}
    </div>
  );
}

function returnStat(label: string, value: number | null, sub?: string) {
  if (value === null) return <Stat label={label} value="–" pending sub={sub} />;
  return <Stat label={label} value={signedPct(value)} color={tone(value)} sub={sub} />;
}

function coefficient(
  label: string,
  value: number | null | undefined,
  format: (value: number) => string,
  color?: (value: number) => string,
) {
  if (value === null) return <Stat label={label} value={PENDING} pending />;
  if (typeof value !== "number") return <Stat label={label} value="–" pending />;
  return <Stat label={label} value={format(value)} color={color ? color(value) : undefined} />;
}

export function AlphaScorecard({ value }: { value: unknown }) {
  if (value === undefined || value === null) return null;
  const view = readAlpha(value);
  if (!view) return null;
  const strategyLine = cumulativeIndex(view.series, "strategy");
  const spyLine = cumulativeIndex(view.series, "spy");
  const series: ChartSeries[] = [];
  if (strategyLine.length) series.push({ name: "Strategy", color: PINE, pts: strategyLine });
  if (spyLine.length) series.push({ name: "SPY", color: MUTED, pts: spyLine });
  const since = started(view);
  return (
    <section className="rounded-3xl border border-line bg-card p-4 sm:p-5">
      <h2 className="font-serif text-2xl tracking-tight">
        Alpha {since ? <span className="font-sans text-sm font-normal text-muted">{since}</span> : null}
      </h2>
      <p className="mt-1 text-sm text-muted">Paper account versus buy-and-hold SPY.</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {returnStat("Strategy return", view.strategyReturn, view.strategyEquity === null ? undefined : usd(view.strategyEquity))}
        {returnStat("SPY return", view.spyReturn, view.spyValue === null ? undefined : usd(view.spyValue))}
        {returnStat("Excess return", view.excessReturn)}
      </dl>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {returnStat("Strategy max drawdown", view.strategyDrawdown)}
        {returnStat("SPY max drawdown", view.spyDrawdown)}
        {coefficient("Beta", view.beta, (item) => item.toFixed(2))}
        {coefficient("Alpha", view.alpha, signedPct, tone)}
      </dl>
      {series.length ? (
        <div className="mt-4">
          <LineChart series={series} height={160} format={(amount) => amount.toFixed(1)} />
          <p className="mt-2 text-xs text-muted">Cumulative growth of $100, compounded from the daily returns.</p>
        </div>
      ) : null}
      {view.backtestNote ? <p className="mt-3 text-xs text-muted">{view.backtestNote}</p> : null}
    </section>
  );
}
