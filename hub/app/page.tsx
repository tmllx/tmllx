import { Shell } from "@/components/shell";
import { assertPage } from "@/lib/auth/enforce";
import Link from "next/link";

export const metadata = { title: "Home", robots: { index: false, follow: false } };

const CARDS = [
  { href: "/meals", title: "Meals", text: "Plan the week, vote on bowls, and build one shopping list." },
  { href: "/notes", title: "Notes", text: "Notes to the girls." },
  { href: "/photos", title: "Photos", text: "Shared albums." },
];

export default async function HomePage() {
  const viewer = await assertPage("/");
  return (
    <Shell role={viewer.role}>
      <h1 className="font-serif text-4xl tracking-tight">Home</h1>
      <p className="mt-2 text-muted">Signed in as {viewer.email}.</p>
      <div className="mt-6 grid gap-3">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-3xl border border-line bg-card p-5">
            <h2 className="font-serif text-2xl">{card.title}</h2>
            <p className="mt-1 text-muted">{card.text}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
