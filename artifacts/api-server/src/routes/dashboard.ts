import { Router, type IRouter } from "express";
import fs from "fs";
import { desc, eq, gte, lte, sql, and } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  customersTable,
  productsTable,
  inquiriesTable,
  stockEntriesTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/session";

const router: IRouter = Router();

router.get("/summary", requireAdmin, async (req, res) => {
  // Auto-sync any stock entries that have NULL productId but match a catalog product name
  await db.execute(sql`
    UPDATE stock_entries
    SET product_id = p.id
    FROM products p
    WHERE stock_entries.product_id IS NULL
      AND lower(trim(stock_entries.product_name)) = lower(trim(p.name))
  `);

  const now = new Date();
  const queryYear = req.query.year ? Number(req.query.year) : now.getFullYear();
  const queryMonth = req.query.month ? String(req.query.month).trim() : "all";

  let startDate: Date;
  let endDate: Date;

  if (queryMonth === "all") {
    startDate = new Date(queryYear, 0, 1, 0, 0, 0, 0);
    endDate = new Date(queryYear, 11, 31, 23, 59, 59, 999);
  } else {
    const m = Number(queryMonth);
    startDate = new Date(queryYear, m - 1, 1, 0, 0, 0, 0);
    endDate = new Date(queryYear, m, 0, 23, 59, 59, 999);
  }

  const yearlyStart = new Date(queryYear, 0, 1, 0, 0, 0, 0);
  const yearlyEnd = new Date(queryYear, 11, 31, 23, 59, 59, 999);

  console.log("GET /summary - req.query:", req.query);
  console.log("GET /summary - queryYear:", queryYear, "startDate:", startDate, "endDate:", endDate);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const isWholesaler = req.session.role === "wholesaler";
  const vendorId = req.session.userId!;

  // 1. Total Customers
  let customersQuery = db.select({ count: sql<number>`count(*)::int` }).from(customersTable);
  if (isWholesaler) {
    customersQuery = customersQuery.where(eq(customersTable.vendorId, vendorId)) as any;
  }
  const [{ count: totalCustomers }] = await customersQuery;

  // 2. Total Products
  let productsQuery = db.select({ count: sql<number>`count(*)::int` }).from(productsTable);
  if (isWholesaler) {
    productsQuery = productsQuery.where(eq(productsTable.vendorId, vendorId)) as any;
  }
  const [{ count: totalProducts }] = await productsQuery;

  // 3. Low stock products subquery & query
  let subqueryBase = db
    .select({
      productId: productsTable.id,
      totalStock: sql<number>`(coalesce(sum(case when ${stockEntriesTable.orderId} is null then ${stockEntriesTable.quantityKg} else 0 end), 0) - coalesce(sum(case when ${stockEntriesTable.orderId} is not null then abs(${stockEntriesTable.quantityKg}) else 0 end), 0))::float8`.as("total_stock"),
    })
    .from(productsTable)
    .leftJoin(stockEntriesTable, eq(stockEntriesTable.productId, productsTable.id));
  if (isWholesaler) {
    subqueryBase = subqueryBase.where(eq(productsTable.vendorId, vendorId)) as any;
  }
  const stockSubquery = subqueryBase.groupBy(productsTable.id).as("stock_sub");

  let lowStockQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .leftJoin(stockSubquery, eq(productsTable.id, stockSubquery.productId));
  const lowStockConds = [sql`coalesce(${stockSubquery.totalStock}, 0) < 20`];
  if (isWholesaler) {
    lowStockConds.push(eq(productsTable.vendorId, vendorId));
  }
  const [{ count: lowStockProducts }] = await lowStockQuery.where(and(...lowStockConds));

  // 4. Orders
  let ordersQuery = db.select({ count: sql<number>`count(*)::int` }).from(ordersTable);
  const ordersConds = [gte(ordersTable.createdAt, yearlyStart), lte(ordersTable.createdAt, yearlyEnd)];
  if (isWholesaler) {
    ordersConds.push(eq(ordersTable.vendorId, vendorId));
  }
  const [{ count: totalOrders }] = await ordersQuery.where(and(...ordersConds));

  // 5. Total Revenue
  let revenueQuery = db.select({ revenue: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)::float8` }).from(ordersTable);
  if (isWholesaler) {
    revenueQuery = revenueQuery.where(eq(ordersTable.vendorId, vendorId)) as any;
  }
  const [{ revenue: totalRevenue }] = await revenueQuery;

  // 6. Orders & Revenue this month
  let ordersMonthQuery = db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)::float8`,
    })
    .from(ordersTable);
  const ordersMonthConds = [gte(ordersTable.createdAt, monthStart)];
  if (isWholesaler) {
    ordersMonthConds.push(eq(ordersTable.vendorId, vendorId));
  }
  const [{ count: ordersThisMonth, revenue: revenueThisMonth }] = await ordersMonthQuery.where(and(...ordersMonthConds));

  // 7. Inquiries
  const [{ count: pendingInquiries }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inquiriesTable);

  // 8. New Orders Count
  let newOrdersQuery = db.select({ count: sql<number>`count(*)::int` }).from(ordersTable);
  const newOrdersConds = [eq(ordersTable.isPrinted, false)];
  if (isWholesaler) {
    newOrdersConds.push(eq(ordersTable.vendorId, vendorId));
  }
  const [{ count: newOrdersCount }] = await newOrdersQuery.where(and(...newOrdersConds));

  // 9. Yearly total sales
  let yearlySalesQuery = db
    .select({
      total: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)::float8`,
      pending: sql<number>`coalesce(sum(case when ${ordersTable.paymentStatus} != 'fully_paid' then ${ordersTable.totalAmount} else 0 end), 0)::float8`,
    })
    .from(ordersTable);
  const yearlySalesConds = [gte(ordersTable.createdAt, yearlyStart), lte(ordersTable.createdAt, yearlyEnd)];
  if (isWholesaler) {
    yearlySalesConds.push(eq(ordersTable.vendorId, vendorId));
  }
  const [{ total: yearlySalesTotal, pending: yearlySalesPending }] = await yearlySalesQuery.where(and(...yearlySalesConds));

  // 10. Yearly Total Purchases
  let yearlyPurchasesQuery = db
    .select({
      total: sql<number>`coalesce(sum(${stockEntriesTable.totalPrice}), 0)::float8`,
      pending: sql<number>`(coalesce(sum(${stockEntriesTable.totalPrice}), 0) - coalesce(sum(${stockEntriesTable.amountPaidToSupplier}), 0))::float8`,
    })
    .from(stockEntriesTable)
    .leftJoin(productsTable, eq(stockEntriesTable.productId, productsTable.id));
  const yearlyPurchasesConds = [sql`${stockEntriesTable.orderId} is null`, gte(stockEntriesTable.createdAt, yearlyStart), lte(stockEntriesTable.createdAt, yearlyEnd)];
  if (isWholesaler) {
    yearlyPurchasesConds.push(eq(productsTable.vendorId, vendorId));
  }
  const [{ total: yearlyPurchasesTotal, pending: yearlyPurchasesPending }] = await yearlyPurchasesQuery.where(and(...yearlyPurchasesConds));

  console.log("GET /summary - results:", { yearlySalesTotal, yearlySalesPending, yearlyPurchasesTotal, yearlyPurchasesPending, newOrdersCount });

  try {
    const logMsg = `TIME: ${new Date().toISOString()} | req.query: ${JSON.stringify(req.query)} | queryYear: ${queryYear} | startDate: ${startDate.toISOString()} | endDate: ${endDate.toISOString()} | yearlySalesTotal: ${yearlySalesTotal} | yearlyPurchasesTotal: ${yearlyPurchasesTotal}\n`;
    fs.appendFileSync("debug.log", logMsg);
  } catch (err) {
    console.error("Failed to write debug log:", err);
  }

  res.json({
    totalCustomers,
    totalProducts,
    totalOrders,
    totalRevenue: Number(totalRevenue),
    ordersThisMonth,
    revenueThisMonth: Number(revenueThisMonth),
    pendingInquiries,
    lowStockProducts,
    newOrdersCount,
    yearlySalesTotal: Number(yearlySalesTotal),
    yearlySalesPending: Number(yearlySalesPending),
    yearlyPurchasesTotal: Number(yearlyPurchasesTotal),
    yearlyPurchasesPending: Number(yearlyPurchasesPending),
  });
});

router.get("/sales-trend", requireAdmin, async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const conds = [gte(ordersTable.createdAt, since)];
  if (req.session.role === "wholesaler") {
    conds.push(eq(ordersTable.vendorId, req.session.userId!));
  }
  const rows = await db
    .select({
      date: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${ordersTable.totalAmount}), 0)::float8`,
      orders: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .where(and(...conds))
    .groupBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`);
  res.json(rows.map((r) => ({ date: r.date, revenue: Number(r.revenue), orders: r.orders })));
});

router.get("/top-products", requireAdmin, async (req, res) => {
  let query = db
    .select({
      productId: orderItemsTable.productId,
      productName: orderItemsTable.productName,
      quantitySold: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)::float8`,
      revenue: sql<number>`coalesce(sum(${orderItemsTable.lineTotal}), 0)::float8`,
    })
    .from(orderItemsTable)
    .leftJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id));
  if (req.session.role === "wholesaler") {
    query = query.where(eq(ordersTable.vendorId, req.session.userId!)) as any;
  }
  const rows = await query
    .groupBy(orderItemsTable.productId, orderItemsTable.productName)
    .orderBy(sql`coalesce(sum(${orderItemsTable.lineTotal}), 0) desc`)
    .limit(8);
  res.json(
    rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
    })),
  );
});

