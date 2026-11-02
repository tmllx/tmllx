export const ROLES = ["household", "photos"] as const;
export type Role = (typeof ROLES)[number];

export type Decision = "allow" | "unauthenticated" | "forbidden" | "redirect-photos" | "not-found";

export function isRole(value: string | null | undefined): value is Role {
  return value === "household" || value === "photos";
}

export function normalizePath(pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0] || "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

function isPublic(path: string): boolean {
  if (path === "/signin" || path === "/forbidden" || path === "/robots.txt" || path === "/favicon.ico") return true;
  if (path.startsWith("/api/auth")) return true;
  if (path === "/api/signin" || path === "/api/dev/login") return true;
  return false;
}

function isTradingSurface(path: string): boolean {
  return path === "/trading" || path.startsWith("/trading/") || path === "/api/trading" || path.startsWith("/api/trading/");
}

/**
 * Server access policy shared by the proxy, pages, and API routes.
 * "photos" may open the photos page and read album links. Everything else
 * in the hub is household only. Trading is hidden from the photos role.
 * POST /api/trading/ingest is not a session route: the handler checks a bearer token.
 */
export function decideAccess(role: Role | null, pathname: string, method = "GET"): Decision {
  const path = normalizePath(pathname);
  const verb = method.toUpperCase();
  if (isPublic(path)) return "allow";
  if (path === "/api/trading/ingest" && verb === "POST") return "allow";
  if (!role) return "unauthenticated";
  if (path === "/") return role === "photos" ? "redirect-photos" : "allow";
  if (path === "/photos" || path.startsWith("/photos/")) return "allow";
  if (path === "/api/albums" && verb === "GET") return "allow";
  if (path === "/api/albums") return role === "household" ? "allow" : "forbidden";
  if (role === "photos" && isTradingSurface(path)) return "not-found";
  if (role === "household") return "allow";
  return "forbidden";
}

const BLOCKED_NEXT = /[\u0000-\u001F\u007F\\]/;
const NEXT_BASE = "https://hub.invalid";

function decodeNext(value: string): string | null {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    if (BLOCKED_NEXT.test(current) || !current.startsWith("/") || current.startsWith("//")) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (decoded === current) return current;
    current = decoded;
  }
  if (BLOCKED_NEXT.test(current) || !current.startsWith("/") || current.startsWith("//")) return null;
  return current;
}

/**
 * Post-login `next` may only be a same-origin relative path.
 * Browsers drop tab and other control characters before they parse a host,
 * so "/\\t//attacker.example" would otherwise become a protocol-relative URL.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return "/";
  const decoded = decodeNext(value);
  if (!decoded) return "/";
  let url: URL;
  try {
    url = new URL(decoded, NEXT_BASE);
  } catch {
    return "/";
  }
  if (url.origin !== NEXT_BASE || url.username || url.password) return "/";
  const path = url.pathname + url.search + url.hash;
  if (!path.startsWith("/") || path.startsWith("//") || BLOCKED_NEXT.test(path)) return "/";
  return path;
}
