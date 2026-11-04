import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { GET as getTrading } from "@/app/api/trading/route";
import * as ingestRoute from "@/app/api/trading/ingest/route";
import { AlphaScorecard } from "@/components/trading/alpha-scorecard";
import { HowItWorks } from "@/components/trading/how-it-works";
import { SafeMarkdown } from "@/components/trading/markdown";
import { TradingDashboard } from "@/components/trading/dashboard";
import { HOUSEHOLD_LINKS, PHOTO_LINKS } from "@/lib/nav";
import { proxy } from "@/proxy";
import { createDevSession } from "@/lib/auth/dev-session";
import { upsertAllowedEmail } from "@/lib/auth/allowlist";
import { listTradingSnapshots } from "@/lib/data/trading";
import { MAX_ALPHA_BYTES, cumulativeIndex } from "@/lib/trading/alpha";
import { MAX_HOW_IT_WORKS_BYTES } from "@/lib/trading/how-it-works";
import { MAX_BODY_BYTES, parseIngestBody, readCappedText } from "@/lib/trading/payload";
import { lastUpdatedSource } from "@/lib/trading/status";
import howItWorksSample from "./fixtures/how_it_works.json";
import { resetDb } from "./helpers";

const TOKEN = "test-ingest-token";
const postIngest = ingestRoute.POST;

