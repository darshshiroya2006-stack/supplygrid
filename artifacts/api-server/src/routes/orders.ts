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
  adminsTable,
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

/**
 * Computes the next per-vendor, per-billingType sequence number using
 * an exclusive row-lock on the wholesaler row to prevent race conditions.
 * Must be called inside a db.transaction() block.
 */
async function getNextVendorSequenceNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  vendorId: number,
  billingType: string
): Promise<number> {
  // Lock the vendor admin row to serialize concurrent order creation for the same vendor
  await tx.execute(
    sql`SELECT id FROM admins WHERE id = ${vendorId} FOR UPDATE`
  );

  const [result] = await tx
    .select({ maxSeq: sql<number>`COALESCE(MAX(${ordersTable.sequenceNumber}), 0)` })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.vendorId, vendorId),
        eq(ordersTable.billingType, billingType)
      )
    );

  return (result?.maxSeq ?? 0) + 1;
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

// ─── GET /orders — list orders scoped to logged-in user ──────────────────────
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
    if (!req.session.userId) {
      res.status(401).json({ message: "Unauthorized: Missing session user ID" });
      return;
    }
    conds.push(eq(ordersTable.customerId, req.session.userId));
    const qWholesalerId = Number(req.query.wholesalerId || req.query.wholesaler_id);
    if (qWholesalerId && Number.isInteger(qWholesalerId)) {
      conds.push(eq(ordersTable.vendorId, qWholesalerId));
    }
  } else if (req.session.role === "admin") {
    // Admin can see all orders
  } else {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  if (year) {
    const { startISO, endISO } = getFilterBounds(year, month, day);
    conds.push(sql`${ordersTable.createdAt}::date >= ${startISO}::date`);
    conds.push(sql`${ordersTable.createdAt}::date <= ${endISO}::date`);
  } else if (since) {
    conds.push(gte(ordersTable.createdAt, since));
  }

  const isCustomer = req.session.role === "customer" || req.session.role === "retailer";
  const seqField = isCustomer
    ? sql<number>`(
        SELECT COUNT(*)::int
        FROM orders o2
        WHERE o2.customer_id = ${ordersTable.customerId}
          AND o2.vendor_id = ${ordersTable.vendorId}
          AND o2.billing_type = ${ordersTable.billingType}
          AND (o2.created_at < ${ordersTable.createdAt} OR (o2.created_at = ${ordersTable.createdAt} AND o2.id <= ${ordersTable.id}))
      )`
    : ordersTable.sequenceNumber;

  const baseQuery = db
    .select({
      id: ordersTable.id,
      customerId: ordersTable.customerId,
      shopName: customersTable.shopName,
      totalAmount: ordersTable.totalAmount,
      paidAmount: ordersTable.paidAmount,
      paymentStatus: ordersTable.paymentStatus,
      billingType: ordersTable.billingType,
      sequenceNumber: seqField,
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

// ─── POST /orders — create a new order ───────────────────────────────────────
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

  try {
    const newOrder = await db.transaction(async (tx) => {
      // Fetch customer and determine vendor context
      const [customer] = await tx
        .select({ alwaysGst: customersTable.alwaysGst, vendorId: customersTable.vendorId })
        .from(customersTable)
        .where(eq(customersTable.id, customerId))
        .limit(1);

      const incomingWholesalerId =
        req.body.wholesaler_id || (body as any).wholesalerId || req.body.wholesalerId;
      const finalWholesalerId =
        incomingWholesalerId != null
          ? Number(incomingWholesalerId)
          : (customer?.vendorId ?? null);

      if (!finalWholesalerId) {
        throw new Error("No wholesaler context found for this order");
      }

      const productIds = body.items.map((i) => i.productId);

      // Verify all products belong to the target wholesaler
      const products = await tx
        .select()
        .from(productsTable)
        .where(
          and(
            inArray(productsTable.id, productIds),
            eq(productsTable.vendorId, finalWholesalerId)
          )
        );

      if (products.length !== productIds.length) {
        throw new Error("One or more products do not belong to the selected wholesaler");
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Fetch custom pricing scoped to this customer + this vendor's products only
      const pricing = await tx
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
          throw new Error(`Product ${item.productId} not found or not owned by this wholesaler`);
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

      const alwaysGst = customer?.alwaysGst ?? false;
      const billingType = alwaysGst ? "with_gst" : "without_gst";

      let cgstVal = 0;
      let sgstVal = 0;
      let finalTotal = total;
      if (billingType === "with_gst") {
        cgstVal = total * 0.025;
        sgstVal = total * 0.025;
        finalTotal = total + cgstVal + sgstVal;
      }

      // Concurrency-safe per-vendor sequential order number using row lock
      const nextSeq = await getNextVendorSequenceNumber(tx, finalWholesalerId, billingType);

      const [order] = await tx
        .insert(ordersTable)
        .values({
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
          vendorId: finalWholesalerId,
        })
        .returning();

      await tx.insert(orderItemsTable).values(lines.map((l) => ({ ...l, orderId: order.id })));

      return order;
    });

    res.status(201).json(await loadFullOrder(newOrder.id, true));
  } catch (error: any) {
    console.error("Failed to create order:", error);
    res.status(500).json({ message: error.message || "Failed to create order" });
  }
});

const RecordPaymentBody = z.object({
  paidAmount: z.number().min(0),
});

// ─── PATCH /orders/:id/payment ───────────────────────────────────────────────
router.patch("/:id/payment", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }

  const vendorCond =
    req.session.role === "wholesaler"
      ? eq(ordersTable.vendorId, req.session.userId!)
      : sql`1=1`;

  const [existing] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), vendorCond))
    .limit(1);

  if (!existing) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const paidAmount = parsed.data.paidAmount;
  const totalAmount = Number(existing.totalAmount);
  const paymentStatus = computePaymentStatus(paidAmount, totalAmount);

  const [updated] = await db
    .update(ordersTable)
    .set({ paidAmount: String(paidAmount), paymentStatus })
    .where(and(eq(ordersTable.id, id), vendorCond))
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

