import { db, productsTable, pool } from "@workspace/db";

async function main() {
  console.log("Querying products...");
  const rows = await db.select().from(productsTable);
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
