import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertAllowedEmail } from "@/lib/auth/allowlist";
import { devLoginEnabled } from "@/lib/auth/session-cookie";
import { MAX_ATTEMPTS_PER_EMAIL, prepareMagicLink } from "@/lib/auth/rate-limit";
import { parseAlbumUrl } from "@/lib/albums";
import { resetDb } from "./helpers";

describe("sign-in gate", () => {
  beforeEach(resetDb);
  afterEach(() => {
    process.env.AUTH_DEV_LOGIN = "true";
  });

  it("sends a link only for an invited email and stays quiet otherwise", async () => {
    await upsertAllowedEmail("Household@Local.test", "household");
    expect(await prepareMagicLink("household@local.test", "1.1.1.1")).toBe("send");
    expect(await prepareMagicLink("stranger@example.com", "1.1.1.1")).toBe("silent");
  });

  it("rate limits repeated attempts", async () => {
    await upsertAllowedEmail("household@local.test", "household");
    for (let i = 0; i < MAX_ATTEMPTS_PER_EMAIL; i += 1) {
      expect(await prepareMagicLink("household@local.test", "2.2.2.2")).toBe("send");
    }
    expect(await prepareMagicLink("household@local.test", "2.2.2.2")).toBe("limited");
    expect(await prepareMagicLink("other@example.com", "2.2.2.2")).not.toBe("limited");
  });

  it("turns dev login off in production and rejects non-iCloud albums", () => {
    expect(devLoginEnabled()).toBe(true);
    process.env.AUTH_DEV_LOGIN = "false";
    expect(devLoginEnabled()).toBe(false);
    expect(devLoginEnabled({ AUTH_DEV_LOGIN: "true", NODE_ENV: "production" })).toBe(false);
    process.env.AUTH_DEV_LOGIN = "true";
    expect(parseAlbumUrl("https://www.icloud.com/sharedalbum/#abc")).toContain("icloud.com");
    expect(parseAlbumUrl("https://share.icloud.com/photos/abc")).toContain("share.icloud.com");
    expect(parseAlbumUrl("http://www.icloud.com/sharedalbum/#abc")).toBeNull();
    expect(parseAlbumUrl("https://evil.example/sharedalbum")).toBeNull();
    expect(parseAlbumUrl("javascript:alert(1)")).toBeNull();
  });
});
