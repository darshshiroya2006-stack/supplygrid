import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: "postgresql://postgres@localhost:5432/namkeen" });
  
  const startISO = "2026-06-29";
  const endISO = "2026-06-29";

  const salesRes = await pool.query(
    "SELECT COALESCE(SUM(total_amount), 0)::float8 AS total FROM orders WHERE created_at::date >= $1::date AND created_at::date <= $2::date;",
    [startISO, endISO]
  );
  console.log("Sales on June 29th:", salesRes.rows[0]);

  const purchRes = await pool.query(
    "SELECT COALESCE(SUM(total_price), 0)::float8 AS total FROM stock_entries WHERE order_id IS NULL AND created_at::date >= $1::date AND created_at::date <= $2::date;",
    [startISO, endISO]
  );
  console.log("Purchases on June 29th:", purchRes.rows[0]);

  await pool.end();
}

main().catch(console.error);
