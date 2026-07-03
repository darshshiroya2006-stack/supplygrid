import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: "postgresql://postgres@localhost:5432/namkeen" });
  
  const res = await pool.query(
    "SELECT id, created_at, created_at::date, order_id, quantity_kg FROM stock_entries;"
  );
  console.log("Stock Entries:", res.rows);

  await pool.end();
}

main().catch(console.error);
