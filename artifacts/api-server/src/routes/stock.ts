import { Router, type IRouter } from "express";
import { desc, eq, sql, and } from "drizzle-orm";
import { db, stockEntriesTable, suppliersTable, productsTable } from "@workspace/db";
import { CreateStockEntryBody, UpdateStockEntryBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/session";
import { z } from "zod";

const router: IRouter = Router();

function computePurchasePaymentStatus(paid: number, total: number): string {
  if (paid <= 0) return "pending";
  if (paid >= total) return "fully_paid";
  return "partially_paid";
}

function toEntry(r: typeof stockEntriesTable.$inferSelect) {
  return {
    id: r.id,
    date: r.date,
    supplierName: r.supplierName,
    productName: r.productName,
    quantityKg: Number(r.quantityKg),
    totalPrice: Number(r.totalPrice),
    amountPaidToSupplier: Number(r.amountPaidToSupplier),
    purchasePaymentStatus: r.purchasePaymentStatus,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}

function toSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    mobile: s.mobile,
    mainProducts: s.mainProducts,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}

// ─── Supplier CRUD ───────────────────────────────────────────────────────────

const CreateSupplierBody = z.object({
  name: z.string().min(2),
  mobile: z.string().optional().nullable(),
  mainProducts: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdateSupplierBody = z.object({
  name: z.string().min(2).optional(),
  mobile: z.string().optional().nullable(),
  mainProducts: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /stock/suppliers — scoped to logged-in vendor
router.get("/suppliers", requireAdmin, async (req, res) => {
  const vendorId = req.session.userId!;
  const conds = req.session.role === "wholesaler"
    ? [eq(suppliersTable.vendorId, vendorId)]
    : [];

  const rows = conds.length
    ? await db.select().from(suppliersTable).where(and(...conds)).orderBy(suppliersTable.name)
    : await db.select().from(suppliersTable).orderBy(suppliersTable.name);

  res.json(rows.map(toSupplier));
});

// POST /stock/suppliers — stamps vendorId on creation
router.post("/suppliers", requireAdmin, async (req, res) => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const [created] = await db
    .insert(suppliersTable)
    .values({
      name: b.name,
      mobile: b.mobile ?? null,
      mainProducts: b.mainProducts ?? null,
      notes: b.notes ?? null,
      vendorId: req.session.role === "wholesaler" ? req.session.userId : null,
    })
    .returning();
  res.status(201).json(toSupplier(created));
});

// GET /stock/suppliers/:id — vendor-scoped fetch
router.get("/suppliers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const vendorCond =
    req.session.role === "wholesaler"
      ? eq(suppliersTable.vendorId, req.session.userId!)
      : sql`1=1`;

  const [s] = await db
    .select()
    .from(suppliersTable)
    .where(and(eq(suppliersTable.id, id), vendorCond))
    .limit(1);

  if (!s) {
    res.status(404).json({ message: "Supplier not found" });
    return;
  }
  res.json(toSupplier(s));
});

// PATCH /stock/suppliers/:id — vendor-scoped update
router.patch("/suppliers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const updates: Record<string, unknown> = {};
  if (b.name !== undefined) updates.name = b.name;
  if (b.mobile !== undefined) updates.mobile = b.mobile;
  if (b.mainProducts !== undefined) updates.mainProducts = b.mainProducts;
  if (b.notes !== undefined) updates.notes = b.notes;

  const vendorCond =
    req.session.role === "wholesaler"
      ? eq(suppliersTable.vendorId, req.session.userId!)
      : sql`1=1`;

  const [updated] = await db
    .update(suppliersTable)
    .set(updates)
    .where(and(eq(suppliersTable.id, id), vendorCond))
    .returning();

  if (!updated) {
    res.status(404).json({ message: "Supplier not found" });
    return;
  }
  res.json(toSupplier(updated));
});

// DELETE /stock/suppliers/:id — vendor-scoped delete
router.delete("/suppliers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const vendorCond =
    req.session.role === "wholesaler"
      ? eq(suppliersTable.vendorId, req.session.userId!)
      : sql`1=1`;

  await db.delete(suppliersTable).where(and(eq(suppliersTable.id, id), vendorCond));
  res.json({ ok: true });
});

// Helper to calculate exact date boundaries for date filter matching
function getFilterBounds(yearStr?: string, monthStr?: string, dayStr?: string) {
  const now = new Date();
  const y = yearStr ? Number(yearStr) : now.getFullYear();
  const mVal = monthStr ? monthStr.trim() : "all";
  const dVal = dayStr ? dayStr.trim() : "all";

  let startISO: string;
  let endISO: string;

  if (mVal === "all") {
    startISO = `${y}-01-01`;
    endISO = `${y}-12-31`;
  } else {
    const m = Number(mVal);
    if (dVal === "all") {
      const lastDay = new Date(y, m, 0).getDate();
      startISO = `${y}-${String(m).padStart(2, "0")}-01`;
      endISO = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    } else {
      const d = Number(dVal);
      const formattedDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      startISO = formattedDate;
      endISO = formattedDate;
    }
  }
  return { startISO, endISO };
}

// ─── Supplier Ledger: stock entries for a specific supplier ─────────────────

router.get("/suppliers/:id/entries", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const vendorCond =
    req.session.role === "wholesaler"
      ? eq(suppliersTable.vendorId, req.session.userId!)
      : sql`1=1`;

  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(and(eq(suppliersTable.id, id), vendorCond))
    .limit(1);

  if (!supplier) {
    res.status(404).json({ message: "Supplier not found" });
    return;
  }

  const year = typeof req.query.year === "string" ? req.query.year : undefined;
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const day = typeof req.query.day === "string" ? req.query.day : undefined;

  // Vendor-scoped entries for this supplier: match on vendorId directly
  const entryCond = req.session.role === "wholesaler"
    ? and(
        eq(stockEntriesTable.supplierName, supplier.name),
        eq(stockEntriesTable.vendorId, req.session.userId!)
      )
    : eq(stockEntriesTable.supplierName, supplier.name);

  const isMonthActive = month && month !== "all";
  const isDayActive = day && day !== "all";

  let rows;
  if (year && (isMonthActive || isDayActive)) {
    const { startISO, endISO } = getFilterBounds(year, month, day);
    rows = await db
      .select({
        id: stockEntriesTable.id,
        date: stockEntriesTable.date,
        supplierName: stockEntriesTable.supplierName,
        productName: stockEntriesTable.productName,
        quantityKg: stockEntriesTable.quantityKg,
        totalPrice: stockEntriesTable.totalPrice,
        amountPaidToSupplier: stockEntriesTable.amountPaidToSupplier,
        purchasePaymentStatus: stockEntriesTable.purchasePaymentStatus,
        notes: stockEntriesTable.notes,
        createdAt: stockEntriesTable.createdAt,
      })
      .from(stockEntriesTable)
      .where(
        and(
          entryCond,
          sql`${stockEntriesTable.date} >= ${startISO}::date`,
          sql`${stockEntriesTable.date} <= ${endISO}::date`
        )
      )
      .orderBy(desc(stockEntriesTable.date), desc(stockEntriesTable.id));
  } else {
    rows = await db
      .select({
        id: stockEntriesTable.id,
        date: stockEntriesTable.date,
        supplierName: stockEntriesTable.supplierName,
        productName: stockEntriesTable.productName,
        quantityKg: stockEntriesTable.quantityKg,
        totalPrice: stockEntriesTable.totalPrice,
        amountPaidToSupplier: stockEntriesTable.amountPaidToSupplier,
        purchasePaymentStatus: stockEntriesTable.purchasePaymentStatus,
        notes: stockEntriesTable.notes,
        createdAt: stockEntriesTable.createdAt,
      })
      .from(stockEntriesTable)
      .where(entryCond)
      .orderBy(desc(stockEntriesTable.date), desc(stockEntriesTable.id));
  }

  res.json(rows.map(toEntry));
});

