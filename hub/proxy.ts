import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess, safeNextPath } from "@/lib/access";
import { viewerFromCookies } from "@/lib/auth/viewer";

function withRobots(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname === "/api/signin" || pathname === "/api/dev/login") {
    return withRobots(NextResponse.next());
  }
  const viewer = pathname.startsWith("/_next")
    ? null
    : await viewerFromCookies((name) => request.cookies.get(name)?.value);
  const decision = decideAccess(viewer?.role ?? null, pathname, request.method);
  if (decision === "allow") return withRobots(NextResponse.next());
  if (decision === "not-found") {
    if (pathname.startsWith("/api/")) {
      return withRobots(NextResponse.json({ error: "not_found" }, { status: 404 }));
    }
    return new NextResponse(notFoundDocument(), {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "noindex, nofollow",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
      },
    });
  }
  if (pathname.startsWith("/api/")) {
    const status = decision === "unauthenticated" ? 401 : 403;
    return withRobots(NextResponse.json({ error: status === 401 ? "unauthorized" : "forbidden" }, { status }));
  }
  if (decision === "redirect-photos") {
    return withRobots(NextResponse.redirect(new URL("/photos", request.url)));
  }
  if (decision === "unauthenticated") {
    const next = safeNextPath(pathname);
    const url = new URL("/signin", request.url);
    if (next !== "/") url.searchParams.set("next", next);
    return withRobots(NextResponse.redirect(url));
  }
  return new NextResponse(forbiddenDocument(), {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function notFoundDocument(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Not found</title>
    <style>
      body { margin: 0; background: #f4efe4; color: #1c1915; font-family: Georgia, "Iowan Old Style", serif; }
      main { max-width: 32rem; margin: 0 auto; padding: 3rem 1.25rem; }
      p { font-family: "Avenir Next", "Segoe UI", sans-serif; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Not found</h1>
      <p>This page is not available.</p>
    </main>
  </body>
</html>`;
}

function forbiddenDocument(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Unavailable</title>
    <style>
      body { margin: 0; background: #f4efe4; color: #1c1915; font-family: Georgia, "Iowan Old Style", serif; }
      main { max-width: 32rem; margin: 0 auto; padding: 3rem 1.25rem; }
      p { font-family: "Avenir Next", "Segoe UI", sans-serif; line-height: 1.5; }
      a { color: #2f5d45; }
    </style>
  </head>
  <body>
    <main>
      <h1>This page is not available</h1>
      <p>Your sign-in can open photos. The rest of the hub stays with the household.</p>
      <p><a href="/photos">Go to photos</a></p>
    </main>
  </body>
</html>`;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
