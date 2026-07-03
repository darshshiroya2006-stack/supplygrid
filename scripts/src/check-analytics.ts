import { pool } from "@workspace/db";

async function main() {
  const startISO = "2026-05-01";
  const endISO = "2026-05-31";
  
  console.log("=== Dates of all orders ===");
  const orders = await pool.query("SELECT id, total_amount, created_at, created_at::date FROM orders");
  console.log(orders.rows);

  console.log("=== Orders matching range ===");
  const ordersInMay = await pool.query(
    "SELECT id, total_amount, created_at, created_at::date FROM orders WHERE created_at::date >= $1::date AND created_at::date <= $2::date",
    [startISO, endISO]
  );
  console.log(ordersInMay.rows);

  console.log("=== stock_entries matching range ===");
  const seInMay = await pool.query(
    "SELECT id, productName, quantityKg, total_price, date, created_at FROM stock_entries WHERE date >= $1::date AND date <= $2::date",
    [startISO, endISO]
  );
  console.log(seInMay.rows);
  
  await pool.end();
}

main();
