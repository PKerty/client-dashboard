import { pgTable, pgEnum, serial, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["green", "yellow", "red"]);
export type Status = (typeof statusEnum.enumValues)[number];

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  gmailLabelId: text("gmail_label_id"),
  gmailLabelName: text("gmail_label_name").notNull(),
  domains: text("domains").array().notNull().default([]),
  keywords: text("keywords").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NextStep = { text: string; owner?: string; due?: string };
export type OpenPoint = { text: string; since?: string };
export type Sources = {
  threads: { id: string; subject: string }[];
  meetings: { id: string; title: string; date: string }[];
};

export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  status: statusEnum("status").notNull(),
  summary: text("summary").notNull(),
  nextSteps: jsonb("next_steps").$type<NextStep[]>().notNull().default([]),
  openPoints: jsonb("open_points").$type<OpenPoint[]>().notNull().default([]),
  sources: jsonb("sources").$type<Sources>().notNull().default({ threads: [], meetings: [] }),
  hasChanges: boolean("has_changes").notNull().default(true),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
