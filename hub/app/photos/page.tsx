import { Shell } from "@/components/shell";
import { assertPage } from "@/lib/auth/enforce";
import { listAlbums } from "@/lib/data/albums";
import Link from "next/link";

export const metadata = { title: "Photos", robots: { index: false, follow: false } };

export default async function PhotosPage() {
  const viewer = await assertPage("/photos");
  const albums = await listAlbums();
  return (
    <Shell role={viewer.role}>
      <h1 className="font-serif text-4xl tracking-tight">Photos</h1>
      <p className="mt-2 text-muted">Shared albums open from the links below. This page does not upload or store pictures.</p>
      {viewer.role === "household" ? (
        <p className="mt-2 text-sm">
          Add or remove links in <Link className="underline" href="/meals">Meals settings</Link>.
        </p>
      ) : null}
      {albums.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-line bg-card p-5">
          <p>No albums yet.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {albums.map((album) => (
            <section key={album.id} className="overflow-hidden rounded-3xl border border-line bg-card">
              <div className="flex items-center justify-between gap-3 p-4">
                <h2 className="font-serif text-2xl">{album.label}</h2>
                <a className="rounded-full bg-pine px-4 py-2 text-sm text-white" href={album.url} target="_blank" rel="noreferrer">
                  Open album
                </a>
              </div>
              <p className="px-4 pb-3 text-sm text-muted">If a preview stays blank, Open album loads it in iCloud.</p>
              <details className="border-t border-line">
                <summary className="cursor-pointer px-4 py-3 text-sm">Preview on this page</summary>
                <iframe title={album.label} src={album.url} className="h-64 w-full bg-paper" referrerPolicy="no-referrer" />
              </details>
            </section>
          ))}
        </div>
      )}
    </Shell>
  );
}
