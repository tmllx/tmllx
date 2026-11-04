import type { JsonValue } from "./types";

export const MAX_HOW_IT_WORKS_BYTES = 20 * 1024;
export const MAX_HOW_IT_WORKS_SECTIONS = 40;
export const MAX_HOW_IT_WORKS_TITLE = 200;

export type HowItWorksSection = { title: string; body_md: string };

export type SnapshotIssue =
  | { ok: true }
  | { ok: false; status: 400 | 413; error: "invalid_json" | "too_large" };

function plainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  return value as Record<string, unknown>;
}

/**
 * `{ sections: [{ title, body_md }] }`. About a dozen sections, at most 40, and at most 20KB.
 * Markdown is stored as text and rendered later without raw HTML.
 */
export function validateHowItWorks(data: JsonValue): SnapshotIssue {
  const body = plainObject(data);
  if (!body || Object.keys(body).length !== 1 || !Object.prototype.hasOwnProperty.call(body, "sections")) {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  const sections = body.sections;
  if (!Array.isArray(sections) || sections.length > MAX_HOW_IT_WORKS_SECTIONS) {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  for (const section of sections) {
    const row = plainObject(section);
    if (!row) return { ok: false, status: 400, error: "invalid_json" };
    const keys = Object.keys(row);
    if (keys.length !== 2 || !keys.includes("title") || !keys.includes("body_md")) {
      return { ok: false, status: 400, error: "invalid_json" };
    }
    if (typeof row.title !== "string" || typeof row.body_md !== "string") {
      return { ok: false, status: 400, error: "invalid_json" };
    }
    if (!row.title.trim() || row.title.length > MAX_HOW_IT_WORKS_TITLE) {
      return { ok: false, status: 400, error: "invalid_json" };
    }
  }
  if (Buffer.byteLength(JSON.stringify(data), "utf8") > MAX_HOW_IT_WORKS_BYTES) {
    return { ok: false, status: 413, error: "too_large" };
  }
  return { ok: true };
}

export function readHowItWorks(data: unknown): HowItWorksSection[] | null {
  if (!plainObject(data)) return null;
  const issue = validateHowItWorks(data as JsonValue);
  if (!issue.ok) return null;
  return (data as { sections: HowItWorksSection[] }).sections;
}
