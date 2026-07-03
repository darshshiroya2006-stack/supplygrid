import { db, stockEntriesTable, pool } from "@workspace/db";

async function main() {
  console.log("Flushing stock entries ledger...");
  const deleted = await db.delete(stockEntriesTable).returning();
  console.log(`Deleted ${deleted.length} stock ledger entries successfully.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("Flush failed:", err);
  await pool.end();
  process.exit(1);
});
