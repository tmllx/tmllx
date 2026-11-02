import { Shell } from "@/components/shell";
import { assertPage } from "@/lib/auth/enforce";

export const metadata = { title: "Notes", robots: { index: false, follow: false } };

export default async function NotesPage() {
  const viewer = await assertPage("/notes");
  return (
    <Shell role={viewer.role}>
      <p className="text-sm text-muted">Household</p>
      <h1 className="font-serif text-4xl tracking-tight">Notes to the girls</h1>
      <div className="mt-6 rounded-3xl border border-dashed border-line bg-card p-6">
        <p>A quiet page for household notes. Nothing is saved here yet.</p>
      </div>
    </Shell>
  );
}
