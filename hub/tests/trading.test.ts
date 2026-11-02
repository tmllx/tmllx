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
import { HOUSEHOLD_LINKS, PHOTO_LINKS } from "@/lib/nav";
import { proxy } from "@/proxy";
import { createDevSession } from "@/lib/auth/dev-session";
import { upsertAllowedEmail } from "@/lib/auth/allowlist";
import { listTradingSnapshots } from "@/lib/data/trading";
import { MAX_BODY_BYTES, parseIngestBody, readCappedText } from "@/lib/trading/payload";
import { lastUpdatedSource } from "@/lib/trading/status";
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
