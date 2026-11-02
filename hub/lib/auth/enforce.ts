import { forbidden, notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { decideAccess, safeNextPath, type Decision, type Role } from "@/lib/access";
import { getViewer, type Viewer } from "./viewer";

export async function assertPage(pathname: string): Promise<Viewer> {
  const viewer = await getViewer();
  const decision = decideAccess(viewer?.role ?? null, pathname, "GET");
  if (decision === "redirect-photos") redirect("/photos");
  if (decision === "not-found") notFound();
  if (decision === "unauthenticated") {
    const next = safeNextPath(pathname);
    redirect(next === "/" ? "/signin" : "/signin?next=" + encodeURIComponent(next));
  }
  if (decision === "forbidden" || !viewer) forbidden();
  return viewer;
}

export async function enforceApi(pathname: string, method: string): Promise<Viewer | NextResponse> {
  const viewer = await getViewer();
  const decision: Decision = decideAccess(viewer?.role ?? null, pathname, method);
  if (decision === "not-found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (decision === "allow" && viewer) return viewer;
  if (decision === "unauthenticated" || !viewer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export function homeFor(role: Role): string {
  return role === "photos" ? "/photos" : "/";
}
