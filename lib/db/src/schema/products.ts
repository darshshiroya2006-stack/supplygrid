import { pgTable, serial, text, numeric, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { adminsTable } from "./users";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  unit: text("unit").notNull().default("1 KG"),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  inStock: boolean("in_stock").notNull().default(true),
  vendorId: integer("vendor_id").references(() => adminsTable.id),
  mainUnit: text("main_unit"),
  subUnit: text("sub_unit"),
  conversionFactor: integer("conversion_factor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Product = typeof productsTable.$inferSelect;
