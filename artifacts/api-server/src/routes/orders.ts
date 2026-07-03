import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
  customersTable,
  customerPricingTable,
  stockEntriesTable,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { requireAdmin, requireAuth, requireCustomer } from "../lib/session";
import { z } from "zod";

const router: IRouter = Router();

function computePaymentStatus(paidAmount: number, totalAmount: number): string {
  if (paidAmount <= 0) return "pending";
  if (paidAmount >= totalAmount) return "fully_paid";
  return "partially_paid";
}

function rangeStart(range: string | undefined): Date | null {
  const now = Date.now();
  switch (range) {
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

async function getNextSequenceNumber(billingType: string): Promise<number> {
  const existingSeqs = await db
    .select({ seq: ordersTable.sequenceNumber })
    .from(ordersTable)
    .where(eq(ordersTable.billingType, billingType))
    .orderBy(ordersTable.sequenceNumber);
  const seqs = existingSeqs.map((o) => o.seq).filter((s): s is number => s !== null);
  let nextSeq = 1;
  for (const seq of seqs) {
    if (seq === nextSeq) {
      nextSeq++;
    } else if (seq > nextSeq) {
      break;
    }
  }
  return nextSeq;
}

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

router.get("/", requireAuth, async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : undefined;
  const since = rangeStart(range);
  const year = typeof req.query.year === "string" ? req.query.year : undefined;
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const day = typeof req.query.day === "string" ? req.query.day : undefined;

  const conds = [] as any[];
  if (req.session.role === "wholesaler") {
    conds.push(eq(ordersTable.vendorId, req.session.userId!));
  } else if (req.session.role === "retailer" || req.session.role === "customer") {
    if (req.session.userId) {
      conds.push(eq(ordersTable.customerId, req.session.userId));
    }
  }
  
  if (year) {
    const { startISO, endISO } = getFilterBounds(year, month, day);
    conds.push(sql`${ordersTable.createdAt}::date >= ${startISO}::date`);
    conds.push(sql`${ordersTable.createdAt}::date <= ${endISO}::date`);
  } else if (since) {
    conds.push(gte(ordersTable.createdAt, since));
  }

  const baseQuery = db
    .select({
      id: ordersTable.id,
      customerId: ordersTable.customerId,
      shopName: customersTable.shopName,
      totalAmount: ordersTable.totalAmount,
      paidAmount: ordersTable.paidAmount,
      paymentStatus: ordersTable.paymentStatus,
      billingType: ordersTable.billingType,
      sequenceNumber: ordersTable.sequenceNumber,
      cgst: ordersTable.cgst,
      sgst: ordersTable.sgst,
      status: ordersTable.status,
      isPrinted: ordersTable.isPrinted,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .leftJoin(customersTable, eq(customersTable.id, ordersTable.customerId));

  const rows = conds.length
    ? await baseQuery.where(and(...conds)).orderBy(desc(ordersTable.createdAt))
    : await baseQuery.orderBy(desc(ordersTable.createdAt));

  const orderIds = rows.map((r) => r.id);
  let counts = new Map<number, number>();
  if (orderIds.length > 0) {
    const items = await db
      .select({ orderId: orderItemsTable.orderId, id: orderItemsTable.id })
      .from(orderItemsTable)
      .where(inArray(orderItemsTable.orderId, orderIds));
    counts = items.reduce((m, it) => {
      m.set(it.orderId, (m.get(it.orderId) ?? 0) + 1);
      return m;
    }, new Map<number, number>());
  }

  res.json(
    rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      shopName: r.shopName ?? "",
      totalAmount: Number(r.totalAmount),
      paidAmount: Number(r.paidAmount),
      paymentStatus: r.paymentStatus,
      billingType: r.billingType,
      sequenceNumber: r.sequenceNumber ?? 0,
      cgst: Number(r.cgst),
      sgst: Number(r.sgst),
      itemCount: counts.get(r.id) ?? 0,
      status: r.status,
      isPrinted: r.isPrinted,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/", requireCustomer, async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const customerId = req.session.userId!;
  const body = parsed.data;
  if (body.items.length === 0) {
    res.status(400).json({ message: "Order must have at least one item" });
    return;
  }
  const productIds = body.items.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const pricing = await db
    .select()
    .from(customerPricingTable)
    .where(
      and(
        eq(customerPricingTable.customerId, customerId),
        inArray(customerPricingTable.productId, productIds),
      ),
    );
  const priceMap = new Map(pricing.map((p) => [p.productId, p.customPrice]));

  let total = 0;
  const lines: Array<{
    productId: number;
    productName: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }> = [];
  for (const item of body.items) {
    const p = productMap.get(item.productId);
    if (!p) {
      res.status(400).json({ message: `Product ${item.productId} not found` });
      return;
    }
    const unitPrice = priceMap.has(p.id) ? Number(priceMap.get(p.id)) : Number(p.basePrice);
    const lineTotal = unitPrice * item.quantity;
    total += lineTotal;
    lines.push({
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      quantity: String(item.quantity),
      unitPrice: String(unitPrice),
      lineTotal: String(lineTotal),
    });
  }

  // Fetch customer alwaysGst preference and connected Wholesaler ID
  const [customer] = await db
    .select({ alwaysGst: customersTable.alwaysGst, vendorId: customersTable.vendorId })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);
  const alwaysGst = customer?.alwaysGst ?? false;
  const vendorId = customer?.vendorId ?? null;
  const billingType = alwaysGst ? "with_gst" : "without_gst";

  let cgstVal = 0;
  let sgstVal = 0;
  let finalTotal = total;
  if (billingType === "with_gst") {
    cgstVal = total * 0.025;
    sgstVal = total * 0.025;
    finalTotal = total + cgstVal + sgstVal;
  }

  // Find minimum available unused ID (gap-filling logic)
  const existingOrders = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .orderBy(ordersTable.id);
  const existingIds = existingOrders.map((o) => o.id);
  let nextId = 1;
  for (const id of existingIds) {
    if (id === nextId) {
      nextId++;
    } else if (id > nextId) {
      break;
    }
  }

  const nextSeq = await getNextSequenceNumber(billingType);

  const [order] = await db
    .insert(ordersTable)
    .values({
      id: nextId,
      customerId,
      status: "unprocessed",
      billingType,
      sequenceNumber: nextSeq,
      cgst: String(cgstVal),
      sgst: String(sgstVal),
      totalAmount: String(finalTotal),
      paidAmount: "0",
      paymentStatus: "pending",
      notes: body.notes ?? null,
      vendorId: vendorId,
    })
    .returning();

  // Sync PostgreSQL serial sequence generator
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('orders', 'id'), coalesce(max(id), 1)) FROM orders;`
  );

  await db.insert(orderItemsTable).values(lines.map((l) => ({ ...l, orderId: order.id })));

  res.status(201).json(await loadFullOrder(order.id));
});

const RecordPaymentBody = z.object({
  paidAmount: z.number().min(0),
});

router.patch("/:id/payment", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ message: "Not found" });
    return;
  }

  const paidAmount = parsed.data.paidAmount;
  const totalAmount = Number(existing.totalAmount);
  const paymentStatus = computePaymentStatus(paidAmount, totalAmount);

  const [updated] = await db
    .update(ordersTable)
    .set({ paidAmount: String(paidAmount), paymentStatus })
    .where(eq(ordersTable.id, id))
    .returning();

  const shopName = await db
    .select({ shopName: customersTable.shopName })
    .from(customersTable)
    .where(eq(customersTable.id, updated.customerId))
    .limit(1);

  const itemCount = await db
    .select({ id: orderItemsTable.id })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id));

  res.json({
    id: updated.id,
    customerId: updated.customerId,
    shopName: shopName[0]?.shopName ?? "",
    totalAmount: Number(updated.totalAmount),
    paidAmount: Number(updated.paidAmount),
    paymentStatus: updated.paymentStatus,
    billingType: updated.billingType,
    sequenceNumber: updated.sequenceNumber ?? 0,
    cgst: Number(updated.cgst),
    sgst: Number(updated.sgst),
    itemCount: itemCount.length,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.patch("/:id/print", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  
  try {
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);

      if (!existing) {
        return null;
      }

      // a) Update targeted order row: Set isPrinted = true and status = 'processed'
      const [updatedOrder] = await tx
        .update(ordersTable)
        .set({ isPrinted: true, status: "processed" })
        .where(eq(ordersTable.id, id))
        .returning();

      // b) Check existing stock entries for this order
      const existingStockEntries = await tx
        .select({ id: stockEntriesTable.id })
        .from(stockEntriesTable)
        .where(eq(stockEntriesTable.orderId, id))
        .limit(1);

      // Deduct inventory if:
      //  - order was not yet processed (normal first-print path), OR
      //  - order is already processed but has no stock entries (recovery path for resequence data loss)
      if (existing.status !== "processed" || existingStockEntries.length === 0) {
        // c) Fetch all line items for this order
        const items = await tx
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, id));

        // d) For each product, execute inventory deduction
        for (const item of items) {
          await tx.insert(stockEntriesTable).values({
            date: new Date().toISOString().split("T")[0],
            supplierName: "CUSTOMER ORDER DEDUCTION",
            productName: item.productName,
            quantityKg: String(-Number(item.quantity)),
            totalPrice: "0",
            amountPaidToSupplier: "0",
            purchasePaymentStatus: "fully_paid",
            notes: `Order #${updatedOrder.sequenceNumber ?? updatedOrder.id} fulfillment`,
            productId: item.productId,
            orderId: id,
          });
        }
      }

      return updatedOrder;
    });

    if (!updated) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    
    res.json({ success: true, isPrinted: updated.isPrinted });
  } catch (error: any) {
    console.error("Failed to process order print/save PDF:", error);
    res.status(500).json({ message: error.message || "Failed to process order print/save PDF" });
  }
});

