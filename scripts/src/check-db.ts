import { db, ordersTable, stockEntriesTable, pool } from "@workspace/db";

async function main() {
  console.log("Querying stock entries...");
  const entries = await db.select().from(stockEntriesTable);
  console.log(JSON.stringify(entries, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
