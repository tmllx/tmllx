import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { createTransport } from "nodemailer";
import { getDb } from "@/lib/db";
import { accounts, authenticators, sessions, users, verificationTokens } from "@/lib/db/schema";
import { normalizeEmail, roleForEmail } from "@/lib/auth/allowlist";
import { toConfirmUrl } from "@/lib/auth/confirm-link";
import { SESSION_MAX_AGE_SECONDS, authUrlIsHttps, sessionCookieName } from "@/lib/auth/session-cookie";

async function deliverMagicLink(params: { identifier: string; url: string; provider: { from?: string } }) {
  const email = normalizeEmail(params.identifier);
  if (!(await roleForEmail(email))) return;
  const from = params.provider.from || process.env.EMAIL_FROM || "hub@localhost";
  const link = toConfirmUrl(params.url);
  const text = [
    "Sign in to the hub",
    "",
    link,
    "",
    "Open the link and choose Continue to Hub. The link expires soon and works once.",
    "If you did not ask for it, you can ignore this email.",
  ].join("\n");
  if (!process.env.EMAIL_SERVER) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_SERVER is not set");
    }
    console.info(`Sign-in link for ${email}: ${link}`);
    return;
  }
  const transport = createTransport(process.env.EMAIL_SERVER);
  await transport.sendMail({
    to: email,
    from,
    subject: "Your sign-in link",
    text,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const secure = authUrlIsHttps();
  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
      authenticatorsTable: authenticators,
    }),
    session: { strategy: "database", maxAge: SESSION_MAX_AGE_SECONDS },
    useSecureCookies: secure,
    cookies: {
      sessionToken: {
        name: sessionCookieName(),
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure,
          maxAge: SESSION_MAX_AGE_SECONDS,
        },
      },
    },
    trustHost: true,
    pages: { signIn: "/signin", error: "/signin" },
    providers: [
      Nodemailer({
        from: process.env.EMAIL_FROM || "hub@localhost",
        server: process.env.EMAIL_SERVER || "smtp://127.0.0.1:1025",
        maxAge: 15 * 60,
        sendVerificationRequest: deliverMagicLink,
      }),
    ],
    callbacks: {
      async signIn({ user }) {
        const role = await roleForEmail(user.email);
        return role !== null;
      },
      async session({ session, user }) {
        const role = await roleForEmail(user.email);
        session.user.role = role;
        return session;
      },
    },
  };
});
