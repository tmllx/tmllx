import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { albumLinks } from "@/lib/db/schema";
import { cleanAlbumLabel, parseAlbumUrl, type AlbumLink } from "@/lib/albums";

export async function listAlbums(): Promise<AlbumLink[]> {
  const rows = await getDb().select().from(albumLinks).orderBy(asc(albumLinks.sortOrder), asc(albumLinks.label));
  return rows.map((row) => ({ id: row.id, label: row.label, url: row.url, sortOrder: row.sortOrder }));
}

export async function replaceAlbums(input: { label: string; url: string }[]): Promise<AlbumLink[] | { error: string }> {
  const cleaned: { id: string; label: string; url: string; sortOrder: number }[] = [];
  for (const item of input) {
    const url = parseAlbumUrl(item.url || "");
    if (!url) return { error: "Album links must be https iCloud Shared Album URLs." };
    cleaned.push({
      id: crypto.randomUUID(),
      label: cleanAlbumLabel(item.label || ""),
      url,
      sortOrder: cleaned.length,
    });
  }
  const db = getDb();
  await db.delete(albumLinks);
  if (cleaned.length) await db.insert(albumLinks).values(cleaned);
  return listAlbums();
}
