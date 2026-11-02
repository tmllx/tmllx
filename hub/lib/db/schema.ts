import type { AdapterAccountType } from "next-auth/adapters";
import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, primaryKey, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import type { PlannerState } from "../planner/types";
import type { Role } from "../access";
import type { JsonValue } from "../trading/types";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [primaryKey({ columns: [verificationToken.identifier, verificationToken.token] })],
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [primaryKey({ columns: [authenticator.userId, authenticator.credentialID] })],
);

export const allowedEmails = pgTable("allowed_email", {
  email: text("email").primaryKey(),
  role: text("role").$type<Role>().notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const signInAttempts = pgTable(
  "sign_in_attempt",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("sign_in_attempt_email_idx").on(table.email), index("sign_in_attempt_ip_idx").on(table.ip)],
);

export const plannerState = pgTable("planner_state", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull().default(1),
  state: jsonb("state").$type<PlannerState>().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const albumLinks = pgTable("album_link", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tradingSnapshots = pgTable(
  "trading_snapshots",
  {
    name: text("name").primaryKey(),
    json: jsonb("json").$type<JsonValue>().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "trading_snapshots_name_chk",
      sql`${table.name} in ('positions', 'trades', 'equity_live', 'recommendations', 'status', 'backtest', 'kronos_eval')`,
    ),
  ],
);
