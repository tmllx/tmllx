export function formatStamp(value: string): string {
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = new Date(value);
  if (!zoned || Number.isNaN(parsed.getTime())) {
    const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value);
    if (naive) return `${naive[1]} ${naive[2]}`;
    return value;
  }
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/New_York",
    }).format(parsed) + " ET"
  );
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Stamp shown as "Last updated".
 * Prefer status JSON updated_at, then the status row's updated_at column,
 * then the older status JSON field named updated.
 */
export function lastUpdatedSource(statusJson: unknown, rowUpdatedAt: string | null): string | null {
  const status = record(statusJson);
  if (status && typeof status.updated_at === "string" && status.updated_at.trim()) return status.updated_at.trim();
  if (rowUpdatedAt) return rowUpdatedAt;
  if (status && typeof status.updated === "string" && status.updated.trim()) return status.updated.trim();
  return null;
}