async function loadFullOrder(id: number) {
  const [row] = await db
    .select({
      order: ordersTable,
      shopName: customersTable.shopName,
      ownerName: customersTable.ownerName,
      phone: customersTable.phone,
    })
    .from(ordersTable)
    .leftJoin(customersTable, eq(customersTable.id, ordersTable.customerId))
    .where(eq(ordersTable.id, id))
    .limit(1);
  if (!row) return null;
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id))
    .orderBy(orderItemsTable.id);
  return {
    id: row.order.id,
    customerId: row.order.customerId,
    customerName: row.ownerName ?? row.shopName ?? "",
    shopName: row.shopName ?? "",
    phone: row.phone ?? "",
    status: row.order.status,
    billingType: row.order.billingType,
    sequenceNumber: row.order.sequenceNumber ?? 0,
    cgst: Number(row.order.cgst),
    sgst: Number(row.order.sgst),
    totalAmount: Number(row.order.totalAmount),
    paidAmount: Number(row.order.paidAmount),
    paymentStatus: row.order.paymentStatus,
    notes: row.order.notes,
    createdAt: row.order.createdAt.toISOString(),
    items: items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      unit: it.unit,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
    })),
  };
}

router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await loadFullOrder(id);
  if (!order) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  if (req.session.role === "customer" && order.customerId !== req.session.userId) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  res.json(order);
});


