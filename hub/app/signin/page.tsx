import { SignInForm } from "@/components/sign-in-form";
import { safeEmailParam } from "@/lib/auth/confirm-link";
import { homeFor } from "@/lib/auth/enforce";
import { devLoginEnabled } from "@/lib/auth/session-cookie";
import { getViewer } from "@/lib/auth/viewer";
import { safeNextPath } from "@/lib/access";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
}) {
  const viewerPromise = getViewer();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const viewer = await viewerPromise;
  if (viewer) redirect(nextPath === "/" ? homeFor(viewer.role) : nextPath);
  return (
    <SignInForm
      devLogin={devLoginEnabled()}
      nextPath={nextPath}
      error={params.error ?? null}
      initialEmail={safeEmailParam(params.email) ?? ""}
    />
  );
}
