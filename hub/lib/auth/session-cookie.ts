export function sessionCookieName(): string {
  const url = process.env.AUTH_URL || "";
  return url.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export function readSessionToken(get: (name: string) => string | undefined): string | null {
  return get("__Secure-authjs.session-token") || get("authjs.session-token") || null;
}

export function devLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_DEV_LOGIN === "true" && env.NODE_ENV !== "production";
}
