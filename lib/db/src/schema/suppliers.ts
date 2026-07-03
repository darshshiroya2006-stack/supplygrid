import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile"),
  mainProducts: text("main_products"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Supplier = typeof suppliersTable.$inferSelect;
