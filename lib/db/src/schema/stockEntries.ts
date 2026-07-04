import { pgTable, serial, text, numeric, date, timestamp, integer } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { ordersTable } from "./orders";
import { adminsTable } from "./users";

export const stockEntriesTable = pgTable("stock_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  supplierName: text("supplier_name").notNull(),
  productName: text("product_name").notNull(),
  quantityKg: numeric("quantity_kg", { precision: 12, scale: 3 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  amountPaidToSupplier: numeric("amount_paid_to_supplier", { precision: 12, scale: 2 }).notNull().default("0"),
  purchasePaymentStatus: text("purchase_payment_status").notNull().default("pending"),
  notes: text("notes"),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id").references(() => adminsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


export type StockEntry = typeof stockEntriesTable.$inferSelect;
