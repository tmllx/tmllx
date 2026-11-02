import { timingSafeEqual } from "node:crypto";

export type IngestAuth = "ok" | "unauthorized" | "unconfigured";

function tokensMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  const length = Math.max(left.length, right.length, 1);
  const paddedLeft = Buffer.alloc(length);
  const paddedRight = Buffer.alloc(length);
  left.copy(paddedLeft);
  right.copy(paddedRight);
  return timingSafeEqual(paddedLeft, paddedRight) && left.length === right.length;
}

const MAX_TOKEN_CHARS = 512;

function readBearer(header: string | null): string | null {
  if (!header || header.length > MAX_TOKEN_CHARS + 32) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match || match[1].length > MAX_TOKEN_CHARS) return null;
  return match[1];
}

export function ingestAuthDecision(header: string | null, expected: string | undefined): IngestAuth {
  if (typeof expected !== "string" || expected.length === 0) return "unconfigured";
  const provided = readBearer(header);
  const matches = tokensMatch(provided ?? "", expected);
  if (provided === null || !matches) return "unauthorized";
  return "ok";
}
