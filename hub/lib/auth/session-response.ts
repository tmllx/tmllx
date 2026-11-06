import { safeNextPath } from "@/lib/access";

/**
 * Safari drops Set-Cookie on a cross-site 302, which is how a mail client opens the
 * Auth.js callback. A 200 that sets the cookie, then a same-site navigation, keeps it.
 * Error redirects have no session cookie and are left as redirects.
 */
export function commitSessionCookies(response: Response, origin: string): Response {
  if (response.status < 300 || response.status >= 400) return response;
  const location = response.headers.get("location");
  if (!location) return response;
  const cookies = readSetCookies(response);
  if (!cookies.some(setsSession)) return response;
  const destination = sameOriginPath(location, origin);
  const headers = new Headers();
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(signedInDocument(destination), { status: 200, headers });
}

/** Keep the address and destination that failed, so a new link opens the same page. */
export function attachVerificationEmail(
  response: Response,
  email: string | null,
  origin: string,
  nextPath?: string | null,
): Response {
  if (!email || response.status < 300 || response.status >= 400) return response;
  const location = response.headers.get("location");
  if (!location) return response;
  let url: URL;
  try {
    url = new URL(location, origin);
  } catch {
    return response;
  }
  if (!trustedOrigin(url.origin, origin) || url.pathname !== "/signin") return response;
  if (url.searchParams.get("error") !== "Verification" || url.searchParams.has("email")) return response;
  url.searchParams.set("email", email);
  const next = safeNextPath(nextPath);
  if (next !== "/" && !url.searchParams.has("next")) url.searchParams.set("next", next);
  const headers = new Headers(response.headers);
  headers.set("location", `${url.pathname}${url.search}`);
  return new Response(null, { status: response.status, headers });
}

function readSetCookies(response: Response): string[] {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  return [];
}

function setsSession(cookie: string): boolean {
  const pair = cookie.split(";")[0] ?? "";
  const eq = pair.indexOf("=");
  if (eq <= 0) return false;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  return name.endsWith("authjs.session-token") && value.length > 0;
}

function sameOriginPath(location: string, origin: string): string {
  try {
    const url = new URL(location, origin);
    if (!trustedOrigin(url.origin, origin)) return "/";
    return safeNextPath(url.pathname + url.search + url.hash);
  } catch {
    return "/";
  }
}

function trustedOrigin(candidate: string, requestOrigin: string): boolean {
  if (candidate === requestOrigin) return true;
  const configured = process.env.AUTH_URL;
  if (!configured) return false;
  try {
    return new URL(configured).origin === candidate;
  } catch {
    return false;
  }
}

function signedInDocument(path: string): string {
  const href = escapeHtml(path);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="referrer" content="no-referrer" />
    <title>Continue to Hub</title>
    <meta http-equiv="refresh" content="0;url=${href}" />
    <style>
      body { margin: 0; background: #f4efe4; color: #1c1915; font-family: Georgia, "Iowan Old Style", serif; }
      main { max-width: 32rem; margin: 0 auto; padding: 3rem 1.25rem; }
      p, a { font-family: "Avenir Next", "Segoe UI", sans-serif; line-height: 1.5; }
      a { color: #2f5d45; }
    </style>
  </head>
  <body>
    <main>
      <h1>Continue to Hub</h1>
      <p>You are signed in.</p>
      <p><a href="${href}">Continue to Hub</a></p>
    </main>
    <script>location.replace(${JSON.stringify(path)});</script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
