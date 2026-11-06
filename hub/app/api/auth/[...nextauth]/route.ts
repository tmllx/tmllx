import { handlers } from "@/auth";
import { confirmRedirect, nextPathFromInput, parseMagicCallback } from "@/lib/auth/confirm-link";
import { handleMagicLinkRequest, ipFrom } from "@/lib/auth/magic-link";
import { attachVerificationEmail, commitSessionCookies } from "@/lib/auth/session-response";
import { NextResponse, type NextRequest } from "next/server";

function isEmailSignIn(url: URL): boolean {
  return url.pathname.endsWith("/signin/nodemailer");
}

function isEmailCallback(url: URL): boolean {
  return url.pathname.endsWith("/callback/nodemailer");
}

/**
 * A GET (mail scanner, Safari prefetch, or link preview) must not reach Auth.js.
 * useVerificationToken deletes the one-time token on the first request that does.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (isEmailCallback(url)) {
    const res = NextResponse.redirect(confirmRedirect(url));
    res.headers.set("cache-control", "no-store");
    res.headers.set("referrer-policy", "no-referrer");
    return res;
  }
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (isEmailSignIn(url)) {
    const form = await req.clone().formData();
    const email = String(form.get("email") || "");
    const nextPath = nextPathFromInput(String(form.get("callbackUrl") || form.get("next") || "/"), url.origin);
    const result = await handleMagicLinkRequest(email, ipFrom(req), nextPath);
    return NextResponse.json(result.body, { status: result.status });
  }
  if (isEmailCallback(url)) {
    const res = await handlers.POST(req);
    const target = parseMagicCallback(url.pathname + url.search, url.origin);
    return commitSessionCookies(
      attachVerificationEmail(res, target?.email ?? null, url.origin, target?.nextPath),
      url.origin,
    );
  }
  return handlers.POST(req);
}