router.get("/recent-activity", requireAdmin, async (req, res) => {
  let orderQuery = db
    .select({
      id: ordersTable.id,
      total: ordersTable.totalAmount,
      createdAt: ordersTable.createdAt,
      shopName: customersTable.shopName,
    })
    .from(ordersTable)
    .leftJoin(customersTable, eq(customersTable.id, ordersTable.customerId));
  if (req.session.role === "wholesaler") {
    orderQuery = orderQuery.where(eq(ordersTable.vendorId, req.session.userId!)) as any;
  }
  const recentOrders = await orderQuery.orderBy(desc(ordersTable.createdAt)).limit(8);
  const recentInquiries = await db
    .select()
    .from(inquiriesTable)
    .orderBy(desc(inquiriesTable.createdAt))
    .limit(5);

  const items = [
    ...recentOrders.map((o) => ({
      id: `order-${o.id}`,
      type: "order" as const,
      title: `Order #${o.id}`,
      subtitle: o.shopName ?? "Unknown shop",
      amount: Number(o.total),
      createdAt: o.createdAt.toISOString(),
    })),
    ...recentInquiries.map((i) => ({
      id: `inquiry-${i.id}`,
      type: "inquiry" as const,
      title: `Inquiry from ${i.name}`,
      subtitle: i.shopName ?? i.phone,
      amount: null,
      createdAt: i.createdAt.toISOString(),
    })),
  ];
  items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  res.json(items.slice(0, 12));
});

