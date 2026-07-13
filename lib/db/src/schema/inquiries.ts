import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const inquiriesTable = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shopName: text("shop_name").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull(),
  gstNumber: text("gst_number"),
  email: text("email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Inquiry = typeof inquiriesTable.$inferSelect;
