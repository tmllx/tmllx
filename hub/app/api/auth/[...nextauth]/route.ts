import { handlers } from "@/auth";
import { handleMagicLinkRequest, ipFrom } from "@/lib/auth/magic-link";
import { NextResponse, type NextRequest } from "next/server";

function isEmailSignIn(url: URL): boolean {
  return url.pathname.endsWith("/signin/nodemailer");
}

export async function GET(req: NextRequest) {
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (isEmailSignIn(url)) {
    const form = await req.clone().formData();
    const email = String(form.get("email") || "");
    const result = await handleMagicLinkRequest(email, ipFrom(req));
    return NextResponse.json(result.body, { status: result.status });
  }
  return handlers.POST(req);
}
