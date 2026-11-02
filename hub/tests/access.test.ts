import { describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/access";

const pages = ["/meals", "/notes", "/photos", "/", "/signin"] as const;

describe("decideAccess", () => {
  it("lets a household member open every hub page", () => {
    for (const path of ["/", "/meals", "/notes", "/photos", "/api/planner", "/api/notes", "/api/albums"]) {
      expect(decideAccess("household", path, "GET")).toBe("allow");
    }
    expect(decideAccess("household", "/api/albums", "PUT")).toBe("allow");
  });

  it("limits the photos role to the photos page and album reads", () => {
    expect(decideAccess("photos", "/photos", "GET")).toBe("allow");
    expect(decideAccess("photos", "/api/albums", "GET")).toBe("allow");
    expect(decideAccess("photos", "/", "GET")).toBe("redirect-photos");
    for (const path of ["/meals", "/notes", "/api/planner", "/api/notes"]) {
      expect(decideAccess("photos", path, "GET")).toBe("forbidden");
    }
    expect(decideAccess("photos", "/api/planner", "PUT")).toBe("forbidden");
    expect(decideAccess("photos", "/api/albums", "PUT")).toBe("forbidden");
    expect(decideAccess("photos", "/api/albums", "DELETE")).toBe("forbidden");
  });

  it("asks signed-out visitors to sign in, except on public routes", () => {
    expect(decideAccess(null, "/signin", "GET")).toBe("allow");
    expect(decideAccess(null, "/api/signin", "POST")).toBe("allow");
    expect(decideAccess(null, "/api/auth/callback/nodemailer", "GET")).toBe("allow");
    for (const path of pages.filter((path) => path !== "/signin")) {
      expect(decideAccess(null, path, "GET")).toBe("unauthenticated");
    }
    expect(decideAccess(null, "/api/planner", "GET")).toBe("unauthenticated");
    expect(decideAccess(null, "/api/albums", "GET")).toBe("unauthenticated");
  });

  it("does not treat a removed role as access", () => {
    expect(decideAccess(null, "/photos", "GET")).toBe("unauthenticated");
  });
});
