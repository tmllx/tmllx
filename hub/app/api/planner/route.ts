import { enforceApi } from "@/lib/auth/enforce";
import { loadPlanner, savePlanner } from "@/lib/data/planner";
import { isPlannerState } from "@/lib/planner/state";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await enforceApi("/api/planner", "GET");
  if (gate instanceof NextResponse) return gate;
  const record = await loadPlanner();
  return NextResponse.json(record);
}

export async function PUT(req: Request) {
  const gate = await enforceApi("/api/planner", "PUT");
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json().catch(() => null)) as { version?: number; state?: unknown } | null;
  if (!body || typeof body.version !== "number" || !isPlannerState(body.state)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const saved = await savePlanner(body.version, body.state);
  if (saved === "conflict") {
    const current = await loadPlanner();
    return NextResponse.json({ error: "conflict", ...current }, { status: 409 });
  }
  return NextResponse.json(saved);
}