// ─── Stock Entries CRUD ──────────────────────────────────────────────────────

// GET /stock/ — vendor-scoped stock entries (purchases only, not order deductions)
router.get("/", requireAdmin, async (req, res) => {
  const vendorCond = req.session.role === "wholesaler"
    ? and(
        sql`${stockEntriesTable.orderId} is null`,
        eq(stockEntriesTable.vendorId, req.session.userId!)
      )
    : sql`${stockEntriesTable.orderId} is null`;

  const rows = await db
    .select({
      id: stockEntriesTable.id,
      date: stockEntriesTable.date,
      supplierName: stockEntriesTable.supplierName,
      productName: stockEntriesTable.productName,
      quantityKg: stockEntriesTable.quantityKg,
      totalPrice: stockEntriesTable.totalPrice,
      amountPaidToSupplier: stockEntriesTable.amountPaidToSupplier,
      purchasePaymentStatus: stockEntriesTable.purchasePaymentStatus,
      notes: stockEntriesTable.notes,
      createdAt: stockEntriesTable.createdAt,
    })
    .from(stockEntriesTable)
    .where(vendorCond)
    .orderBy(desc(stockEntriesTable.date), desc(stockEntriesTable.id));

  res.json(rows.map(toEntry));
});

// POST /stock/ — stamps vendorId on creation
router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateStockEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const vendorId = req.session.role === "wholesaler" ? req.session.userId! : null;

  // Resolve productId from productName scoped to current vendor
  let resolvedProductId: number | null = null;
  if (vendorId) {
    const [product] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(
        and(
          eq(sql`lower(trim(${productsTable.name}))`, b.productName.trim().toLowerCase()),
          eq(productsTable.vendorId, vendorId)
        )
      )
      .limit(1);
    resolvedProductId = product ? product.id : null;
  }

  if (vendorId && !resolvedProductId) {
    const [newProduct] = await db
      .insert(productsTable)
      .values({
        name: b.productName,
        description: "Automatically created via stock entry",
        category: "Snacks",
        unit: b.unit ?? "KG",
        mainUnit: b.mainUnit ?? null,
        subUnit: b.subUnit ?? null,
        conversionFactor: b.conversionFactor ?? null,
        basePrice: "0",
        vendorId,
        availableStock: 0,
      })
      .returning();
    resolvedProductId = newProduct.id;
  }

  const [created] = await db
    .insert(stockEntriesTable)
    .values({
      date: b.date,
      supplierName: b.supplierName,
      productName: b.productName,
      quantityKg: String(b.quantityKg),
      totalPrice: String(b.totalPrice),
      amountPaidToSupplier: "0",
      purchasePaymentStatus: "pending",
      notes: b.notes ?? null,
      productId: resolvedProductId,
      vendorId,
    })
    .returning();
  res.status(201).json(toEntry(created));
});

