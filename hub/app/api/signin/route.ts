import { safeNextPath } from "@/lib/access";
import { handleMagicLinkRequest, ipFrom } from "@/lib/auth/magic-link";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; next?: unknown };
  const nextPath = safeNextPath(typeof body.next === "string" ? body.next : "/");
  const result = await handleMagicLinkRequest(String(body.email || ""), ipFrom(req), nextPath);
  return NextResponse.json(result.body, { status: result.status });
}
