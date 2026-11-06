import { ContinueToHub } from "@/components/continue-to-hub";
import { SignInForm } from "@/components/sign-in-form";
import { homeFor } from "@/lib/auth/enforce";
import { parseMagicCallback, requestOrigin } from "@/lib/auth/confirm-link";
import { devLoginEnabled } from "@/lib/auth/session-cookie";
import { getViewer } from "@/lib/auth/viewer";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const [params, headerList] = await Promise.all([searchParams, headers()]);
  const target = parseMagicCallback(params.url, requestOrigin(headerList));
  return { title: target ? "Continue to Hub" : "Sign in", robots: { index: false, follow: false } };
}

export default async function ConfirmSignInPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const viewerPromise = getViewer();
  const [params, headerList] = await Promise.all([searchParams, headers()]);
  const target = parseMagicCallback(params.url, requestOrigin(headerList));
  const nextPath = target?.nextPath ?? "/";
  const viewer = await viewerPromise;
  if (viewer) redirect(nextPath === "/" ? homeFor(viewer.role) : nextPath);

  if (!target) {
    return <SignInForm devLogin={devLoginEnabled()} nextPath="/" error="Verification" initialEmail="" />;
  }

  const resend = nextPath === "/" ? "/signin" : `/signin?next=${encodeURIComponent(nextPath)}`;
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-4xl tracking-tight">Continue to Hub</h1>
      <p className="mt-3 text-muted">This link is ready. Continue to finish signing in. Opening it does not use it up.</p>
      <ContinueToHub action={target.action} />
      <p className="mt-6 text-sm text-muted">
        If this link has expired or was already used, <a className="text-pine underline" href={resend}>request a new one</a>.
      </p>
    </div>
  );
}
