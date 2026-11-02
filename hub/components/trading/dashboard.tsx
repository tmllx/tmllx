import { LineChart, type ChartSeries } from "@/components/trading/chart";
import type { JsonValue, TradingSnapshotName } from "@/lib/trading/types";
import { formatStamp } from "@/lib/trading/status";

const PINE = "#2f5d45";
const MUTED = "#8a8175";

type Files = Partial<Record<TradingSnapshotName, JsonValue>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function pct(value: unknown, digits = 1): string {
  const n = num(value);
  if (n === null) return "–";
  return `${(n * 100).toFixed(digits)}%`;
}

function signedPct(value: unknown, digits = 1): string {
  const n = num(value);
  if (n === null) return "–";
  const body = `${(n * 100).toFixed(digits)}%`;
  return n >= 0 ? `+${body}` : body;
}

function usd(value: unknown): string {
  const n = num(value);
  if (n === null) return "–";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fixed(value: unknown, digits = 2): string {
  const n = num(value);
  return n === null ? "–" : n.toFixed(digits);
}

function tone(value: unknown): string {
  const n = num(value);
  if (n === null || n === 0) return "";
  return n > 0 ? "text-pine" : "text-orange";
}

function curve(value: unknown): [string, number][] {
  if (!Array.isArray(value)) return [];
  const points: [string, number][] = [];
  for (const item of value) {
    if (!Array.isArray(item) || typeof item[0] !== "string") continue;
    const y = num(item[1]);
    if (y === null) continue;
    points.push([item[0], y]);
  }
  return points;
}

function Card({ title, aside, children }: { title?: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4 sm:p-5">
      {title ? (
        <h2 className="font-serif text-2xl tracking-tight">
          {title} {aside ? <span className="font-sans text-sm font-normal text-muted">{aside}</span> : null}
        </h2>
      ) : null}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

function Pill({ children, tone: kind = "muted" }: { children: React.ReactNode; tone?: "muted" | "bull" | "bear" | "caution" }) {
  const color =
    kind === "bull"
      ? "border-pine bg-pine-soft text-pine"
      : kind === "bear"
        ? "border-orange bg-orange-soft text-orange"
        : kind === "caution"
          ? "border-gold bg-gold-soft text-gold"
          : "border-line text-muted";
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${color}`}>{children}</span>;
}

function Tag({ action }: { action: string }) {
  const color =
    action === "BUY" ? "bg-pine-soft text-pine" : action === "SELL" ? "bg-orange-soft text-orange" : "bg-paper text-muted";
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${color}`}>{action}</span>;
}

function DataTable({ headers, rows }: { headers: { label: string; numeric?: boolean }[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="text-sm text-muted">Nothing here yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {headers.map((header) => (
              <th key={header.label} scope="col" className={`py-2 pr-3 font-medium ${header.numeric ? "text-right" : ""}`}>
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line align-top last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={`py-2 pr-3 ${headers[cellIndex]?.numeric ? "text-right tabular-nums" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function modeLabel(mode: unknown): string {
  if (mode === "sim") return "Dry run (sim broker, no real orders)";
  if (typeof mode === "string" && mode.startsWith("alpaca")) return "Alpaca paper";
  if (typeof mode === "string" && mode.trim()) return mode;
  return "No runs yet";
}

function regimeTone(regime: string): "bull" | "bear" | "caution" | "muted" {
  if (regime === "bull" || regime === "bear" || regime === "caution") return regime;
  return "muted";
}

type RecRow = {
  action: "SELL" | "BUY" | "WATCH";
  ticker: string;
  why: string;
  detail?: string;
  price?: number | null;
  target?: number | null;
  stop?: number | null;
  score?: number | null;
  kronos?: number | null;
};

function metrics(item: Record<string, unknown>) {
  return {
    price: num(item.price),
    target: num(item.target_value),
    stop: num(item.stop),
    score: num(item.score),
    kronos: num(item.kronos_exp_10d),
  };
}

function recommendationRows(value: unknown): RecRow[] {
  if (!isRecord(value)) return [];
  const rows: RecRow[] = [];
  for (const item of Array.isArray(value.sells) ? value.sells : []) {
    if (!isRecord(item)) continue;
    rows.push({ action: "SELL", ticker: text(item.ticker), why: text(item.reason) });
  }
  for (const item of Array.isArray(value.buys) ? value.buys : []) {
    if (!isRecord(item)) continue;
    rows.push({ action: "BUY", ticker: text(item.ticker), why: text(item.reason), ...metrics(item) });
  }
  for (const item of Array.isArray(value.candidates) ? value.candidates : []) {
    if (!isRecord(item) || item.action === "BUY") continue;
    const action = text(item.action);
    rows.push({
      action: "WATCH",
      ticker: text(item.ticker),
      why: text(item.reason),
      detail: action && action !== "WATCH" ? action : undefined,
      ...metrics(item),
    });
  }
  return rows;
}

function Recommendations({ value }: { value: unknown }) {
  if (!isRecord(value)) return <p className="text-sm text-muted">No recommendations yet.</p>;
  const regime = text(value.regime);
  const rows = recommendationRows(value);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {regime ? <Pill tone={regimeTone(regime)}>Regime: {regime.toUpperCase()}</Pill> : null}
        {text(value.regime_note) ? <span className="text-sm text-muted">{text(value.regime_note)}</span> : null}
        {value.halted ? <Pill tone="bear">Daily loss limit tripped: no new entries</Pill> : null}
      </div>
      {rows.length ? (
        <DataTable
          headers={[
            { label: "Action" },
            { label: "Ticker" },
            { label: "Price", numeric: true },
            { label: "Size", numeric: true },
            { label: "Stop", numeric: true },
            { label: "Score", numeric: true },
            { label: "Kronos 10d", numeric: true },
            { label: "Reasoning" },
          ]}
          rows={rows.map((row) => [
            <Tag key="a" action={row.action} />,
            <b key="t">{row.ticker || "–"}</b>,
            row.price == null ? "–" : row.price.toFixed(2),
            row.action === "BUY" ? usd(row.target) : "–",
            row.stop == null ? "–" : row.stop.toFixed(2),
            row.score == null ? "–" : row.score.toFixed(2),
            row.kronos == null ? "–" : <span className={tone(row.kronos)}>{signedPct(row.kronos, 2)}</span>,
            <span key="w" className="text-xs text-muted">
              {row.detail ? <b className="text-muted">{row.detail}. </b> : null}
              {row.why}
            </span>,
          ])}
        />
      ) : (
        <p className="text-sm text-muted">No candidates pass the filters today.</p>
      )}
    </div>
  );
}

function Positions({ value }: { value: unknown }) {
  if (!isRecord(value)) {
    return <p className="text-sm text-muted">No positions yet.</p>;
  }
  const open = (Array.isArray(value.positions) ? value.positions : []).filter(isRecord);
  const equity = num(value.equity);
  const invested = open.reduce((sum, position) => sum + (num(position.value) ?? 0), 0);
  const kpis: [string, string][] = [
    ["Equity", usd(equity)],
    ["Cash", usd(value.cash)],
    ["Invested", pct(equity ? invested / equity : 0, 0)],
    ["Open positions", `${open.length} / 5`],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([label, amount]) => (
          <div key={label} className="rounded-2xl border border-line bg-paper px-4 py-3">
            <div className="text-xl font-semibold tabular-nums">{amount}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>
      {open.length ? (
        <DataTable
          headers={[
            { label: "Ticker" },
            { label: "Shares", numeric: true },
            { label: "Entry", numeric: true },
            { label: "Last", numeric: true },
            { label: "Value", numeric: true },
            { label: "P&L", numeric: true },
            { label: "Stop", numeric: true },
          ]}
          rows={open.map((position) => [
            <b key="t">{text(position.ticker) || "–"}</b>,
            fixed(position.shares, 3),
            fixed(position.avg_entry),
            fixed(position.price),
            usd(position.value),
            <span key="p" className={tone(position.pnl_pct)}>
              {signedPct(position.pnl_pct)}
            </span>,
            fixed(position.stop),
          ])}
        />
      ) : (
        <p className="text-sm text-muted">Flat (100% cash).</p>
      )}
    </div>
  );
}

function Equity({ value }: { value: unknown }) {
  if (!isRecord(value) || !Array.isArray(value.history) || value.history.length === 0) {
    return <p className="text-sm text-muted">No live points yet.</p>;
  }
  const history = value.history.filter(isRecord).flatMap((point) => {
    const date = text(point.date);
    const equity = num(point.equity);
    const spy = num(point.spy);
    if (!date || equity === null) return [];
    return [{ date, equity, spy }];
  });
  if (!history.length) return <p className="text-sm text-muted">No live points yet.</p>;
  const baseEquity = history[0].equity;
  const series: ChartSeries[] = [
    { name: "Account (indexed to 100)", color: PINE, pts: history.map((point) => [point.date, (point.equity / baseEquity) * 100]) },
  ];
  if (history.every((point) => point.spy !== null) && history[0].spy) {
    const baseSpy = history[0].spy;
    series.push({ name: "SPY", color: MUTED, pts: history.map((point) => [point.date, (point.spy! / baseSpy) * 100]) });
  }
  return (
    <div>
      <LineChart series={series} format={(amount) => amount.toFixed(1)} />
      <p className="mt-2 text-xs text-muted">
        {history.length} daily point{history.length === 1 ? "" : "s"} since {history[0].date}. A real track record needs weeks of data.
      </p>
    </div>
  );
}

function Trades({ value }: { value: unknown }) {
  const trades = isRecord(value) && Array.isArray(value.trades) ? value.trades.filter(isRecord).slice(0, 50) : [];
  if (!trades.length) return <p className="text-sm text-muted">No trades yet.</p>;
  return (
    <DataTable
      headers={[
        { label: "Date" },
        { label: "Side" },
        { label: "Ticker" },
        { label: "Price", numeric: true },
        { label: "Value", numeric: true },
        { label: "P&L", numeric: true },
        { label: "Why" },
      ]}
      rows={trades.map((trade) => {
        const side = (text(trade.side) || "").toUpperCase();
        const price = num(trade.price) ?? num(trade.filled_avg_price);
        const amount = num(trade.value) ?? num(trade.notional);
        const when = text(trade.date) || text(trade.submitted_at).slice(0, 10);
        return [
          when || "–",
          side ? <Tag key="s" action={side} /> : "–",
          <b key="t">{text(trade.ticker) || text(trade.symbol) || "–"}</b>,
          price === null ? "–" : price.toFixed(2),
          amount === null ? "–" : usd(amount),
          trade.pnl_pct == null ? "–" : <span className={tone(trade.pnl_pct)}>{signedPct(trade.pnl_pct)}</span>,
          <span key="w" className="text-xs text-muted">
            {text(trade.reason)}
          </span>,
        ];
      })}
    />
  );
}

function metricRow(label: string, strategy: unknown, spy: unknown, format: (value: unknown) => string) {
  return [
    label,
    <span key="a" className="tabular-nums">
      {format(strategy)}
    </span>,
    <span key="b" className="tabular-nums">
      {format(spy)}
    </span>,
  ];
}

function Backtest({ value }: { value: unknown }) {
  if (!isRecord(value) || !isRecord(value.wf)) {
    return <p className="text-sm text-muted">No backtest yet.</p>;
  }
  const walk = value.wf;
  const spy = isRecord(value.spy) ? value.spy : {};
  const yearly = Array.isArray(value.yearly) ? value.yearly.filter(isRecord) : [];
  const strategyCurve = curve(value.curve_strategy);
  const spyCurve = curve(value.curve_spy);
  const strategyDd = curve(value.dd_strategy);
  const spyDd = curve(value.dd_spy);
  const fixed2 = (item: unknown) => {
    const n = num(item);
    return n === null ? "–" : n.toFixed(2);
  };
  const count = (item: unknown) => {
    const n = num(item);
    return n === null ? "–" : String(Math.round(n));
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl border border-gold bg-gold-soft px-3 py-2 text-sm text-ink">
        Technical rules only, {text(walk.start) || "–"} to {text(walk.end) || "–"} ({fixed(walk.years, 0)} yrs), $5,000 start, 5
        bps/side costs and slippage, fills at the next open. Parameters are re-chosen each January using only prior data. The
        universe is today&apos;s large caps and ETFs, so the test has survivorship bias.
      </p>
      <LineChart
        series={[
          { name: "Strategy (walk-forward)", color: PINE, pts: strategyCurve },
          { name: "SPY buy and hold", color: MUTED, pts: spyCurve },
        ]}
        height={260}
        format={(amount) => `$${(amount / 1000).toFixed(1)}k`}
      />
      <div>
        <p className="mb-1 text-xs text-muted">Drawdown</p>
        <LineChart
          series={[
            { name: "Strategy", color: PINE, pts: strategyDd },
            { name: "SPY", color: MUTED, pts: spyDd },
          ]}
          height={120}
          format={(amount) => `${(amount * 100).toFixed(0)}%`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          headers={[
            { label: "Metric" },
            { label: "Strategy", numeric: true },
            { label: "SPY", numeric: true },
          ]}
          rows={[
            metricRow("CAGR", walk.cagr, spy.cagr, pct),
            metricRow("Max drawdown", walk.max_drawdown, spy.max_drawdown, pct),
            metricRow("Sharpe (rf=0)", walk.sharpe, spy.sharpe, fixed2),
            metricRow("Volatility", walk.vol, spy.vol, pct),
            metricRow("Total return", walk.total_return, spy.total_return, pct),
            metricRow("Win rate (trades)", walk.win_rate, null, pct),
            metricRow("Profit factor", walk.profit_factor, null, fixed2),
            metricRow("Trades", walk.n_trades, null, count),
            metricRow("Avg hold (days)", walk.avg_hold_days, null, (item) => {
              const n = num(item);
              return n === null ? "–" : n.toFixed(0);
            }),
            metricRow("Avg exposure", walk.avg_exposure, null, (item) => (num(item) === null ? "100%" : pct(item, 0))),
          ]}
        />
        {yearly.length ? (
          <DataTable
            headers={[
              { label: "Year" },
              { label: "Strategy", numeric: true },
              { label: "SPY", numeric: true },
              { label: "Strat max DD", numeric: true },
              { label: "SPY max DD", numeric: true },
            ]}
            rows={yearly.map((year) => [
              String(year.year ?? "–"),
              <span key="s" className={tone(year.strategy)}>
                {signedPct(year.strategy)}
              </span>,
              <span key="p" className={tone(year.spy)}>
                {signedPct(year.spy)}
              </span>,
              pct(year.strategy_maxdd),
              pct(year.spy_maxdd),
            ])}
          />
        ) : null}
      </div>
    </div>
  );
}

function plainHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function Kronos({ value }: { value: unknown }) {
  if (!isRecord(value)) return <p className="text-sm text-muted">Kronos sample evaluation is not available.</p>;
  const lines: { label: string; text: string }[] = [];
  if (num(value.n_forecasts) !== null) {
    const dates = num(value.n_dates);
    const span = typeof value.first === "string" && typeof value.last === "string" ? `${value.first} to ${value.last}` : "";
    lines.push({
      label: "Sample",
      text: `${value.n_forecasts} forecasts${dates === null ? "" : ` across ${dates} dates`}${span ? ` (${span})` : ""}`,
    });
  }
  if (typeof value.model === "string" && value.model) lines.push({ label: "Model", text: value.model });
  if (num(value.horizon_days) !== null) lines.push({ label: "Horizon", text: `${value.horizon_days} days` });
  if (num(value.mean_rank_IC) !== null) {
    const t = num(value.IC_t_stat);
    const positive = num(value.pct_dates_IC_positive);
    lines.push({
      label: "Mean rank IC",
      text: `${fixed(value.mean_rank_IC, 3)}${t === null ? "" : ` (t = ${t.toFixed(2)})`}${positive === null ? "" : `; positive on ${pct(positive, 1)} of dates`}`,
    });
  }
  if (num(value.direction_hit_rate) !== null) {
    const base = num(value.base_rate_up);
    const bullish = num(value.pct_forecasts_bullish);
    lines.push({
      label: "Direction hit rate",
      text: `${pct(value.direction_hit_rate, 1)}${base === null ? "" : ` (always-up would score ${pct(base, 1)})`}${bullish === null ? "" : `; bullish on ${pct(bullish, 1)} of forecasts`}`,
    });
  }
  if (num(value.avg_real_10d_when_bullish) !== null || num(value.avg_real_10d_when_bearish) !== null) {
    lines.push({
      label: "Avg realized 10d, bullish / bearish",
      text: `${signedPct(value.avg_real_10d_when_bullish, 1)} / ${signedPct(value.avg_real_10d_when_bearish, 1)}`,
    });
  }
  if (num(value.top_quartile_avg_real) !== null || num(value.bottom_quartile_avg_real) !== null) {
    lines.push({
      label: "Top vs bottom quartile",
      text: `${signedPct(value.top_quartile_avg_real, 1)} vs ${signedPct(value.bottom_quartile_avg_real, 1)}`,
    });
  }
  const read = typeof value.html === "string" ? /Read:\s*([\s\S]+)/i.exec(plainHtml(value.html)) : null;
  if (!lines.length && typeof value.html === "string") {
    return <p className="whitespace-pre-wrap text-sm text-muted">{plainHtml(value.html)}</p>;
  }
  if (!lines.length) return <p className="text-sm text-muted">Kronos sample evaluation is not available.</p>;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <dl className="grid gap-2">
        {lines.map((line) => (
          <div key={line.label} className="grid gap-1 sm:grid-cols-[16rem_1fr]">
            <dt className="text-muted">{line.label}</dt>
            <dd>{line.text}</dd>
          </div>
        ))}
      </dl>
      {read ? <p className="text-muted">{read[1].trim()}</p> : null}
    </div>
  );
}

export function TradingDashboard({ files, lastUpdated }: { files: Files; lastUpdated: string | null }) {
  const status = isRecord(files.status) ? files.status : null;
  const universe = status ? num(status.universe_size) : null;
  const recommendations = isRecord(files.recommendations) ? files.recommendations : null;
  const recAside = recommendations && text(recommendations.asof) ? `(signals from the close of ${text(recommendations.asof)}, orders at the next open)` : "";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted">Household</p>
        <h1 className="font-serif text-4xl tracking-tight">Trading</h1>
        <p className="mt-1 text-sm text-muted">Long-only · no options · no leverage</p>
        <p className="mt-2 text-sm text-muted">Last updated {lastUpdated ? formatStamp(lastUpdated) : "–"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>{modeLabel(status?.mode)}</Pill>
          {status && text(status.asof) ? <Pill>Data as of {text(status.asof)}</Pill> : null}
          {universe !== null ? <Pill>Universe {universe}</Pill> : null}
        </div>
      </div>
      <Card title="Today's recommendations" aside={recAside}>
        <Recommendations value={files.recommendations} />
      </Card>
      <Card title="Open positions">
        <Positions value={files.positions} />
      </Card>
      <Card title="Equity">
        <p className="mb-3 text-sm text-muted">Paper or sim account versus SPY, indexed to 100.</p>
        <Equity value={files.equity_live} />
      </Card>
      <Card title="Trade log">
        <Trades value={files.trades} />
      </Card>
      <Card title="Backtest">
        <p className="mb-3 text-sm text-muted">Walk-forward, out of sample, versus SPY buy-and-hold.</p>
        <Backtest value={files.backtest} />
      </Card>
      <Card title="Kronos check">
        <Kronos value={files.kronos_eval} />
      </Card>
      <p className="text-xs text-muted">
        Not investment advice. Backtests are not guarantees. The universe has survivorship bias, fills assume the next open with
        5 bps of slippage, and stops are checked at the close and filled at the next open, so gaps can pass the stop. Until a
        broker is connected, the account shown is a local simulation.
      </p>
    </div>
  );
}
