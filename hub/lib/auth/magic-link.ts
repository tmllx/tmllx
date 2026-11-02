import { signIn } from "@/auth";
import { normalizeEmail } from "./allowlist";
import { clientIp, prepareMagicLink, type MagicLinkGate } from "./rate-limit";

export async function requestMagicLink(emailRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  await signIn("nodemailer", { email, redirect: false, redirectTo: "/" });
}

export async function handleMagicLinkRequest(emailRaw: string, ip: string): Promise<{ status: 200 | 429; body: { ok: true } | { error: string } }> {
  const gate: MagicLinkGate = await prepareMagicLink(emailRaw, ip);
  if (gate === "limited") {
    return { status: 429, body: { error: "Too many attempts. Try again later." } };
  }
  if (gate === "send") await requestMagicLink(emailRaw);
  return { status: 200, body: { ok: true } };
}

export function ipFrom(req: Request): string {
  return clientIp(req.headers.get("x-forwarded-for"));
}
