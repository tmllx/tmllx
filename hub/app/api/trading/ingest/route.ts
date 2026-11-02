import { upsertTradingSnapshots } from "@/lib/data/trading";
import { ingestAuthDecision } from "@/lib/trading/auth";
import { readIngestRequest } from "@/lib/trading/payload";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = ingestAuthDecision(request.headers.get("authorization"), process.env.TRADING_INGEST_TOKEN);
  if (auth === "unconfigured") {
    return NextResponse.json({ error: "unconfigured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (auth !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const body = await readIngestRequest(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status, headers: { "Cache-Control": "no-store" } });
  }
  const updated = await upsertTradingSnapshots(body.entries);
  return NextResponse.json({ updated }, { headers: { "Cache-Control": "no-store" } });
}
