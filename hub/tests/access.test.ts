import { describe, expect, it } from "vitest";
import { decideAccess, safeNextPath } from "@/lib/access";

const pages = ["/meals", "/notes", "/photos", "/", "/signin"] as const;

describe("decideAccess", () => {
  it("lets a household member open every hub page", () => {
    for (const path of ["/", "/meals", "/notes", "/photos", "/trading", "/game", "/api/planner", "/api/notes", "/api/albums", "/api/trading"]) {
      expect(decideAccess("household", path, "GET")).toBe("allow");
    }
    expect(decideAccess("household", "/api/trading/ingest", "POST")).toBe("allow");
    expect(decideAccess("household", "/api/albums", "PUT")).toBe("allow");
  });

  it("limits the photos role to the photos page and album reads", () => {
    expect(decideAccess("photos", "/photos", "GET")).toBe("allow");
    expect(decideAccess("photos", "/api/albums", "GET")).toBe("allow");
    expect(decideAccess("photos", "/", "GET")).toBe("redirect-photos");
    for (const path of ["/meals", "/notes", "/game", "/api/planner", "/api/notes"]) {
      expect(decideAccess("photos", path, "GET")).toBe("forbidden");
    }
    expect(decideAccess("photos", "/api/planner", "PUT")).toBe("forbidden");
    expect(decideAccess("photos", "/api/albums", "PUT")).toBe("forbidden");
    expect(decideAccess("photos", "/api/albums", "DELETE")).toBe("forbidden");
    expect(decideAccess("photos", "/trading", "GET")).toBe("not-found");
    expect(decideAccess("photos", "/api/trading", "GET")).toBe("not-found");
    expect(decideAccess("photos", "/api/trading/ingest", "GET")).toBe("not-found");
    expect(decideAccess("photos", "/api/trading/ingest", "POST")).toBe("allow");
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
    expect(decideAccess(null, "/trading", "GET")).toBe("unauthenticated");
    expect(decideAccess(null, "/api/trading", "GET")).toBe("unauthenticated");
    expect(decideAccess(null, "/api/trading/ingest", "GET")).toBe("unauthenticated");
    expect(decideAccess(null, "/api/trading/ingest", "POST")).toBe("allow");
    expect(decideAccess(null, "/game", "GET")).toBe("unauthenticated");
    expect(decideAccess(null, "/game?debug=1", "GET")).toBe("unauthenticated");
  });

  it("keeps the game on the household role", () => {
    expect(decideAccess("household", "/game", "GET")).toBe("allow");
    expect(decideAccess("household", "/game?debug=1", "GET")).toBe("allow");
    expect(decideAccess("photos", "/game", "GET")).toBe("forbidden");
    expect(decideAccess("photos", "/game?debug=1", "GET")).toBe("forbidden");
  });

  it("does not treat a removed role as access", () => {
    expect(decideAccess(null, "/photos", "GET")).toBe("unauthenticated");
  });
});

describe("safeNextPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/meals")).toBe("/meals");
    expect(safeNextPath("/photos?album=1")).toBe("/photos?album=1");
    expect(safeNextPath("/notes#top")).toBe("/notes#top");
  });

  it("rejects open redirects, including tab, slash, and backslash tricks", () => {
    const rejected = [
      null,
      "",
      "https://attacker.example",
      "//attacker.example",
      "/\\attacker.example",
      "/\\\\attacker.example",
      "/\t//attacker.example/phish",
      "/%09//attacker.example/phish",
      "/%2509//attacker.example/phish",
      "/%5c%5cattacker.example",
      "/%2f%2fattacker.example",
      "/\n/attacker.example",
      "/meals\r\nLocation: https://attacker.example",
    ];
    for (const value of rejected) {
      expect(safeNextPath(value)).toBe("/");
    }
  });
});
