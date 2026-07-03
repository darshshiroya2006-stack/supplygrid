import { pgTable, integer, numeric, primaryKey } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { productsTable } from "./products";

export const customerPricingTable = pgTable(
  "customer_pricing",
  {
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    customPrice: numeric("custom_price", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.customerId, t.productId] }),
  }),
);

export type CustomerPricing = typeof customerPricingTable.$inferSelect;
