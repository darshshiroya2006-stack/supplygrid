import { db } from "./src/index.js";
import { ordersTable } from "./src/schema/orders.js";
import { stockEntriesTable } from "./src/schema/stockEntries.js";
import { and, sql } from "drizzle-orm";

async function main() {
  const queryYear = 2026;
  const startISO = `${queryYear}-01-01`;
  const endISO = `${queryYear}-12-31`;

  const query1 = db
    .select({ total: sql`coalesce(sum(${ordersTable.totalAmount}), 0)::float8` })
    .from(ordersTable)
    .where(and(
      sql`${ordersTable.createdAt}::date >= ${startISO}::date`,
      sql`${ordersTable.createdAt}::date <= ${endISO}::date`
    ));

  console.log("SQL 1:", query1.toSQL());
  const res1 = await query1;
  console.log("Res 1:", res1);

  const query2 = db
    .select({ total: sql`coalesce(sum(${stockEntriesTable.totalPrice}), 0)::float8` })
    .from(stockEntriesTable)
    .where(and(
      sql`${stockEntriesTable.orderId} is null`,
      sql`${stockEntriesTable.createdAt}::date >= ${startISO}::date`,
      sql`${stockEntriesTable.createdAt}::date <= ${endISO}::date`
    ));

  console.log("SQL 2:", query2.toSQL());
  const res2 = await query2;
  console.log("Res 2:", res2);

  process.exit(0);
}

main().catch(console.error);
