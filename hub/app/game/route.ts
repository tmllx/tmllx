import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { decideAccess, safeNextPath } from "@/lib/access";
import { getViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GAME_PATH = path.join(process.cwd(), "content", "long-ascent", "index.html");

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
} as const;

function ensureRobotsMeta(html: string): string {
  if (/<meta\s+[^>]*name=["']robots["']/i.test(html)) return html;
  const tag = '<meta name="robots" content="noindex, nofollow">';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (head) => `${head}\n${tag}`);
  return `${tag}\n${html}`;
}

function signInRedirect(request: Request): NextResponse {
  const url = new URL(request.url);
  const next = safeNextPath(url.pathname + url.search);
  const signIn = new URL("/signin", url);
  if (next !== "/") signIn.searchParams.set("next", next);
  const response = NextResponse.redirect(signIn);
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
  return response;
}

function forbiddenDocument(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Unavailable</title>
</head>
<body>
<p>This page is not available.</p>
</body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const viewer = await getViewer();
  const decision = decideAccess(viewer?.role ?? null, url.pathname, "GET");
  if (decision === "unauthenticated" || !viewer) return signInRedirect(request);
  if (decision !== "allow" || viewer.role !== "household") {
    return new NextResponse(forbiddenDocument(), {
      status: 403,
      headers: { ...PRIVATE_HEADERS, "content-type": "text/html; charset=utf-8" },
    });
  }
  const html = ensureRobotsMeta(await readFile(GAME_PATH, "utf8"));
  return new NextResponse(html, {
    status: 200,
    headers: { ...PRIVATE_HEADERS, "content-type": "text/html; charset=utf-8" },
  });
}