router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { items } = req.body; // Array of { productId, quantity, unitPrice, productName }

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);
      if (!order) return { status: 404, message: "Order not found" };

      // Delete old items
      await tx.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));

      let subtotal = 0;
      const newItems = [];

      for (const item of items) {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
        subtotal += lineTotal;
        
        // Fetch product unit and name
        const [p] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, item.productId))
          .limit(1);

        newItems.push({
          orderId: id,
          productId: item.productId,
          productName: p ? p.name : item.productName,
          unit: p ? p.unit : "KG",
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          lineTotal: String(lineTotal),
        });
      }

      if (newItems.length > 0) {
        await tx.insert(orderItemsTable).values(newItems);
      }

      let cgstVal = 0;
      let sgstVal = 0;
      let finalTotal = subtotal;
      if (order.billingType === "with_gst") {
        cgstVal = subtotal * 0.025;
        sgstVal = subtotal * 0.025;
        finalTotal = subtotal + cgstVal + sgstVal;
      }

      const paidAmount = Number(order.paidAmount);
      const paymentStatus = computePaymentStatus(paidAmount, finalTotal);

      // If the order has been processed already, adjust stock entries!
      if (order.status === "processed") {
        // Delete previous stock deductions for this order
        await tx.delete(stockEntriesTable).where(eq(stockEntriesTable.orderId, id));

        // Insert updated stock deductions
        for (const item of newItems) {
          await tx.insert(stockEntriesTable).values({
            date: new Date().toISOString().split("T")[0],
            supplierName: "CUSTOMER ORDER DEDUCTION",
            productName: item.productName,
            quantityKg: String(-Number(item.quantity)),
            totalPrice: "0",
            amountPaidToSupplier: "0",
            purchasePaymentStatus: "fully_paid",
            notes: `Order #${order.sequenceNumber ?? order.id} fulfillment (adjusted)`,
            productId: item.productId,
            orderId: id,
          });
        }
      }

      const [updated] = await tx
        .update(ordersTable)
        .set({
          cgst: String(cgstVal),
          sgst: String(sgstVal),
          totalAmount: String(finalTotal),
          paymentStatus,
        })
        .where(eq(ordersTable.id, id))
        .returning();

      return { status: 200, data: updated };
    });

    if (result.status !== 200) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    res.json(await loadFullOrder(id));
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to update order" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.transaction(async (tx) => {
      // 1. Delete the order. Mapped stock entries and items will cascade delete.
      await tx.delete(ordersTable).where(eq(ordersTable.id, id));

      // 2. Re-sequence "without_gst" orders based on their creation dates
      const withoutGstOrders = await tx
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.billingType, "without_gst"))
        .orderBy(ordersTable.createdAt, ordersTable.id);

      for (let i = 0; i < withoutGstOrders.length; i++) {
        await tx
          .update(ordersTable)
          .set({ sequenceNumber: i + 1 })
          .where(eq(ordersTable.id, withoutGstOrders[i].id));
      }

      // 3. Re-sequence "with_gst" orders based on their creation dates
      const withGstOrders = await tx
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.billingType, "with_gst"))
        .orderBy(ordersTable.createdAt, ordersTable.id);

      for (let i = 0; i < withGstOrders.length; i++) {
        await tx
          .update(ordersTable)
          .set({ sequenceNumber: i + 1 })
          .where(eq(ordersTable.id, withGstOrders[i].id));
      }
    });

    res.json({ ok: true });
  } catch (error: any) {
    req.log.error({ err: error }, "Failed to delete order");
    res.status(500).json({ message: "Failed to delete order" });
  }
});



router.patch("/:id/convert-gst", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  const total = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  
  const cgst = total * 0.025;
  const sgst = total * 0.025;
  const newTotal = total + cgst + sgst;
  const paymentStatus = computePaymentStatus(Number(order.paidAmount), newTotal);

  const nextSeq = await getNextSequenceNumber("with_gst");

  const [updated] = await db
    .update(ordersTable)
    .set({
      billingType: "with_gst",
      sequenceNumber: nextSeq,
      cgst: String(cgst),
      sgst: String(sgst),
      totalAmount: String(newTotal),
      paymentStatus,
    })
    .where(eq(ordersTable.id, id))
    .returning();

  res.json({ success: true, message: "Order transferred to GST bills successfully" });
});

export default router;
