import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, productsTable, customerPricingTable, stockEntriesTable, customersTable } from "@workspace/db";
import { CreateProductBody, UpdateProductBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/session";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  // Auto-sync any stock entries that have NULL productId but match a catalog product name
  // Scoped by vendor so cross-tenant data is never mutated
  await db.execute(sql`
    UPDATE stock_entries
    SET product_id = p.id
    FROM products p
    WHERE stock_entries.product_id IS NULL
      AND lower(trim(stock_entries.product_name)) = lower(trim(p.name))
      AND (stock_entries.vendor_id = p.vendor_id OR (stock_entries.vendor_id IS NULL AND p.vendor_id IS NULL))
  `);

  let vendorIdFilter: number | null = null;
  if (req.session.role === "wholesaler") {
    vendorIdFilter = req.session.userId!;
  } else if (req.session.role === "retailer" || req.session.role === "customer") {
    // Allow retailer to select a specific wholesaler via query param
    const qWholesalerId = Number(req.query.wholesalerId || req.query.wholesaler_id);
    if (qWholesalerId && Number.isInteger(qWholesalerId)) {
      vendorIdFilter = qWholesalerId;
    } else if (req.session.userId) {
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
      inStock: p.availableStock > 0,
      availableStock: p.availableStock,
      createdAt: p.createdAt.toISOString(),
      mainUnit: p.mainUnit,
      subUnit: p.subUnit,
      conversionFactor: p.conversionFactor,
    })),
  );
});

export async function syncProductStock(productId: number, tx: any = db): Promise<number> {
  const [row] = await tx
    .select({
      totalStock: sql<string>`coalesce(sum(case when ${stockEntriesTable.orderId} is null then ${stockEntriesTable.quantityKg}::float8 else 0 end), 0) - coalesce(sum(case when ${stockEntriesTable.orderId} is not null then abs(${stockEntriesTable.quantityKg}::float8) else 0 end), 0)`,
    })
    .from(stockEntriesTable)
    .where(eq(stockEntriesTable.productId, productId));
  const total = Number(row?.totalStock || 0);
  await tx
    .update(productsTable)
    .set({ availableStock: total })
    .where(eq(productsTable.id, productId));
  return total;
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
      mainUnit: b.mainUnit ?? null,
      subUnit: b.subUnit ?? null,
      conversionFactor: b.conversionFactor ?? null,
      availableStock: b.availableStock ?? 0,
    })
    .returning();

  // If there is initial stock, create a stock entry
  if (created.availableStock > 0) {
    await db.insert(stockEntriesTable).values({
      date: new Date().toISOString().split("T")[0],
      supplierName: "Initial Stock",
      productName: created.name,
      quantityKg: String(created.availableStock),
      totalPrice: "0",
      amountPaidToSupplier: "0",
      purchasePaymentStatus: "fully_paid",
      notes: "Initial stock set during product creation",
      productId: created.id,
      vendorId: created.vendorId,
    });
  }

  res.status(201).json({
    id: created.id,
    name: created.name,
    description: created.description,
    category: created.category,
    unit: created.unit,
    basePrice: Number(created.basePrice),
    customerPrice: null,
    imageUrl: created.imageUrl,
    inStock: created.availableStock > 0,
    availableStock: created.availableStock,
    createdAt: created.createdAt.toISOString(),
    mainUnit: created.mainUnit,
    subUnit: created.subUnit,
    conversionFactor: created.conversionFactor,
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
  if (b.mainUnit !== undefined) updates.mainUnit = b.mainUnit;
  if (b.subUnit !== undefined) updates.subUnit = b.subUnit;
  if (b.conversionFactor !== undefined) updates.conversionFactor = b.conversionFactor;
  if (b.availableStock !== undefined) updates.availableStock = b.availableStock;

  const conds = [eq(productsTable.id, id)];
  if (req.session.role === "wholesaler") {
    conds.push(eq(productsTable.vendorId, req.session.userId!));
  }

  // Get existing product to compute stock diff
  const [existing] = await db
    .select()
    .from(productsTable)
    .where(and(...conds))
    .limit(1);

  if (!existing) {
    res.status(404).json({ message: "Product not found or not owned by you" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set(updates)
    .where(and(...conds))
    .returning();

  // If stock was updated, add an adjustment entry
  const nextStock = b.availableStock ?? 0;
  if (b.availableStock !== undefined && nextStock !== existing.availableStock) {
    const diff = nextStock - existing.availableStock;
    await db.insert(stockEntriesTable).values({
      date: new Date().toISOString().split("T")[0],
      supplierName: "Stock Adjustment",
      productName: updated.name,
      quantityKg: String(diff),
      totalPrice: "0",
      amountPaidToSupplier: "0",
      purchasePaymentStatus: "fully_paid",
      notes: "Stock adjustment via Edit Product",
      productId: updated.id,
      vendorId: updated.vendorId,
    });
  }

  res.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    category: updated.category,
    unit: updated.unit,
    basePrice: Number(updated.basePrice),
    customerPrice: null,
    imageUrl: updated.imageUrl,
    inStock: updated.availableStock > 0,
    availableStock: updated.availableStock,
    createdAt: updated.createdAt.toISOString(),
    mainUnit: updated.mainUnit,
    subUnit: updated.subUnit,
    conversionFactor: updated.conversionFactor,
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
