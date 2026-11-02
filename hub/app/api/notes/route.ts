import { enforceApi } from "@/lib/auth/enforce";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await enforceApi("/api/notes", "GET");
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({
    title: "Notes to the girls",
    body: "A quiet page for household notes. Nothing is saved here yet.",
  });
}