// ─── PATCH /orders/:id/print ─────────────────────────────────────────────────
router.patch("/:id/print", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const updated = await db.transaction(async (tx) => {
      const vendorCond =
        req.session.role === "wholesaler"
          ? eq(ordersTable.vendorId, req.session.userId!)
          : sql`1=1`;

      const [existing] = await tx
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.id, id), vendorCond))
        .limit(1);

      if (!existing) {
        return null;
      }

      const [updatedOrder] = await tx
        .update(ordersTable)
        .set({ isPrinted: true, status: "processed" })
        .where(and(eq(ordersTable.id, id), vendorCond))
        .returning();

      const existingStockEntries = await tx
        .select({ id: stockEntriesTable.id })
        .from(stockEntriesTable)
        .where(eq(stockEntriesTable.orderId, id))
        .limit(1);

      if (existing.status !== "processed" || existingStockEntries.length === 0) {
        const items = await tx
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, id));

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
            vendorId: existing.vendorId,
          });
        }
      }

      return updatedOrder;
    });

    if (!updated) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    res.json({ success: true, isPrinted: updated.isPrinted });
  } catch (error: any) {
    console.error("Failed to process order print/save PDF:", error);
    res.status(500).json({ message: error.message || "Failed to process order print/save PDF" });
  }
});

// ─── loadFullOrder helper ─────────────────────────────────────────────────────
async function loadFullOrder(id: number, isCustomer?: boolean) {
  const seqField = isCustomer
    ? sql<number>`(
        SELECT COUNT(*)::int
        FROM orders o2
        WHERE o2.customer_id = ${ordersTable.customerId}
          AND o2.vendor_id = ${ordersTable.vendorId}
          AND o2.billing_type = ${ordersTable.billingType}
          AND (o2.created_at < ${ordersTable.createdAt} OR (o2.created_at = ${ordersTable.createdAt} AND o2.id <= ${ordersTable.id}))
      )`
    : ordersTable.sequenceNumber;

  const [row] = await db
    .select({
      order: {
        id: ordersTable.id,
        customerId: ordersTable.customerId,
        vendorId: ordersTable.vendorId,
        status: ordersTable.status,
        billingType: ordersTable.billingType,
        sequenceNumber: seqField,
        cgst: ordersTable.cgst,
        sgst: ordersTable.sgst,
        totalAmount: ordersTable.totalAmount,
        paidAmount: ordersTable.paidAmount,
        paymentStatus: ordersTable.paymentStatus,
        notes: ordersTable.notes,
        createdAt: ordersTable.createdAt,
      },
      shopName: customersTable.shopName,
      ownerName: customersTable.ownerName,
      phone: customersTable.phone,
      // Wholesaler (seller) info
      sellerShopName: adminsTable.shopName,
      sellerName: adminsTable.name,
      sellerPhone: adminsTable.phone,
      sellerAddress: adminsTable.address,
      sellerGstin: adminsTable.gstin,
    })
    .from(ordersTable)
    .leftJoin(customersTable, eq(customersTable.id, ordersTable.customerId))
    .leftJoin(adminsTable, eq(adminsTable.id, ordersTable.vendorId))
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
    vendorId: row.order.vendorId,
    customerName: row.ownerName ?? row.shopName ?? "",
    shopName: row.shopName ?? "",
    phone: row.phone ?? "",
    // Wholesaler (seller) details for invoice header
    sellerShopName: row.sellerShopName ?? "",
    sellerName: row.sellerName ?? "",
    sellerPhone: row.sellerPhone ?? "",
    sellerAddress: row.sellerAddress ?? "",
    sellerGstin: row.sellerGstin ?? "",
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

// ─── GET /orders/:id — get single order, vendor-scoped ───────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);

  // For wholesalers, verify ownership before loading full details
  if (req.session.role === "wholesaler") {
    const [orderRow] = await db
      .select({ vendorId: ordersTable.vendorId })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.vendorId, req.session.userId!)))
      .limit(1);
    if (!orderRow) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
  }

  const isCustomer = req.session.role === "customer" || req.session.role === "retailer";
  const order = await loadFullOrder(id, isCustomer);
  if (!order) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  // Customers/retailers can only see their own orders
  if (
    (req.session.role === "customer" || req.session.role === "retailer") &&
    order.customerId !== req.session.userId
  ) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  res.json(order);
});

