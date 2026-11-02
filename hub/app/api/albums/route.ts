import { enforceApi } from "@/lib/auth/enforce";
import { listAlbums, replaceAlbums } from "@/lib/data/albums";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await enforceApi("/api/albums", "GET");
  if (gate instanceof NextResponse) return gate;
  const albums = await listAlbums();
  return NextResponse.json({ albums });
}

export async function PUT(req: Request) {
  const gate = await enforceApi("/api/albums", "PUT");
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json().catch(() => null)) as { albums?: { label?: string; url?: string }[] } | null;
  if (!body || !Array.isArray(body.albums)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const saved = await replaceAlbums(body.albums.map((a) => ({ label: String(a.label || ""), url: String(a.url || "") })));
  if ("error" in saved) return NextResponse.json(saved, { status: 400 });
  return NextResponse.json({ albums: saved });
}
