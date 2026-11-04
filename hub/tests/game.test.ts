import { existsSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { GET as getGame } from "@/app/game/route";
import HomePage from "@/app/page";
import { createDevSession } from "@/lib/auth/dev-session";
import { upsertAllowedEmail } from "@/lib/auth/allowlist";
import { HOUSEHOLD_LINKS, PHOTO_LINKS } from "@/lib/nav";
import { proxy } from "@/proxy";
import { resetDb } from "./helpers";

function asSession(email: string | null) {
  vi.mocked(auth).mockResolvedValue(
    (email
      ? { user: { email, id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" }
      : null) as unknown as Awaited<ReturnType<typeof auth>>,
  );
}

function proxyRequest(pathname: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `authjs.session-token=${token}`);
  return new NextRequest(new URL(pathname, "http://localhost:3000"), { headers });
}

function nextParam(response: Response): string | null {
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location, "http://localhost:3000").searchParams.get("next");
}

describe("the long ascent", () => {
  beforeEach(async () => {
    await resetDb();
    await upsertAllowedEmail("household@local.test", "household");
    await upsertAllowedEmail("photos@local.test", "photos");
  });

  it("is stored outside public/ and keeps the game script", async () => {
    expect(existsSync(path.join(process.cwd(), "public", "game"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "public", "long-ascent"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "content", "long-ascent", "index.html"))).toBe(true);

    asSession("household@local.test");
    const response = await getGame(new Request("http://localhost:3000/game?debug=1"));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("location")).toBeNull();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain("The Long Ascent");
    expect(html).toContain('const DEBUG = /[?&]debug=1\\b/.test(location.search);');
    expect(html).toContain("localStorage.setItem");
    expect(html).toContain('const SAVE_KEY = "longascent.v3.save";');
  });

  it("serves the same document for any query string", async () => {
    asSession("household@local.test");
    const plain = await (await getGame(new Request("http://localhost:3000/game"))).text();
    const debug = await (await getGame(new Request("http://localhost:3000/game?debug=1&x=2"))).text();
    expect(debug).toBe(plain);
  });

  it("redirects signed-out visitors and keeps the query on next", async () => {
    asSession(null);
    const plain = await getGame(new Request("http://localhost:3000/game"));
    expect(plain.status).toBe(307);
    expect(nextParam(plain)).toBe("/game");

    const debug = await getGame(new Request("http://localhost:3000/game?debug=1"));
    expect(debug.status).toBe(307);
    expect(nextParam(debug)).toBe("/game?debug=1");
    expect(debug.headers.get("x-robots-tag")).toContain("noindex");
    expect(debug.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 403 for the photos role without the game", async () => {
    asSession("photos@local.test");
    const response = await getGame(new Request("http://localhost:3000/game?debug=1"));
    const html = await response.text();
    expect(response.status).toBe(403);
    expect(html).not.toContain("longascent.v3.save");
    expect(html).toContain("noindex");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("enforces the same rules in the proxy and lists the game for the household", async () => {
    const signedOut = await proxy(proxyRequest("/game"));
    expect(signedOut.status).toBe(307);
    expect(nextParam(signedOut)).toBe("/game");

    const signedOutDebug = await proxy(proxyRequest("/game?debug=1"));
    expect(signedOutDebug.status).toBe(307);
    expect(nextParam(signedOutDebug)).toBe("/game?debug=1");

    const photos = await createDevSession("photos@local.test");
    const household = await createDevSession("household@local.test");
    expect(photos && household).toBeTruthy();

    const photosPage = await proxy(proxyRequest("/game?debug=1", photos!.token));
    const photosHtml = await photosPage.text();
    expect(photosPage.status).toBe(403);
    expect(photosHtml).not.toContain("longascent.v3.save");

    const householdPage = await proxy(proxyRequest("/game?debug=1", household!.token));
    expect(householdPage.status).toBe(200);

    expect(HOUSEHOLD_LINKS.map((link) => link.href)).toContain("/game");
    expect(PHOTO_LINKS.map((link) => link.href)).not.toContain("/game");

    asSession("household@local.test");
    const home = renderToStaticMarkup(await HomePage());
    expect(home).toContain('href="/game"');
    expect(home).toContain("The Long Ascent");
  });
});
