import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").default("wholesaler").notNull(),
  uniqueVendorId: text("unique_vendor_id").unique(),
  shopName: text("shop_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  gstin: text("gstin"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Admin = typeof adminsTable.$inferSelect;