// PATCH /stock/:id — vendor-scoped update
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateStockEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;

  // Fetch existing entry with vendor context check
  const vendorCond = req.session.role === "wholesaler"
    ? eq(stockEntriesTable.vendorId, req.session.userId!)
    : sql`1=1`;

  const [existing] = await db
    .select({ id: stockEntriesTable.id, productId: stockEntriesTable.productId })
    .from(stockEntriesTable)
    .where(and(eq(stockEntriesTable.id, id), vendorCond))
    .limit(1);

  if (!existing) {
    res.status(404).json({ message: "Not found or access denied" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (b.date !== undefined) updates.date = b.date;
  if (b.supplierName !== undefined) updates.supplierName = b.supplierName;
  if (b.productName !== undefined) {
    updates.productName = b.productName;
    if (req.session.role === "wholesaler") {
      const [product] = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(
          and(
            eq(sql`lower(trim(${productsTable.name}))`, b.productName.trim().toLowerCase()),
            eq(productsTable.vendorId, req.session.userId!)
          )
        )
        .limit(1);
      let pId = product ? product.id : null;
      if (!pId) {
        const [newProduct] = await db
          .insert(productsTable)
          .values({
            name: b.productName,
            description: "Automatically created via stock entry",
            category: "Snacks",
            unit: b.unit ?? "KG",
            mainUnit: b.mainUnit ?? null,
            subUnit: b.subUnit ?? null,
            conversionFactor: b.conversionFactor ?? null,
            basePrice: "0",
            vendorId: req.session.userId!,
            availableStock: 0,
          })
          .returning();
        pId = newProduct.id;
      }
      updates.productId = pId;
    }
  }
  if (b.quantityKg !== undefined) updates.quantityKg = String(b.quantityKg);
  if (b.totalPrice !== undefined) updates.totalPrice = String(b.totalPrice);
  if (b.notes !== undefined) updates.notes = b.notes;

  const [updated] = await db
    .update(stockEntriesTable)
    .set(updates)
    .where(and(eq(stockEntriesTable.id, id), vendorCond))
    .returning();

  res.json(toEntry(updated));
});

const RecordSupplierPaymentBody = z.object({
  amountPaidToSupplier: z.number().min(0),
});

// PATCH /stock/:id/payment — vendor-scoped supplier payment recording
router.patch("/:id/payment", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = RecordSupplierPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }

  const vendorCond = req.session.role === "wholesaler"
    ? eq(stockEntriesTable.vendorId, req.session.userId!)
    : sql`1=1`;

  const [existing] = await db
    .select({ id: stockEntriesTable.id, totalPrice: stockEntriesTable.totalPrice })
    .from(stockEntriesTable)
    .where(and(eq(stockEntriesTable.id, id), vendorCond))
    .limit(1);

  if (!existing) {
    res.status(404).json({ message: "Not found or access denied" });
    return;
  }

  const amountPaid = parsed.data.amountPaidToSupplier;
  const totalPrice = Number(existing.totalPrice);
  const purchasePaymentStatus = computePurchasePaymentStatus(amountPaid, totalPrice);

  const [updated] = await db
    .update(stockEntriesTable)
    .set({ amountPaidToSupplier: String(amountPaid), purchasePaymentStatus })
    .where(and(eq(stockEntriesTable.id, id), vendorCond))
    .returning();

  res.json(toEntry(updated));
});

// DELETE /stock/:id — vendor-scoped delete
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  const vendorCond = req.session.role === "wholesaler"
    ? eq(stockEntriesTable.vendorId, req.session.userId!)
    : sql`1=1`;

  const [existing] = await db
    .select({ id: stockEntriesTable.id })
    .from(stockEntriesTable)
    .where(and(eq(stockEntriesTable.id, id), vendorCond))
    .limit(1);

  if (!existing) {
    res.status(404).json({ message: "Not found or access denied" });
    return;
  }

  await db.delete(stockEntriesTable).where(eq(stockEntriesTable.id, id));
  res.json({ ok: true });
});

export default router;
