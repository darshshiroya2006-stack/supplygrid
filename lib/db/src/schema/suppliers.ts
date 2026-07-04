import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { adminsTable } from "./users";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile"),
  mainProducts: text("main_products"),
  notes: text("notes"),
  vendorId: integer("vendor_id").references(() => adminsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


export type Supplier = typeof suppliersTable.$inferSelect;
