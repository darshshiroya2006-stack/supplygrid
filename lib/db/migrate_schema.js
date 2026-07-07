import pg from "pg";
const { Pool } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/namkeen_app";
  console.log("Connecting to database:", connectionString.replace(/:[^:@/]+@/, ":****@"));
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log("Adding columns main_unit, sub_unit, conversion_factor to products table if they don't exist...");
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS main_unit text;");
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_unit text;");
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS conversion_factor integer;");
  
  console.log("Columns added successfully!");
  
  // Verify columns exist by selecting from products
  const res = await pool.query("SELECT id, name, main_unit, sub_unit, conversion_factor FROM products LIMIT 1;");
  console.log("Verification select succeeded. Row:", res.rows[0]);
  
  await pool.end();
}

main().catch(console.error);