// ─── PATCH /orders/:id — edit order items, vendor-scoped ─────────────────────
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { items } = req.body;

  try {
    const result = await db.transaction(async (tx) => {
      const vendorCond =
        req.session.role === "wholesaler"
          ? eq(ordersTable.vendorId, req.session.userId!)
          : sql`1=1`;

      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.id, id), vendorCond))
        .limit(1);
      if (!order) return { status: 404, message: "Order not found" };

      await tx.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));

      let subtotal = 0;
      const newItems = [];

      for (const item of items) {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
        subtotal += lineTotal;

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

      if (order.status === "processed") {
        await tx.delete(stockEntriesTable).where(eq(stockEntriesTable.orderId, id));

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
            vendorId: order.vendorId,
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
        .where(and(eq(ordersTable.id, id), vendorCond))
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

// ─── DELETE /orders/:id — vendor-scoped delete + per-vendor re-sequence ──────
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.transaction(async (tx) => {
      const vendorCond =
        req.session.role === "wholesaler"
          ? eq(ordersTable.vendorId, req.session.userId!)
          : sql`1=1`;

      // Fetch the order to get vendorId before deleting
      const [orderToDelete] = await tx
        .select({ id: ordersTable.id, vendorId: ordersTable.vendorId })
        .from(ordersTable)
        .where(and(eq(ordersTable.id, id), vendorCond))
        .limit(1);

      if (!orderToDelete) {
        throw new Error("Order not found or access denied");
      }

      const affectedVendorId = orderToDelete.vendorId;

      // Delete the order (stock entries and items cascade delete)
      await tx.delete(ordersTable).where(eq(ordersTable.id, id));

      if (affectedVendorId) {
        // Re-sequence ONLY this vendor's orders per billing type — isolated from other vendors
        for (const billingType of ["without_gst", "with_gst"]) {
          const vendorOrders = await tx
            .select({ id: ordersTable.id })
            .from(ordersTable)
            .where(
              and(
                eq(ordersTable.vendorId, affectedVendorId),
                eq(ordersTable.billingType, billingType)
              )
            )
            .orderBy(ordersTable.createdAt, ordersTable.id);

          for (let i = 0; i < vendorOrders.length; i++) {
            await tx
              .update(ordersTable)
              .set({ sequenceNumber: i + 1 })
              .where(eq(ordersTable.id, vendorOrders[i].id));
          }
        }
      }
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to delete order:", error);
    res.status(500).json({ message: error.message || "Failed to delete order" });
  }
});

// ─── PATCH /orders/:id/convert-gst — vendor-scoped GST conversion ────────────
router.patch("/:id/convert-gst", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  const vendorCond =
    req.session.role === "wholesaler"
      ? eq(ordersTable.vendorId, req.session.userId!)
      : sql`1=1`;

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.id, id), vendorCond))
        .limit(1);

      if (!order) {
        return { status: 404, message: "Order not found" };
      }

      if (!order.vendorId) {
        return { status: 400, message: "Order has no vendor context" };
      }

      const items = await tx
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, id));
      const total = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);

      const cgst = total * 0.025;
      const sgst = total * 0.025;
      const newTotal = total + cgst + sgst;
      const paymentStatus = computePaymentStatus(Number(order.paidAmount), newTotal);

      // Concurrency-safe next GST sequence number for this vendor only
      const nextSeq = await getNextVendorSequenceNumber(tx, order.vendorId, "with_gst");

      await tx
        .update(ordersTable)
        .set({
          billingType: "with_gst",
          sequenceNumber: nextSeq,
          cgst: String(cgst),
          sgst: String(sgst),
          totalAmount: String(newTotal),
          paymentStatus,
        })
        .where(and(eq(ordersTable.id, id), vendorCond));

      return { status: 200 };
    });

    if (result.status !== 200) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    res.json({ success: true, message: "Order transferred to GST bills successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to convert order to GST" });
  }
});

export default router;
