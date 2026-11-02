import { handleMagicLinkRequest, ipFrom } from "@/lib/auth/magic-link";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const result = await handleMagicLinkRequest(String(body.email || ""), ipFrom(req));
  return NextResponse.json(result.body, { status: result.status });
}
