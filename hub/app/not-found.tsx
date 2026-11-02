export const metadata = { title: "Not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl tracking-tight">Not found</h1>
      <p className="mt-3 text-muted">This page is not available.</p>
    </main>
  );
}
