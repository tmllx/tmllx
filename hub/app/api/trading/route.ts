import { enforceApi } from "@/lib/auth/enforce";
import { listTradingSnapshots } from "@/lib/data/trading";
import { lastUpdatedSource } from "@/lib/trading/status";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await enforceApi("/api/trading", "GET");
  if (gate instanceof NextResponse) return gate;
  if (gate.role !== "household") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const snapshot = await listTradingSnapshots();
  return NextResponse.json(
    {
      files: snapshot.files,
      updatedAt: snapshot.updatedAt,
      lastUpdated: lastUpdatedSource(snapshot.files.status, snapshot.updatedAt.status ?? null),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
