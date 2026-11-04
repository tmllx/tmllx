import { safeNextPath } from "@/lib/access";

export const MAGIC_LINK_CALLBACK_PATH = "/api/auth/callback/nodemailer";
export const CONFIRM_PATH = "/signin/confirm";

const BLOCKED = /[\u0000-\u001F\u007F\\]/;

export interface MagicCallbackTarget {
  /** Relative POST target. Auth.js reads the one-time token from this query string. */
  action: string;
  nextPath: string;
  email: string;
}

/**
 * The address in the email. A prefetch of this page does not reach the Auth.js callback.
 */
export function toConfirmUrl(authCallbackUrl: string): string {
  const callback = new URL(authCallbackUrl);
  const confirm = new URL(CONFIRM_PATH, callback.origin);
  confirm.searchParams.set("url", callback.pathname + callback.search);
  return confirm.toString();
}

export function confirmRedirect(requestUrl: URL): URL {
  const confirm = new URL(CONFIRM_PATH, requestUrl.origin);
  confirm.searchParams.set("url", requestUrl.pathname + requestUrl.search);
  return confirm;
}

export function requestOrigin(headerList: { get(name: string): string | null }): string {
  const host = firstHeader(headerList.get("x-forwarded-host")) || firstHeader(headerList.get("host"));
  const proto = firstHeader(headerList.get("x-forwarded-proto")) || "http";
  if (host && !host.includes("/") && !BLOCKED.test(host)) {
    try {
      return new URL(`${proto}://${host}`).origin;
    } catch {
      // Fall through to AUTH_URL.
    }
  }
  const configured = process.env.AUTH_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to localhost.
    }
  }
  return "http://localhost:3000";
}

/**
 * Accept only a same-origin Nodemailer callback, and rebuild it so `callbackUrl` is a safe path.
 * Returns null for anything else, including an off-site `url`.
 */
export function parseMagicCallback(raw: string | null | undefined, origin: string): MagicCallbackTarget | null {
  if (!raw || raw.length > 4096 || BLOCKED.test(raw)) return null;
  let url: URL;
  try {
    if (raw.startsWith("/")) {
      if (raw.startsWith("//")) return null;
      url = new URL(raw, origin);
    } else {
      url = new URL(raw);
    }
  } catch {
    return null;
  }
  if (url.origin !== origin || url.username || url.password || url.hash) return null;
  if (url.pathname !== MAGIC_LINK_CALLBACK_PATH) return null;
  const token = safeToken(url.searchParams.get("token"));
  const email = safeEmailParam(url.searchParams.get("email"));
  if (!token || !email) return null;
  const nextPath = nextFromCallback(url.searchParams.get("callbackUrl"), origin);
  const action = new URL(MAGIC_LINK_CALLBACK_PATH, origin);
  action.searchParams.set("callbackUrl", nextPath);
  action.searchParams.set("token", token);
  action.searchParams.set("email", email);
  return { action: action.pathname + action.search, nextPath, email };
}

export function nextPathFromInput(value: string | null | undefined, origin?: string): string {
  if (!value || BLOCKED.test(value)) return "/";
  if (value.startsWith("/")) return safeNextPath(value);
  if (!origin) return "/";
  try {
    const url = new URL(value);
    if (url.origin !== origin) return "/";
    return safeNextPath(url.pathname + url.search + url.hash);
  } catch {
    return "/";
  }
}

export function safeEmailParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const email = value.trim();
  if (email.length > 320 || BLOCKED.test(email) || /\s/.test(email)) return null;
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  return email;
}

export function signInErrorMessage(code: string | null | undefined): string | null {
  if (code === "Verification") {
    return "This sign-in link has expired or was already used. Request a new one below. Each link works only once.";
  }
  if (code === "AccessDenied") {
    return "That email address is not on the invite list.";
  }
  if (!code) return null;
  return "Sign-in could not be completed. Request a new link below.";
}

function nextFromCallback(callbackUrl: string | null, origin: string): string {
  return nextPathFromInput(callbackUrl, origin);
}

function safeToken(value: string | null): string | null {
  if (!value || value.length < 16 || value.length > 512) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return value;
}

function firstHeader(value: string | null): string {
  return (value || "").split(",")[0]?.trim() || "";
}
