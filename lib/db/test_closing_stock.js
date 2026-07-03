import { db } from "./src/index.js";
import { and, sql } from "drizzle-orm";

async function main() {
  const endISO = "2026-06-30";

  // This is the exact query from our modified route handler
  const ledgerResult = await db.execute(sql`
    SELECT
      p.id   AS product_id,
      p.name AS product_name,
      COALESCE(SUM(CASE WHEN se.order_id IS NULL
                  THEN se.quantity_kg::float8 ELSE 0 END), 0) AS purchased_kg,
      COALESCE(SUM(CASE WHEN se.order_id IS NOT NULL
                  THEN ABS(se.quantity_kg::float8) ELSE 0 END), 0) AS sold_kg
    FROM products p
    LEFT JOIN stock_entries se ON se.product_id = p.id
      AND se.created_at::date <= ${endISO}::date
    GROUP BY p.id, p.name
    ORDER BY p.name ASC
  `);

  const productStockRows = ledgerResult.rows;

  // Compute closing balance sum from the filtered ranges
  const closingStockKg = productStockRows.reduce(
    (acc, r) => acc + Math.max(0, Number(r.purchased_kg) - Number(r.sold_kg)),
    0
  );

  console.log("Calculated Closing Stock (Drizzle):", closingStockKg);
  console.log("Rows:", productStockRows.map(r => `${r.product_name}: Purchased=${r.purchased_kg}, Sold=${r.sold_kg}, Closing=${Math.max(0, Number(r.purchased_kg) - Number(r.sold_kg))}`));

  process.exit(0);
}

main().catch(console.error);
