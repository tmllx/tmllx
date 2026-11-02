export interface AlbumLink {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
}

const HOSTS = new Set(["www.icloud.com", "icloud.com", "share.icloud.com"]);

export function parseAlbumUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!HOSTS.has(url.hostname)) return null;
  return url.toString();
}

export function cleanAlbumLabel(input: string): string {
  const label = input.trim().replace(/\s+/g, " ").slice(0, 80);
  return label || "Shared album";
}
