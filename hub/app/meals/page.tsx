import { PlannerApp } from "@/components/planner/planner-app";
import { Shell } from "@/components/shell";
import { listAlbums } from "@/lib/data/albums";
import { loadPlanner } from "@/lib/data/planner";
import { assertPage } from "@/lib/auth/enforce";

export const metadata = { title: "Meals", robots: { index: false, follow: false } };

export default async function MealsPage() {
  const viewer = await assertPage("/meals");
  const [planner, albums] = await Promise.all([loadPlanner(), listAlbums()]);
  return (
    <Shell role={viewer.role}>
      <PlannerApp initial={planner} initialAlbums={albums} />
    </Shell>
  );
}
