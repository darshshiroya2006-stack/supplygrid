import { pool } from "@workspace/db";

async function main() {
  console.log("Running raw SQL update query...");
  const res = await pool.query(`
    UPDATE stock_entries
    SET product_id = p.id
    FROM products p
    WHERE stock_entries.product_id IS NULL
      AND lower(trim(stock_entries.product_name)) = lower(trim(p.name))
  `);
  console.log("Result:", res.rowCount);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
