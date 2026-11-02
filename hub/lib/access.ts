export const ROLES = ["household", "photos"] as const;
export type Role = (typeof ROLES)[number];

export type Decision = "allow" | "unauthenticated" | "forbidden" | "redirect-photos";

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

/**
 * Server access policy shared by the proxy, pages, and API routes.
 * "photos" may open the photos page and read album links. Everything else
 * in the hub is household only. Unknown routes stay household only.
 */
export function decideAccess(role: Role | null, pathname: string, method = "GET"): Decision {
  const path = normalizePath(pathname);
  const verb = method.toUpperCase();
  if (isPublic(path)) return "allow";
  if (!role) return "unauthenticated";
  if (path === "/") return role === "photos" ? "redirect-photos" : "allow";
  if (path === "/photos" || path.startsWith("/photos/")) return "allow";
  if (path === "/api/albums" && verb === "GET") return "allow";
  if (path === "/api/albums") return role === "household" ? "allow" : "forbidden";
  if (role === "household") return "allow";
  return "forbidden";
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/";
  return value;
}