function asSession(email: string | null) {
  vi.mocked(auth).mockResolvedValue(
    (email ? { user: { email, id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" } : null) as unknown as Awaited<
      ReturnType<typeof auth>
    >,
  );
}

function ingestRequest(body: unknown, token?: string, extra?: { bytes?: Uint8Array }) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (extra?.bytes) {
    return new Request("http://local/api/trading/ingest", {
      method: "POST",
      headers,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(extra.bytes);
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
  }
  return new Request("http://local/api/trading/ingest", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("trading snapshots", () => {
  beforeEach(async () => {
    await resetDb();
    await upsertAllowedEmail("household@local.test", "household");
    await upsertAllowedEmail("photos@local.test", "photos");
    process.env.TRADING_INGEST_TOKEN = TOKEN;
  });

  it("rejects ingest when the token is missing, wrong, or unset", async () => {
    const missing = await postIngest(ingestRequest({ name: "status", data: { mode: "sim" } }));
    expect(missing.status).toBe(401);
    const wrong = await postIngest(ingestRequest({ name: "status", data: { mode: "sim" } }, "not-the-token"));
    expect(wrong.status).toBe(401);
    const short = await postIngest(ingestRequest({ name: "status", data: { mode: "sim" } }, "x"));
    expect(short.status).toBe(401);
    const huge = await postIngest(ingestRequest({ name: "status", data: { mode: "sim" } }, "a".repeat(4000)));
    expect(huge.status).toBe(401);
    expect((await listTradingSnapshots()).files.status).toBeUndefined();

    delete process.env.TRADING_INGEST_TOKEN;
    const unset = await postIngest(ingestRequest({ name: "status", data: { mode: "sim" } }, TOKEN));
    expect(unset.status).toBe(503);
    expect((await unset.json()).error).toBe("unconfigured");
  });

  it("upserts allowlisted names and rejects anything else", async () => {
    const bad = await postIngest(
      ingestRequest(
        { files: { positions: { equity: 10, cash: 1, positions: [] }, ledger: { secret: true } } },
        TOKEN,
      ),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid_name");
    expect((await listTradingSnapshots()).files.positions).toBeUndefined();

    const single = await postIngest(
      ingestRequest({ name: "positions", data: { equity: 10, cash: 4, positions: [], asof: "2026-01-02" } }, TOKEN),
    );
    expect(single.status).toBe(200);
    expect(await single.json()).toEqual({ updated: ["positions"] });

    const batch = await postIngest(
      ingestRequest(
        {
          files: {
            status: { updated_at: "2026-01-15T15:04:00Z", mode: "sim", asof: "2026-01-14", universe_size: 3 },
            positions: {
              equity: 1000,
              cash: 800,
              asof: "2026-01-14",
              positions: [{ ticker: "TEST", shares: 2, avg_entry: 50, price: 55, value: 110, pnl_pct: 0.1, stop: 45 }],
            },
          },
        },
        TOKEN,
      ),
    );
    expect(batch.status).toBe(200);
    expect((await batch.json()).updated).toEqual(["positions", "status"]);

    const stored = await listTradingSnapshots();
    expect(stored.files.positions).toMatchObject({ equity: 1000 });
    expect(stored.files.status).toMatchObject({ mode: "sim" });
    expect(stored.updatedAt.status).toBeTruthy();

    const junk = await postIngest(ingestRequest("{", TOKEN));
    expect(junk.status).toBe(400);
    expect((await junk.json()).error).toBe("invalid_json");
    expect(parseIngestBody(JSON.stringify({ name: "nope", data: { n: 1 } })).ok).toBe(false);
  });

  it("caps the body at 2 MB and does not expose GET", async () => {
    expect("GET" in ingestRoute).toBe(false);
    const oversized = await postIngest(
      ingestRequest({ name: "status", data: { note: "a".repeat(MAX_BODY_BYTES) } }, TOKEN),
    );
    expect(oversized.status).toBe(413);
    const chunk = new Uint8Array(MAX_BODY_BYTES + 1);
    const capped = await readCappedText(ingestRequest("", TOKEN, { bytes: chunk }));
    expect(capped.ok).toBe(false);
    expect((await listTradingSnapshots()).files.status).toBeUndefined();
  });

  it("keeps trading household-only", async () => {
    await postIngest(
      ingestRequest({ name: "status", data: { updated_at: "2026-01-15T15:04:00Z", mode: "sim", asof: "2026-01-14" } }, TOKEN),
    );

    asSession(null);
    expect((await getTrading()).status).toBe(401);

    asSession("photos@local.test");
    const hidden = await getTrading();
    expect(hidden.status).toBe(404);
    expect(await hidden.text()).not.toContain("sim");

    asSession("household@local.test");
    const visible = await getTrading();
    expect(visible.status).toBe(200);
    const payload = await visible.json();
    expect(payload.files.status.mode).toBe("sim");
    expect(payload.lastUpdated).toBe("2026-01-15T15:04:00Z");

    asSession("photos@local.test");
    const wrote = await postIngest(ingestRequest({ name: "trades", data: { trades: [] } }, TOKEN));
    expect(wrote.status).toBe(200);
    const denied = await postIngest(ingestRequest({ name: "trades", data: { trades: [{ ticker: "NO" }] } }));
    expect(denied.status).toBe(401);

    const photos = await createDevSession("photos@local.test");
    const household = await createDevSession("household@local.test");
    expect(photos && household).toBeTruthy();
    const photosPage = await proxy(proxyRequest("/trading", photos!.token));
    const photosHtml = await photosPage.text();
    expect(photosPage.status).toBe(404);
    expect(photosHtml).toContain("Not found");
    expect(photosHtml).not.toMatch(/Trading|equity/i);
    const photosApi = await proxy(proxyRequest("/api/trading", photos!.token));
    expect(photosApi.status).toBe(404);
    const householdPage = await proxy(proxyRequest("/trading", household!.token));
    expect(householdPage.status).toBe(200);
    const signedOut = await proxy(proxyRequest("/trading"));
    expect(signedOut.status).toBe(307);
    expect(signedOut.headers.get("location")).toContain("/signin");
    expect(signedOut.headers.get("location")).toContain("next=%2Ftrading");

    expect(HOUSEHOLD_LINKS.map((link) => link.href)).toContain("/trading");
    expect(PHOTO_LINKS.map((link) => link.href)).not.toContain("/trading");
  });

  it("stores how_it_works and a loose alpha document, and rejects a bad shape", async () => {
    const malformed = await postIngest(
      ingestRequest(
        {
          files: {
            status: { mode: "sim" },
            how_it_works: { html: "<p>nope</p>" },
          },
        },
        TOKEN,
      ),
    );
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toBe("invalid_json");
    expect((await listTradingSnapshots()).files.status).toBeUndefined();

    const blankTitle = parseIngestBody(
      JSON.stringify({ name: "how_it_works", data: { sections: [{ title: "  ", body_md: "x" }] } }),
    );
    expect(blankTitle.ok).toBe(false);
    const extraKey = parseIngestBody(
      JSON.stringify({ name: "how_it_works", data: { sections: [{ title: "Overview", body_md: "x", html: "<b>no</b>" }] } }),
    );
    expect(extraKey.ok).toBe(false);

    const guide = await postIngest(ingestRequest({ name: "how_it_works", data: howItWorksSample }, TOKEN));
    expect(guide.status).toBe(200);
    expect(await guide.json()).toEqual({ updated: ["how_it_works"] });

    const oversizedGuide = await postIngest(
      ingestRequest(
        {
          name: "how_it_works",
          data: { sections: [{ title: "Big", body_md: "a".repeat(MAX_HOW_IT_WORKS_BYTES) }] },
        },
        TOKEN,
      ),
    );
    expect(oversizedGuide.status).toBe(413);
    expect((await listTradingSnapshots()).files.how_it_works).toMatchObject({ sections: expect.any(Array) });

    expect(parseIngestBody(JSON.stringify({ name: "alpha", data: {} })).ok).toBe(true);
    const alpha = await postIngest(
      ingestRequest(
        {
          name: "alpha",
          data: {
            start_date: "2026-01-02",
            start_equity: 5000,
            beta: null,
            alpha: null,
            strategy: { equity: 5200, return: 0.04 },
            spy: { value: 5100, return: 0.02 },
            series: [{ date: "2026-01-02", strategy_ret: 0.01, spy_ret: 0 }],
            later: { anything: true },
          },
        },
        TOKEN,
      ),
    );
    expect(alpha.status).toBe(200);
    expect(await alpha.json()).toEqual({ updated: ["alpha"] });

    const alphaList = await postIngest(ingestRequest({ name: "alpha", data: [{ beta: 1 }] }, TOKEN));
    expect(alphaList.status).toBe(400);
    expect((await alphaList.json()).error).toBe("invalid_json");
    const alphaHuge = await postIngest(
      ingestRequest({ name: "alpha", data: { blob: "a".repeat(MAX_ALPHA_BYTES) } }, TOKEN),
    );
    expect(alphaHuge.status).toBe(413);
    expect((await listTradingSnapshots()).files.alpha).toMatchObject({ beta: null, later: { anything: true } });

    asSession("photos@local.test");
    const hidden = await getTrading();
    expect(hidden.status).toBe(404);
    const hiddenText = await hidden.text();
    expect(hiddenText).not.toContain("long-only swing trading");
    expect(hiddenText).not.toContain("needs 20 days of data");

    asSession("household@local.test");
    const visible = await getTrading();
    const payload = await visible.json();
    expect(payload.files.how_it_works.sections).toHaveLength(13);
    expect(payload.files.alpha.beta).toBeNull();
  });

  it("renders the how-it-works guide and the alpha scorecard, and hides both when absent", () => {
    const empty = renderToStaticMarkup(createElement(TradingDashboard, { files: {}, lastUpdated: null }));
    expect(empty).not.toContain("How it works");
    expect(empty).not.toContain("Paper account versus buy-and-hold SPY");

    const guide = renderToStaticMarkup(createElement(HowItWorks, { value: howItWorksSample }));
    expect(guide).toContain("How it works");
    expect(guide).toContain("Overview");
    expect(guide).toContain("<strong>long-only swing trading</strong>");
    expect(guide).toContain("<ol");
    expect(guide).toContain("<em>This is a paper-trading experiment, not financial advice.</em>");
    expect(guide).toContain("SWING_ALLOW_LIVE=1");
    expect(guide).toContain("<code");
    expect(guide).not.toMatch(/<script/i);
    expect(guide).not.toMatch(/<img\b/i);

    const hostile = renderToStaticMarkup(
      createElement(SafeMarkdown, {
        source: [
          "Hello <script>alert(1)</script> **bold**",
          "",
          '<img src=x onerror="alert(1)">',
          "",
          '<a href="javascript:alert(1)">click</a>',
          "",
          "[click](javascript:alert(1))",
          "",
          "[site](https://example.com/path)",
          "",
          "![remote](https://evil.test/a.png)",
        ].join("\n"),
      }),
    );
    expect(hostile).not.toMatch(/<script/i);
    expect(hostile).not.toMatch(/<img\b/i);
    expect(hostile).not.toMatch(/<a\b[^>]*javascript:/i);
    expect(hostile).not.toMatch(/href="javascript:/i);
    expect(hostile).toContain("<strong>bold</strong>");
    expect(hostile).toContain('href="https://example.com/path"');
    expect(hostile).toContain('rel="noreferrer noopener"');
    expect(hostile).toContain(">click<");

    const scorecard = renderToStaticMarkup(
      createElement(AlphaScorecard, {
        value: {
          start_date: "2026-01-02",
          start_equity: 5000,
          strategy_return: 0.1,
          spy_return: 0.04,
          strategy_max_drawdown: -0.08,
          spy_max_drawdown: -0.03,
          beta: null,
          alpha: null,
          series: [
            { date: "2026-01-02", strategy_ret: 0.1, spy_ret: 0.04 },
            { date: "2026-01-03", strategy_ret: 0.1, spy_ret: 0 },
          ],
          backtest: { note: "Walk-forward context" },
        },
      }),
    );
    expect(scorecard).toContain("Paper account versus buy-and-hold SPY");
    expect(scorecard).toContain("Since 2026-01-02 from $5,000.00");
    expect(scorecard).toContain("+10.0%");
    expect(scorecard).toContain("+4.0%");
    expect(scorecard).toContain("+6.0%");
    expect(scorecard).toContain("-8.0%");
    expect(scorecard.match(/needs 20 days of data/g)).toHaveLength(2);
    expect(scorecard).toContain("<svg");
    expect(scorecard).toContain("Walk-forward context");
    const compounded = cumulativeIndex(
      [
        { date: "2026-01-02", strategy: 0.1, spy: 0 },
        { date: "2026-01-03", strategy: 0.1, spy: 0 },
      ],
      "strategy",
    );
    expect(compounded.map((point) => point[0])).toEqual(["2026-01-02", "2026-01-03"]);
    expect(compounded[0][1]).toBeCloseTo(110);
    expect(compounded[1][1]).toBeCloseTo(121);

    const measured = renderToStaticMarkup(
      createElement(AlphaScorecard, {
        value: {
          strategy: { equity: 5200, return: 0.04, max_drawdown: -0.08 },
          spy: { value: 5100, return: 0.02, max_drawdown: -0.03 },
          beta: 1.1,
          alpha: null,
        },
      }),
    );
    expect(measured).toContain("+4.0%");
    expect(measured).toContain("$5,200.00");
    expect(measured).toContain("$5,100.00");
    expect(measured).toContain("-8.0%");
    expect(measured).toContain("1.10");
    expect(measured.match(/needs 20 days of data/g)).toHaveLength(1);
    expect(measured).not.toContain("<svg");
  });

  it("reads last updated from status updated_at", () => {
    expect(lastUpdatedSource({ updated_at: "2026-01-15T15:04:00Z", updated: "yesterday" }, "2026-01-16T00:00:00.000Z")).toBe(
      "2026-01-15T15:04:00Z",
    );
    expect(lastUpdatedSource({ updated: "2026-11-02T10:50:21" }, "2026-11-02T15:00:00.000Z")).toBe("2026-11-02T15:00:00.000Z");
    expect(lastUpdatedSource({ updated: "2026-11-02T10:50:21" }, null)).toBe("2026-11-02T10:50:21");
  });
});

function proxyRequest(path: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `authjs.session-token=${token}`);
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}