// ── Helper: Compute exact Unix/ISO start/end bounds for a selected month and year ──
function calculateDateBounds(yearStr: string | null, monthStr: string | null) {
  const now = new Date();
  const y = yearStr ? Number(yearStr) : now.getFullYear();
  const mVal = monthStr ? monthStr.trim() : String(now.getMonth() + 1);

  let startISO: string;
  let endISO: string;
  let bucketMode: "day" | "month";

  if (mVal === "all") {
    startISO = `${y}-01-01`;
    endISO = `${y}-12-31`;
    bucketMode = "month";
  } else {
    const m = Number(mVal);
    // Standard JS: 0th day of next month is the last day of current month
    const lastDay = new Date(y, m, 0).getDate();
    startISO = `${y}-${String(m).padStart(2, "0")}-01`;
    endISO = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    bucketMode = "day";
  }

  return { startISO, endISO, bucketMode };
}

/* ═══════════════════════════════════════════════════════════════
   GET /dashboard/analytics

   Calculates absolute dynamic calendar dates. Completely removes
   any hardcoded current month values. The LEFT JOIN in the ledger
   query applies date filters inside the join clause so all products
   are returned even when their monthly volumes are zero.
═══════════════════════════════════════════════════════════════ */
router.get("/analytics", requireAdmin, async (req, res) => {
  try {
    const queryYear = req.query.year ? String(req.query.year).trim() : null;
    const queryMonth = req.query.month ? String(req.query.month).trim() : null;
    const queryDate = req.query.date ? String(req.query.date).trim() : null;
    const range = req.query.range ? String(req.query.range).trim() : (queryYear ? "custom" : "this_month");

    // ── 1. Calculate boundaries dynamically without hardcoding monthly defaults ──
    let startISO: string;
    let endISO: string;
    let bucketMode: "day" | "month";

    if (queryDate && queryDate !== "null" && queryDate !== "undefined" && queryDate.length > 0) {
      startISO = queryDate;
      endISO = queryDate;
      bucketMode = "day";
    } else if (queryYear || queryMonth) {
      const bounds = calculateDateBounds(queryYear, queryMonth);
      startISO = bounds.startISO;
      endISO = bounds.endISO;
      bucketMode = bounds.bucketMode;
    } else {
      // Fallback range-based calculation (fully dynamic based on current time)
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth(); // 0-based

      if (range === "last_month") {
        const lmIdx = m === 0 ? 11 : m - 1;
        const lmYear = m === 0 ? y - 1 : y;
        const lastDay = new Date(lmYear, lmIdx + 1, 0).getDate();
        startISO = `${lmYear}-${String(lmIdx + 1).padStart(2, "0")}-01`;
        endISO = `${lmYear}-${String(lmIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        bucketMode = "day";
      } else if (range === "this_year") {
        startISO = `${y}-01-01`;
        endISO = `${y}-12-31`;
        bucketMode = "month";
      } else {
        // default: this_month
        const lastDay = new Date(y, m + 1, 0).getDate();
        startISO = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        endISO = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        bucketMode = "day";
      }
    }

    // ── 2. Total Sales (Orders) within exact date boundaries ──
    const salesResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(total_amount), 0)::float8 AS total_sales,
        COALESCE(SUM(CASE WHEN payment_status != 'fully_paid' THEN total_amount ELSE 0 END), 0)::float8 AS total_sales_pending
      FROM orders
      WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
        ${req.session.role === 'wholesaler' ? sql`AND vendor_id = ${req.session.userId}` : sql``}
    `);
    const totalSales = Number((salesResult.rows[0] as any).total_sales ?? 0);
    const totalSalesPending = Number((salesResult.rows[0] as any).total_sales_pending ?? 0);

    // ── 3. Total Purchases within exact date boundaries ──
    const purchResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(total_price),  0)::float8 AS total_purchases,
        COALESCE(SUM(quantity_kg),  0)::float8 AS total_purchased_kg,
        (COALESCE(SUM(total_price), 0) - COALESCE(SUM(amount_paid_to_supplier), 0))::float8 AS total_purchase_pending
      FROM stock_entries
      WHERE order_id IS NULL
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
        ${req.session.role === 'wholesaler' ? sql`AND product_id IN (SELECT id FROM products WHERE vendor_id = ${req.session.userId})` : sql``}
    `);
    const totalPurchases   = Number((purchResult.rows[0] as any).total_purchases   ?? 0);
    const totalPurchasedKg = Number((purchResult.rows[0] as any).total_purchased_kg ?? 0);
    const totalPurchasePending = Number((purchResult.rows[0] as any).total_purchase_pending ?? 0);

    const ledgerResult = await db.execute(sql`
      SELECT
        p.id   AS product_id,
        p.name AS product_name,
        COALESCE((
          SELECT SUM(se_open.quantity_kg::float8)
          FROM stock_entries se_open
          LEFT JOIN orders o ON se_open.order_id = o.id
          WHERE se_open.product_id = p.id
            AND (
              CASE 
                WHEN se_open.order_id IS NOT NULL THEN (o.created_at AT TIME ZONE 'Asia/Kolkata')::date
                ELSE (se_open.created_at AT TIME ZONE 'Asia/Kolkata')::date
              END
            ) < ${startISO}::date
        ), 0) AS opening_stock_kg,
        COALESCE((
          SELECT SUM(se_purch.quantity_kg::float8)
          FROM stock_entries se_purch
          WHERE se_purch.product_id = p.id
            AND se_purch.order_id IS NULL
            AND (se_purch.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
            AND (se_purch.created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
        ), 0) AS purchased_kg,
        COALESCE((
          SELECT SUM(ABS(se_sold.quantity_kg::float8))
          FROM stock_entries se_sold
          INNER JOIN orders o ON se_sold.order_id = o.id
          WHERE se_sold.product_id = p.id
            AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
            AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
        ), 0) AS sold_kg
      FROM products p
      WHERE ${req.session.role === 'wholesaler' ? sql`p.vendor_id = ${req.session.userId}` : sql`1=1`}
      ORDER BY p.name ASC
    `);

    type LedgerRow = {
      product_id: number;
      product_name: string;
      opening_stock_kg: number;
      purchased_kg: number;
      sold_kg: number;
    };
    const productStockRows = ledgerResult.rows as unknown as LedgerRow[];

    // Compute closing balance sum dynamically as Opening Stock + Period Purchases - Period Sales
    const closingStockKg = productStockRows.reduce(
      (acc, r) => acc + Math.max(0, Number(r.opening_stock_kg) + Number(r.purchased_kg) - Number(r.sold_kg)),
      0
    );

    // ── 5. Chart data buckets: day or month series ──
    const chartData: { label: string; sales: number; purchases: number }[] = [];

    if (bucketMode === "day") {
      const salesDayResult = await db.execute(sql`
        SELECT
          EXTRACT(DAY FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS day_num,
          COALESCE(SUM(total_amount), 0)::float8 AS sales
        FROM orders
        WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
          ${req.session.role === 'wholesaler' ? sql`AND vendor_id = ${req.session.userId}` : sql``}
        GROUP BY EXTRACT(DAY FROM created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY day_num
      `);

      const purchDayResult = await db.execute(sql`
        SELECT
          EXTRACT(DAY FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS day_num,
          COALESCE(SUM(total_price), 0)::float8 AS purchases
        FROM stock_entries
        WHERE order_id IS NULL
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
          ${req.session.role === 'wholesaler' ? sql`AND product_id IN (SELECT id FROM products WHERE vendor_id = ${req.session.userId})` : sql``}
        GROUP BY EXTRACT(DAY FROM created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY day_num
      `);

      const salesMap = new Map<number, number>();
      for (const r of salesDayResult.rows as any[]) salesMap.set(Number(r.day_num), Number(r.sales));

      const purchMap = new Map<number, number>();
      for (const r of purchDayResult.rows as any[]) purchMap.set(Number(r.day_num), Number(r.purchases));

      const totalDays = new Date(
        Number(endISO.slice(0, 4)),
        Number(endISO.slice(5, 7)),
        0
      ).getDate();

      for (let d = 1; d <= totalDays; d++) {
        chartData.push({ label: `${d}`, sales: salesMap.get(d) ?? 0, purchases: purchMap.get(d) ?? 0 });
      }
    } else {
      const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

      const salesMonthResult = await db.execute(sql`
        SELECT
          EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS month_num,
          COALESCE(SUM(total_amount), 0)::float8 AS sales
        FROM orders
        WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
          ${req.session.role === 'wholesaler' ? sql`AND vendor_id = ${req.session.userId}` : sql``}
        GROUP BY EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY month_num
      `);

      const purchMonthResult = await db.execute(sql`
        SELECT
          EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS month_num,
          COALESCE(SUM(total_price), 0)::float8 AS purchases
        FROM stock_entries
        WHERE order_id IS NULL
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
          ${req.session.role === 'wholesaler' ? sql`AND product_id IN (SELECT id FROM products WHERE vendor_id = ${req.session.userId})` : sql``}
        GROUP BY EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY month_num
      `);

      const salesMap = new Map<number, number>();
      for (const r of salesMonthResult.rows as any[]) salesMap.set(Number(r.month_num), Number(r.sales));

      const purchMap = new Map<number, number>();
      for (const r of purchMonthResult.rows as any[]) purchMap.set(Number(r.month_num), Number(r.purchases));

      for (let mo = 1; mo <= 12; mo++) {
        chartData.push({ label: MONTH_LABELS[mo - 1], sales: salesMap.get(mo) ?? 0, purchases: purchMap.get(mo) ?? 0 });
      }
    }

    // ── 5.5 Fetch individual period orders and purchases for the interactive dashboard lists ──
    const ordersListResult = await db.execute(sql`
      SELECT 
        o.id,
        o.customer_id AS "customerId",
        c.shop_name AS "shopName",
        c.owner_name AS "ownerName",
        o.status,
        o.billing_type AS "billingType",
        o.sequence_number AS "sequenceNumber",
        o.total_amount::float8 AS "totalAmount",
        o.paid_amount::float8 AS "paidAmount",
        o.payment_status AS "paymentStatus",
        o.created_at AS "createdAt"
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
        AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
        ${req.session.role === 'wholesaler' ? sql`AND o.vendor_id = ${req.session.userId}` : sql``}
      ORDER BY o.created_at DESC
    `);
    const periodOrders = ordersListResult.rows;

    const purchasesListResult = await db.execute(sql`
      SELECT
        id,
        date,
        supplier_name AS "supplierName",
        product_name AS "productName",
        quantity_kg::float8 AS "quantityKg",
        total_price::float8 AS "totalPrice",
        amount_paid_to_supplier::float8 AS "amountPaidToSupplier",
        purchase_payment_status AS "purchasePaymentStatus",
        created_at AS "createdAt"
      FROM stock_entries
      WHERE order_id IS NULL
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${startISO}::date
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${endISO}::date
        ${req.session.role === 'wholesaler' ? sql`AND product_id IN (SELECT id FROM products WHERE vendor_id = ${req.session.userId})` : sql``}
      ORDER BY created_at DESC
    `);
    const periodPurchases = purchasesListResult.rows;

    // ── 6. Map rows to product volume ledger format ──
    const productLedger = productStockRows.map((r) => {
      const opening = Number(r.opening_stock_kg);
      const purchased = Number(r.purchased_kg);
      const sold = Number(r.sold_kg);
      const closing = Math.max(0, opening + purchased - sold);
      return {
        productName: r.product_name,
        openingStockKg: opening,
        purchasedKg: purchased,
        soldKg: sold,
        closingKg: closing,
      };
    });

    res.json({
      range,
      startISO,
      endISO,
      totalSales,
      totalSalesPending,
      totalPurchases,
      totalPurchasePending,
      totalPurchasedKg,
      closingStockKg: Number(closingStockKg.toFixed(3)),
      chartData,
      productLedger,
      periodOrders,
      periodPurchases,
    });
  } catch (err: any) {
    console.error("[/dashboard/analytics] FATAL ERROR:", err?.message ?? err);
    res.status(500).json({ error: "Analytics query failed", detail: String(err?.message ?? err) });
  }
});

export default router;
