import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { adminsTable } from "./users";

export const retailerWholesalersTable = pgTable(
  "retailer_wholesalers",
  {
    retailerId: integer("retailer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    wholesalerId: integer("wholesaler_id")
      .notNull()
      .references(() => adminsTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.retailerId, t.wholesalerId] }),
  }),
);

export type RetailerWholesaler = typeof retailerWholesalersTable.$inferSelect;
