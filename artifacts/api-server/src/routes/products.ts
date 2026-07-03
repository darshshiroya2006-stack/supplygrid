import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, productsTable, customerPricingTable, stockEntriesTable, customersTable } from "@workspace/db";
import { CreateProductBody, UpdateProductBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/session";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  // Auto-sync any stock entries that have NULL productId but match a catalog product name
  await db.execute(sql`
    UPDATE stock_entries
    SET product_id = p.id
    FROM products p
    WHERE stock_entries.product_id IS NULL
      AND lower(trim(stock_entries.product_name)) = lower(trim(p.name))
  `);

  let vendorIdFilter: number | null = null;
  if (req.session.role === "wholesaler") {
    vendorIdFilter = req.session.userId!;
  } else if (req.session.role === "retailer" || req.session.role === "customer") {
    if (req.session.userId) {
      const [customer] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, req.session.userId))
        .limit(1);
      if (customer && customer.vendorId) {
        vendorIdFilter = customer.vendorId;
      }
    }
  }

  let stockQuery = db
    .select({
      productId: productsTable.id,
      totalStock: sql<string>`coalesce(sum(case when ${stockEntriesTable.orderId} is null then ${stockEntriesTable.quantityKg} else 0 end), 0) - coalesce(sum(case when ${stockEntriesTable.orderId} is not null then abs(${stockEntriesTable.quantityKg}) else 0 end), 0)`,
    })
    .from(productsTable)
    .leftJoin(
      stockEntriesTable,
      eq(stockEntriesTable.productId, productsTable.id)
    );

  if (vendorIdFilter !== null) {
    stockQuery = stockQuery.where(eq(productsTable.vendorId, vendorIdFilter)) as any;
  }

  const stockRows = await stockQuery.groupBy(productsTable.id);

  const stockMap = new Map<number, number>(
    stockRows.map((r) => [r.productId, Number(r.totalStock || 0)])
  );

  let productsQuery = db.select().from(productsTable);
  if (vendorIdFilter !== null) {
    productsQuery = productsQuery.where(eq(productsTable.vendorId, vendorIdFilter)) as any;
  } else if (req.session.role === "retailer" || req.session.role === "customer") {
    productsQuery = productsQuery.where(sql`false`) as any;
  }

  const products = await productsQuery.orderBy(productsTable.name);
  let priceMap = new Map<number, string>();
  if ((req.session.role === "customer" || req.session.role === "retailer") && req.session.userId) {
    const rows = await db
      .select()
      .from(customerPricingTable)
      .where(eq(customerPricingTable.customerId, req.session.userId));
    priceMap = new Map(rows.map((r) => [r.productId, r.customPrice]));
  }
  res.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      unit: p.unit,
      basePrice: Number(p.basePrice),
      customerPrice: priceMap.has(p.id) ? Number(priceMap.get(p.id)) : null,
      imageUrl: p.imageUrl,
      inStock: (stockMap.get(p.id) ?? 0) > 0,
      availableStock: stockMap.get(p.id) ?? 0,
      createdAt: p.createdAt.toISOString(),
    })),
  );
});

async function getAvailableStock(productId: number): Promise<number> {
  const [row] = await db
    .select({
      totalStock: sql<string>`coalesce(sum(case when ${stockEntriesTable.orderId} is null then ${stockEntriesTable.quantityKg} else 0 end), 0) - coalesce(sum(case when ${stockEntriesTable.orderId} is not null then abs(${stockEntriesTable.quantityKg}) else 0 end), 0)`,
    })
    .from(stockEntriesTable)
    .where(eq(stockEntriesTable.productId, productId));
  return Number(row?.totalStock || 0);
}

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const [created] = await db
    .insert(productsTable)
    .values({
      name: b.name,
      description: b.description ?? null,
      category: b.category ?? null,
      unit: b.unit,
      basePrice: String(b.basePrice),
      imageUrl: b.imageUrl ?? null,
      inStock: b.inStock ?? true,
      vendorId: req.session.role === "wholesaler" ? req.session.userId : null,
    })
    .returning();
  res.status(201).json({
    id: created.id,
    name: created.name,
    description: created.description,
    category: created.category,
    unit: created.unit,
    basePrice: Number(created.basePrice),
    customerPrice: null,
    imageUrl: created.imageUrl,
    inStock: false,
    availableStock: 0,
    createdAt: created.createdAt.toISOString(),
  });
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const updates: Record<string, unknown> = {};
  if (b.name !== undefined) updates.name = b.name;
  if (b.description !== undefined) updates.description = b.description;
  if (b.category !== undefined) updates.category = b.category;
  if (b.unit !== undefined) updates.unit = b.unit;
  if (b.basePrice !== undefined) updates.basePrice = String(b.basePrice);
  if (b.imageUrl !== undefined) updates.imageUrl = b.imageUrl;
  if (b.inStock !== undefined) updates.inStock = b.inStock;

  const conds = [eq(productsTable.id, id)];
  if (req.session.role === "wholesaler") {
    conds.push(eq(productsTable.vendorId, req.session.userId!));
  }

  const [updated] = await db
    .update(productsTable)
    .set(updates)
    .where(and(...conds))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Product not found or not owned by you" });
    return;
  }
  const availableStock = await getAvailableStock(id);
  res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    category: updated.category,
    unit: updated.unit,
    basePrice: Number(updated.basePrice),
    customerPrice: null,
    imageUrl: updated.imageUrl,
    inStock: availableStock > 0,
    availableStock,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }

  const conds = [eq(productsTable.id, id)];
  if (req.session.role === "wholesaler") {
    conds.push(eq(productsTable.vendorId, req.session.userId!));
  }

  const deleted = await db.delete(productsTable).where(and(...conds)).returning();
  if (deleted.length === 0) {
    res.status(404).json({ message: "Product not found or not owned by you" });
    return;
  }
  res.json({ ok: true });
});

export default router;
