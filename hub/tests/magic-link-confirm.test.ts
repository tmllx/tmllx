import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/auth/[...nextauth]/route";
import { upsertAllowedEmail } from "@/lib/auth/allowlist";
import { parseMagicCallback, signInErrorMessage, toConfirmUrl } from "@/lib/auth/confirm-link";
import { SESSION_MAX_AGE_SECONDS, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session-cookie";
import { commitSessionCookies } from "@/lib/auth/session-response";
import { getDb } from "@/lib/db";
import { sessions, verificationTokens } from "@/lib/db/schema";
import { resetDb } from "./helpers";

const TOKEN = "abc123abc123abc123abc123abc123ab";
const EMAIL = "household@local.test";

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}${process.env.AUTH_SECRET}`).digest("hex");
}

function callbackUrl(token = TOKEN, email = EMAIL, next = "/meals"): string {
  const url = new URL("http://localhost:3000/api/auth/callback/nodemailer");
  url.searchParams.set("callbackUrl", next);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url.toString();
}

async function plantToken(email: string, token: string, expires = new Date(Date.now() + 10 * 60 * 1000)) {
  await getDb().insert(verificationTokens).values({ identifier: email, token: hashToken(token), expires });
}

async function tokenStillThere(token: string): Promise<boolean> {
  const rows = await getDb().select().from(verificationTokens).where(eq(verificationTokens.token, hashToken(token)));
  return rows.length === 1;
}

describe("magic link confirm", () => {
  beforeEach(resetDb);
  afterEach(() => {
    process.env.AUTH_URL = "http://localhost:3000";
  });

  it("points the email at a confirm page and keeps the callback off the top-level path", () => {
    const confirm = new URL(toConfirmUrl(callbackUrl()));
    expect(confirm.pathname).toBe("/signin/confirm");
    expect(confirm.searchParams.get("url")).toContain("/api/auth/callback/nodemailer");
    const target = parseMagicCallback(confirm.searchParams.get("url"), confirm.origin);
    expect(target?.nextPath).toBe("/meals");
    expect(target?.email).toBe(EMAIL);
    expect(target?.action.startsWith("/api/auth/callback/nodemailer?")).toBe(true);
    expect(target?.action).toContain("token=" + TOKEN);
    const absoluteNext = new URL(toConfirmUrl(callbackUrl(TOKEN, EMAIL, "http://localhost:3000/photos?album=1")));
    expect(parseMagicCallback(absoluteNext.searchParams.get("url"), absoluteNext.origin)?.nextPath).toBe("/photos?album=1");
  });

  it("rejects off-site confirm targets and open redirects", () => {
    const origin = "https://hub.example.com";
    const token = TOKEN;
    expect(parseMagicCallback("https://evil.example/api/auth/callback/nodemailer?token=" + token + "&email=a@b.co", origin)).toBeNull();
    expect(parseMagicCallback("//evil.example/api/auth/callback/nodemailer?token=" + token + "&email=a@b.co", origin)).toBeNull();
    expect(parseMagicCallback("javascript:alert(1)", origin)).toBeNull();
    expect(parseMagicCallback("/signin/confirm?url=1", origin)).toBeNull();
    const redirected = parseMagicCallback(
      `/api/auth/callback/nodemailer?token=${token}&email=a@b.co&callbackUrl=https://evil.example/phish`,
      origin,
    );
    expect(redirected?.nextPath).toBe("/");
    expect(redirected?.action).toContain("callbackUrl=%2F");
    const sneaky = parseMagicCallback(
      `/api/auth/callback/nodemailer?token=${token}&email=a@b.co&callbackUrl=${encodeURIComponent("/\t//evil.example")}`,
      origin,
    );
    expect(sneaky?.nextPath).toBe("/");
  });

  it("keeps a SameSite=Lax host-only cookie for about 90 days", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(90 * 24 * 60 * 60);
    const expires = new Date("2030-01-01T00:00:00.000Z");
    const httpsEnv = { AUTH_URL: "https://hub.example.com", NODE_ENV: "production" } as NodeJS.ProcessEnv;
    const httpEnv = { AUTH_URL: "http://localhost:3000", NODE_ENV: "test" } as NodeJS.ProcessEnv;
    const secure = sessionCookieOptions(expires, httpsEnv);
    expect(sessionCookieName(httpsEnv)).toBe("__Secure-authjs.session-token");
    expect(secure).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: SESSION_MAX_AGE_SECONDS, expires });
    expect(sessionCookieOptions(expires, httpEnv).secure).toBe(false);
    expect("domain" in secure).toBe(false);
  });

  it("does not follow an off-site session redirect", () => {
    const headers = new Headers();
    headers.append("set-cookie", "authjs.session-token=abc; Path=/; HttpOnly; SameSite=Lax");
    headers.set("location", "https://evil.example/phish");
    const res = commitSessionCookies(new Response(null, { status: 302, headers }), "https://hub.example.com");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    return res.text().then((html) => {
      expect(html).toContain('content="0;url=/"');
      expect(html).not.toContain("evil.example");
    });
  });

  it("leaves a used or expired link on the sign-in error redirect", () => {
    expect(signInErrorMessage("Verification")).toMatch(/expired or was already used/);
    expect(signInErrorMessage("AccessDenied")).toMatch(/invite list/);
  });

  it("does not consume the token when the link is only opened", async () => {
    await upsertAllowedEmail(EMAIL, "household");
    await plantToken(EMAIL, TOKEN);
    const opened = await GET(new NextRequest(callbackUrl()));
    expect(opened.status).toBe(307);
    const location = new URL(opened.headers.get("location") || "");
    expect(location.pathname).toBe("/signin/confirm");
    expect(opened.headers.get("set-cookie")).toBeNull();
    expect(await tokenStillThere(TOKEN)).toBe(true);

    const signedIn = await POST(new NextRequest(callbackUrl(), { method: "POST" }));
    expect(signedIn.status).toBe(200);
    const html = await signedIn.text();
    expect(html).toContain("Continue to Hub");
    expect(html).toContain("/meals");
    const cookie = signedIn.headers.getSetCookie().find((value) => value.includes("authjs.session-token=")) || "";
    expect(cookie).toMatch(/authjs\.session-token=/);
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie.toLowerCase()).not.toContain("samesite=none");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).not.toContain("secure");
    expect(cookie.toLowerCase()).toContain(`max-age=${SESSION_MAX_AGE_SECONDS}`);
    expect(await tokenStillThere(TOKEN)).toBe(false);

    const rows = await getDb().select().from(sessions);
    expect(rows).toHaveLength(1);
    const lifetime = rows[0].expires.getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(89 * 24 * 60 * 60 * 1000);
    expect(lifetime).toBeLessThan(91 * 24 * 60 * 60 * 1000);

    const again = await POST(new NextRequest(callbackUrl(), { method: "POST" }));
    expect(again.status).toBe(302);
    const againLocation = again.headers.get("location") || "";
    expect(againLocation).toContain("/signin");
    expect(againLocation).toContain("error=Verification");
    expect(againLocation).toContain("email=" + encodeURIComponent(EMAIL));
  });

  it("still refuses a magic link for an address that is not invited", async () => {
    const token = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    await plantToken("stranger@example.com", token);
    const res = await POST(new NextRequest(callbackUrl(token, "stranger@example.com", "/"), { method: "POST" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location") || "").toContain("error=AccessDenied");
    expect(await getDb().select().from(sessions)).toHaveLength(0);
  });
});
