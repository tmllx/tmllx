import { createDevSession } from "@/lib/auth/dev-session";
import { devLoginEnabled, sessionCookieName } from "@/lib/auth/session-cookie";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!devLoginEnabled()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const session = await createDevSession(String(body.email || ""));
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const secure = (process.env.AUTH_URL || "").startsWith("https://");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(), session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires: session.expires,
  });
  return res;
}
