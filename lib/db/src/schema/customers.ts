import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { adminsTable } from "./users";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull(),
  ownerName: text("owner_name"),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  alwaysGst: boolean("always_gst").default(false).notNull(),
  role: text("role").default("retailer").notNull(),
  vendorId: integer("vendor_id").references(() => adminsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Customer = typeof customersTable.$inferSelect;
