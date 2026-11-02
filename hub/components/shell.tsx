import Link from "next/link";
import { signOut } from "@/auth";
import type { Role } from "@/lib/access";

const HOUSEHOLD_LINKS = [
  { href: "/", label: "Home" },
  { href: "/meals", label: "Meals" },
  { href: "/notes", label: "Notes" },
  { href: "/photos", label: "Photos" },
];

const PHOTO_LINKS = [{ href: "/photos", label: "Photos" }];

export function Shell({ role, children }: { role: Role; children: React.ReactNode }) {
  const links = role === "household" ? HOUSEHOLD_LINKS : PHOTO_LINKS;
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <Link href={role === "photos" ? "/photos" : "/"} className="font-serif text-2xl tracking-tight text-ink">
              Hub
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <button type="submit" className="rounded-full px-3 py-2 text-sm text-muted hover:bg-card">
                Sign out
              </button>
            </form>
          </div>
          <nav className="mt-1 flex gap-1 overflow-x-auto" aria-label="Hub">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="shrink-0 rounded-full px-3 py-2 text-sm text-ink hover:bg-card">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-16">{children}</main>
    </div>
  );
}
