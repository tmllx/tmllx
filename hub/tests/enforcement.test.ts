import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { auth } from "@/auth";
import { GET as getAlbums, PUT as putAlbums } from "@/app/api/albums/route";
import { POST as devLogin } from "@/app/api/dev/login/route";
import { GET as getNotes } from "@/app/api/notes/route";
import { GET as getPlanner } from "@/app/api/planner/route";
import { upsertAllowedEmail, removeAllowedEmail } from "@/lib/auth/allowlist";
import { resetDb } from "./helpers";

function asSession(email: string | null) {
  vi.mocked(auth).mockResolvedValue(
    (email
      ? { user: { email, id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" }
      : null) as unknown as Awaited<ReturnType<typeof auth>>,
  );
}

describe("server role enforcement", () => {
  beforeEach(async () => {
    await resetDb();
    await upsertAllowedEmail("household@local.test", "household");
    await upsertAllowedEmail("photos@local.test", "photos");
  });

  it("blocks the photos role from household APIs and allows album reads", async () => {
    asSession("photos@local.test");
    expect((await getPlanner()).status).toBe(403);
    expect((await getNotes()).status).toBe(403);
    expect((await putAlbums(new Request("http://local/api/albums", { method: "PUT", body: JSON.stringify({ albums: [] }) }))).status).toBe(403);
    expect((await getAlbums()).status).toBe(200);

    asSession("household@local.test");
    expect((await getPlanner()).status).toBe(200);
    expect((await getNotes()).status).toBe(200);
    const notes = await (await getNotes()).json();
    expect(notes.title).toBe("Notes to the girls");
    const saved = await putAlbums(
      new Request("http://local/api/albums", {
        method: "PUT",
        body: JSON.stringify({ albums: [{ label: "Summer", url: "https://www.icloud.com/sharedalbum/#summer" }] }),
      }),
    );
    expect(saved.status).toBe(200);
    asSession("photos@local.test");
    const albums = await (await getAlbums()).json();
    expect(albums.albums[0].url).toContain("icloud.com");
  });

  it("rejects signed-out and revoked emails even if a session still has the address", async () => {
    asSession(null);
    expect((await getPlanner()).status).toBe(401);
    expect((await getAlbums()).status).toBe(401);
    expect((await getNotes()).status).toBe(401);

    asSession("photos@local.test");
    await removeAllowedEmail("photos@local.test");
    expect((await getAlbums()).status).toBe(401);
  });

  it("refuses dev login for an email that is not invited", async () => {
    const ok = await devLogin(new Request("http://local/api/dev/login", { method: "POST", body: JSON.stringify({ email: "household@local.test" }) }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie") || "").toContain("authjs.session-token");
    const denied = await devLogin(new Request("http://local/api/dev/login", { method: "POST", body: JSON.stringify({ email: "nope@example.com" }) }));
    expect(denied.status).toBe(403);
  });
});
