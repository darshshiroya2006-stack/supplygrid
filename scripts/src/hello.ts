import { db, adminsTable, customersTable, pool } from "@workspace/db";

async function main() {
  console.log("Admins:");
  const admins = await db.select().from(adminsTable);
  console.log(JSON.stringify(admins, null, 2));

  console.log("Customers:");
  const customers = await db.select().from(customersTable);
  console.log(JSON.stringify(customers, null, 2));

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
