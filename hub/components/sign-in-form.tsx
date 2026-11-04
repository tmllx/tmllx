"use client";

import { signInErrorMessage } from "@/lib/auth/confirm-link";
import { useState, type FormEvent } from "react";

export function SignInForm({
  devLogin,
  nextPath,
  error = null,
  initialEmail = "",
}: {
  devLogin: boolean;
  nextPath: string;
  error?: string | null;
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const banner = signInErrorMessage(error);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const res = await fetch("/api/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, next: nextPath }),
    });
    setPending(false);
    if (res.status === 429) {
      setMessage("Too many attempts. Try again later.");
      return;
    }
    setSent(true);
    setMessage("If this address is on the list, a sign-in link is on the way.");
    setEmail("");
  }

  async function dev(address: string) {
    setPending(true);
    const res = await fetch("/api/dev/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: address }),
    });
    setPending(false);
    if (!res.ok) {
      setMessage("Dev sign-in is not available for that address.");
      return;
    }
    window.location.href = nextPath || "/";
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-4xl tracking-tight">Sign in</h1>
      <p className="mt-3 text-muted">Enter the email address you were invited with. There is no public sign-up.</p>
      {banner && !sent ? (
        <p role="alert" className="mt-6 rounded-2xl bg-orange-soft px-4 py-3 text-sm text-ink">
          {banner}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <label className="text-sm text-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-2xl border border-line bg-card px-4 py-3 text-ink outline-none focus:border-pine"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-orange px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Sending..." : error === "Verification" && !sent ? "Email me a new link" : "Email me a link"}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm">{message}</p> : null}
      {devLogin ? (
        <div className="mt-10 border-t border-line pt-6">
          <p className="text-sm text-muted">Local development only.</p>
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" className="rounded-full border border-line bg-card px-4 py-3 text-left" onClick={() => dev("household@local.test")}>
              Continue as household
            </button>
            <button type="button" className="rounded-full border border-line bg-card px-4 py-3 text-left" onClick={() => dev("photos@local.test")}>
              Continue as photos
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
