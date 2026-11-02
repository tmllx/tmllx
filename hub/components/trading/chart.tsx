export type ChartSeries = { name: string; color: string; pts: [string, number][] };

function plottable(series: ChartSeries[]) {
  return series
    .map((item) => ({
      name: item.name,
      color: item.color,
      pts: item.pts
        .map((point) => ({ t: Date.parse(point[0]), v: point[1], label: point[0] }))
        .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v)),
    }))
    .filter((item) => item.pts.length > 0);
}

export function LineChart({
  series,
  height = 220,
  format = (value: number) => value.toFixed(0),
}: {
  series: ChartSeries[];
  height?: number;
  format?: (value: number) => string;
}) {
  const plotted = plottable(series);
  const all = plotted.flatMap((item) => item.pts);
  if (!all.length) return <p className="text-sm text-muted">No data yet.</p>;

  const width = 560;
  const left = 52;
  const bottom = 22;
  const top = 8;
  const right = 8;
  const x0 = Math.min(...all.map((point) => point.t));
  const x1 = Math.max(...all.map((point) => point.t));
  const y0 = Math.min(...all.map((point) => point.v));
  const y1 = Math.max(...all.map((point) => point.v));
  const xOf = (t: number) => left + (x1 === x0 ? 0 : (t - x0) / (x1 - x0)) * (width - left - right);
  const yOf = (v: number) => top + (1 - (y1 === y0 ? 0.5 : (v - y0) / (y1 - y0))) * (height - top - bottom);
  const first = all.reduce((a, b) => (a.t <= b.t ? a : b));
  const last = all.reduce((a, b) => (a.t >= b.t ? a : b));
  const startYear = new Date(x0).getUTCFullYear();
  const endYear = new Date(x1).getUTCFullYear();
  const yearSpan = endYear - startYear;
  const step = Math.max(1, Math.ceil(yearSpan / 6));

  const grid = [];
  for (let i = 0; i <= 4; i += 1) {
    const value = y0 + ((y1 - y0) * i) / 4;
    const y = yOf(value);
    grid.push(
      <g key={`y-${i}`}>
        <line x1={left} x2={width - right} y1={y} y2={y} stroke="#e2d8c8" />
        <text x={left - 6} y={y + 4} textAnchor="end" fill="#5e574e" fontSize="11">
          {format(value)}
        </text>
      </g>,
    );
  }

  const years = [];
  if (yearSpan === 0) {
    years.push(
      <text key="start" x={left} y={height - 6} fill="#5e574e" fontSize="11">
        {first.label}
      </text>,
      <text key="end" x={width - right} y={height - 6} textAnchor="end" fill="#5e574e" fontSize="11">
        {last.label}
      </text>,
    );
  } else {
    for (let year = startYear + 1; year <= endYear; year += step) {
      const t = Date.parse(`${year}-01-01T00:00:00Z`);
      years.push(
        <text key={year} x={xOf(t)} y={height - 6} textAnchor="middle" fill="#5e574e" fontSize="11">
          {year}
        </text>,
      );
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {plotted.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: item.color }} aria-hidden="true" />
            {item.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={plotted.map((item) => item.name).join(", ")}>
        {grid}
        {years}
        {plotted.map((item) =>
          item.pts.length === 1 ? (
            <circle key={item.name} cx={xOf(item.pts[0].t)} cy={yOf(item.pts[0].v)} r="4" fill={item.color} />
          ) : (
            <polyline
              key={item.name}
              fill="none"
              stroke={item.color}
              strokeWidth="1.8"
              points={item.pts.map((point) => `${xOf(point.t).toFixed(1)},${yOf(point.v).toFixed(1)}`).join(" ")}
            />
          ),
        )}
      </svg>
    </div>
  );
}
