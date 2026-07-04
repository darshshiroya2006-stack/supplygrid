import { db, productsTable, stockEntriesTable } from "@workspace/db";

async function run() {
  try {
    const products = await db.select().from(productsTable);
    console.log("=== PRODUCTS IN DATABASE ===");
    console.log(products.map(p => ({ id: p.id, name: p.name, vendorId: p.vendorId })));

    const stockEntries = await db.select().from(stockEntriesTable);
    console.log("\n=== STOCK ENTRIES IN DATABASE ===");
    console.log(stockEntries.map(s => ({
      id: s.id,
      productName: s.productName,
      productId: s.productId,
      quantityKg: s.quantityKg,
      orderId: s.orderId
    })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
