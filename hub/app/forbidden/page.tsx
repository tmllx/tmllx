import Link from "next/link";

export const metadata = { title: "Unavailable", robots: { index: false, follow: false } };

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="font-serif text-4xl">This page is not available</h1>
      <p className="mt-3 text-muted">Your sign-in can open photos. The rest of the hub stays with the household.</p>
      <p className="mt-6">
        <Link className="text-pine underline" href="/photos">
          Go to photos
        </Link>
      </p>
    </main>
  );
}
