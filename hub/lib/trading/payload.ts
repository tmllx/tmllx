import { isTradingSnapshotName, type JsonValue, type TradingSnapshotName } from "./types";

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export type IngestEntry = { name: TradingSnapshotName; data: JsonValue };

export type IngestBody =
  | { ok: true; entries: IngestEntry[] }
  | { ok: false; status: 400 | 413; error: "invalid_json" | "invalid_name" | "too_large" };

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return true;
  if (kind === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (kind === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

function recordEntries(files: Record<string, unknown>): IngestBody {
  const entries: IngestEntry[] = [];
  for (const [name, data] of Object.entries(files)) {
    if (!isTradingSnapshotName(name)) return { ok: false, status: 400, error: "invalid_name" };
    if (!isJsonValue(data)) return { ok: false, status: 400, error: "invalid_json" };
    entries.push({ name, data });
  }
  return { ok: true, entries };
}

export function parseIngestBody(text: string): IngestBody {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  const body = parsed as Record<string, unknown>;
  if ("files" in body) {
    const files = body.files;
    if (!files || typeof files !== "object" || Array.isArray(files)) {
      return { ok: false, status: 400, error: "invalid_json" };
    }
    return recordEntries(files as Record<string, unknown>);
  }
  if ("name" in body || "data" in body) {
    if (typeof body.name !== "string" || !isTradingSnapshotName(body.name)) {
      return { ok: false, status: 400, error: "invalid_name" };
    }
    if (!("data" in body) || !isJsonValue(body.data)) {
      return { ok: false, status: 400, error: "invalid_json" };
    }
    return { ok: true, entries: [{ name: body.name, data: body.data }] };
  }
  return { ok: false, status: 400, error: "invalid_json" };
}

export async function readCappedText(request: Request, max = MAX_BODY_BYTES): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isFinite(size) || size < 0 || size > max) return { ok: false };
  }
  if (!request.body) {
    const text = await request.text();
    if (Buffer.byteLength(text) > max) return { ok: false };
    return { ok: true, text };
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(buf) };
}

export async function readIngestRequest(request: Request): Promise<IngestBody> {
  const capped = await readCappedText(request);
  if (!capped.ok) return { ok: false, status: 413, error: "too_large" };
  return parseIngestBody(capped.text);
}
