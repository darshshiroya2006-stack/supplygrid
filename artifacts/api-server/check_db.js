import pg from "pg";
const { Pool } = pg;

async function checkDb(connectionString) {
  console.log("Checking DB:", connectionString);
  const pool = new Pool({ connectionString });
  try {
    const tableInfo = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'admins';"
    );
    if (tableInfo.rows.length === 0) {
      console.log("No admins table found in this database.");
      return false;
    }
    console.log("Admins Table Schema:");
    console.table(tableInfo.rows);

    const rows = await pool.query("SELECT id, username, name, role, unique_vendor_id, shop_name, phone, email FROM admins;");
    console.log("Admins Rows:", JSON.stringify(rows.rows, null, 2));
    return true;
  } catch (err) {
    console.error("Error connecting/querying database:", err);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  const success = await checkDb("postgresql://postgres@localhost:5432/namkeen_app");
  if (!success) {
    await checkDb("postgresql://postgres@localhost:5432/namkeen");
  }
}

main();
