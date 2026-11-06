/** Database sessions and the browser cookie both last about 90 days. */
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export function authUrlIsHttps(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.AUTH_URL || "").startsWith("https://");
}

export function sessionCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return authUrlIsHttps(env) ? "__Secure-authjs.session-token" : "authjs.session-token";
}

/**
 * Host-only, HttpOnly, SameSite=Lax. Secure when AUTH_URL is https.
 * Lax is included on the top-level navigation back from the mail client.
 */
export function sessionCookieOptions(expires: Date, env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: authUrlIsHttps(env),
    expires,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function readSessionToken(get: (name: string) => string | undefined): string | null {
  return get("__Secure-authjs.session-token") || get("authjs.session-token") || null;
}

export function devLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_DEV_LOGIN === "true" && env.NODE_ENV !== "production";
}
