import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: "postgresql://postgres@localhost:5432/namkeen_app" });
  
  // Update stock entries where product_name is 'besan' to point to product_id 2 (belonging to vendor 3)
  const updateRes = await pool.query("UPDATE stock_entries SET product_id = 2 WHERE product_name = 'besan';");
  console.log("Updated entries:", updateRes.rowCount);

  const stock = await pool.query("SELECT id, product_name, product_id, quantity_kg FROM stock_entries;");
  console.log("\n=== UPDATED STOCK ENTRIES ===");
  console.log(stock.rows);

  await pool.end();
}

main().catch(console.error);
