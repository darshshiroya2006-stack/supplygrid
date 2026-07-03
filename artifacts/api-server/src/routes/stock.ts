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

router.get("/suppliers", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  res.json(rows.map(toSupplier));
});

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
    })
    .returning();
  res.status(201).json(toSupplier(created));
});

router.get("/suppliers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id)).limit(1);
  if (!s) {
    res.status(404).json({ message: "Supplier not found" });
    return;
  }
  res.json(toSupplier(s));
});

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
  const [updated] = await db
    .update(suppliersTable)
    .set(updates)
    .where(eq(suppliersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Supplier not found" });
    return;
  }
  res.json(toSupplier(updated));
});

router.delete("/suppliers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
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
  // Identify supplier name from ID, then filter entries by name
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id)).limit(1);
  if (!supplier) {
    res.status(404).json({ message: "Supplier not found" });
    return;
  }

  const year = typeof req.query.year === "string" ? req.query.year : undefined;
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const day = typeof req.query.day === "string" ? req.query.day : undefined;

  let query = db.select().from(stockEntriesTable).where(eq(stockEntriesTable.supplierName, supplier.name));

  const isMonthActive = month && month !== "all";
  const isDayActive = day && day !== "all";

  if (year && (isMonthActive || isDayActive)) {
    const { startISO, endISO } = getFilterBounds(year, month, day);
    query = db.select().from(stockEntriesTable).where(
      and(
        eq(stockEntriesTable.supplierName, supplier.name),
        sql`${stockEntriesTable.date} >= ${startISO}::date`,
        sql`${stockEntriesTable.date} <= ${endISO}::date`
      )
    );
  }

  const rows = await query.orderBy(desc(stockEntriesTable.date), desc(stockEntriesTable.id));
  res.json(rows.map(toEntry));
});

// ─── Stock Entries (existing) ─────────────────────────────────────────────

router.get("/", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(stockEntriesTable).orderBy(desc(stockEntriesTable.date), desc(stockEntriesTable.id));
  res.json(rows.map(toEntry));
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateStockEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;

  // Resolve productId from productName case-insensitively
  const [product] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(sql`lower(trim(${productsTable.name}))`, b.productName.trim().toLowerCase()))
    .limit(1);

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
      productId: product ? product.id : null,
    })
    .returning();
  res.status(201).json(toEntry(created));
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateStockEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const updates: Record<string, unknown> = {};
  if (b.date !== undefined) updates.date = b.date;
  if (b.supplierName !== undefined) updates.supplierName = b.supplierName;
  if (b.productName !== undefined) {
    updates.productName = b.productName;
    const [product] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(sql`lower(trim(${productsTable.name}))`, b.productName.trim().toLowerCase()))
      .limit(1);
    updates.productId = product ? product.id : null;
  }
  if (b.quantityKg !== undefined) updates.quantityKg = String(b.quantityKg);
  if (b.totalPrice !== undefined) updates.totalPrice = String(b.totalPrice);
  if (b.notes !== undefined) updates.notes = b.notes;
  const [updated] = await db
    .update(stockEntriesTable)
    .set(updates)
    .where(eq(stockEntriesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  res.json(toEntry(updated));
});

const RecordSupplierPaymentBody = z.object({
  amountPaidToSupplier: z.number().min(0),
});

router.patch("/:id/payment", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = RecordSupplierPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }

  const [existing] = await db.select().from(stockEntriesTable).where(eq(stockEntriesTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ message: "Not found" });
    return;
  }

  const amountPaid = parsed.data.amountPaidToSupplier;
  const totalPrice = Number(existing.totalPrice);
  const purchasePaymentStatus = computePurchasePaymentStatus(amountPaid, totalPrice);

  const [updated] = await db
    .update(stockEntriesTable)
    .set({ amountPaidToSupplier: String(amountPaid), purchasePaymentStatus })
    .where(eq(stockEntriesTable.id, id))
    .returning();

  res.json(toEntry(updated));
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(stockEntriesTable).where(eq(stockEntriesTable.id, id));
  res.json({ ok: true });
});

export default router;
