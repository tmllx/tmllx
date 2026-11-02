import { Shell } from "@/components/shell";
import { TradingDashboard } from "@/components/trading/dashboard";
import { assertPage } from "@/lib/auth/enforce";
import { listTradingSnapshots } from "@/lib/data/trading";
import { lastUpdatedSource } from "@/lib/trading/status";
import { notFound } from "next/navigation";

export const metadata = { title: "Trading", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TradingPage() {
  const viewer = await assertPage("/trading");
  if (viewer.role !== "household") notFound();
  const snapshot = await listTradingSnapshots();
  return (
    <Shell role={viewer.role} wide>
      <TradingDashboard
        files={snapshot.files}
        lastUpdated={lastUpdatedSource(snapshot.files.status, snapshot.updatedAt.status ?? null)}
      />
    </Shell>
  );
}
