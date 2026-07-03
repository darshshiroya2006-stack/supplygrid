import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import {
  db,
  customersTable,
  productsTable,
  customerPricingTable,
} from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  SetCustomerPricingBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/session";

const router: IRouter = Router();

function toCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id,
    shopName: c.shopName,
    ownerName: c.ownerName,
    username: c.username,
    phone: c.phone,
    address: c.address,
    city: c.city,
    notes: c.notes,
    alwaysGst: c.alwaysGst,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", requireAdmin, async (req, res) => {
  let query = db.select().from(customersTable);
  if (req.session.role === "wholesaler") {
    query = query.where(eq(customersTable.vendorId, req.session.userId!)) as any;
  }
  const rows = await query.orderBy(customersTable.shopName);
  res.json(rows.map(toCustomer));
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const [created] = await db
    .insert(customersTable)
    .values({
      shopName: b.shopName,
      ownerName: b.ownerName ?? null,
      username: b.username,
      passwordHash: bcrypt.hashSync(b.password, 10),
      phone: b.phone ?? null,
      address: b.address ?? null,
      city: b.city ?? null,
      notes: b.notes ?? null,
      alwaysGst: b.alwaysGst ?? false,
      role: "retailer",
      vendorId: req.session.role === "wholesaler" ? req.session.userId : null,
    })
    .returning();
  res.status(201).json(toCustomer(created));
});

router.get("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const conds = [eq(customersTable.id, id)];
  if (req.session.role === "wholesaler") {
    conds.push(eq(customersTable.vendorId, req.session.userId!));
  }
  const [c] = await db.select().from(customersTable).where(and(...conds)).limit(1);
  if (!c) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  res.json(toCustomer(c));
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const updates: Record<string, unknown> = {};
  if (b.shopName !== undefined) updates.shopName = b.shopName;
  if (b.ownerName !== undefined) updates.ownerName = b.ownerName;
  if (b.username !== undefined) updates.username = b.username;
  if (b.phone !== undefined) updates.phone = b.phone;
  if (b.address !== undefined) updates.address = b.address;
  if (b.city !== undefined) updates.city = b.city;
  if (b.notes !== undefined) updates.notes = b.notes;
  if (b.alwaysGst !== undefined) updates.alwaysGst = b.alwaysGst;
  if (b.password) updates.passwordHash = bcrypt.hashSync(b.password, 10);
  const conds = [eq(customersTable.id, id)];
  if (req.session.role === "wholesaler") {
    conds.push(eq(customersTable.vendorId, req.session.userId!));
  }
  const [updated] = await db
    .update(customersTable)
    .set(updates)
    .where(and(...conds))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  res.json(toCustomer(updated));
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.json({ ok: true });
});

router.get("/:id/pricing", requireAdmin, async (req, res) => {
  const customerId = Number(req.params.id);
  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const pricing = await db
    .select()
    .from(customerPricingTable)
    .where(eq(customerPricingTable.customerId, customerId));
  const priceMap = new Map(pricing.map((p) => [p.productId, p.customPrice]));
  res.json(
    products.map((p) => ({
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      basePrice: Number(p.basePrice),
      customPrice: priceMap.has(p.id) ? Number(priceMap.get(p.id)) : null,
    })),
  );
});

router.put("/:id/pricing", requireAdmin, async (req, res) => {
  const customerId = Number(req.params.id);
  const parsed = SetCustomerPricingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const { productId, customPrice } = parsed.data;
  if (customPrice == null) {
    await db
      .delete(customerPricingTable)
      .where(
        and(
          eq(customerPricingTable.customerId, customerId),
          eq(customerPricingTable.productId, productId),
        ),
      );
  } else {
    const existing = await db
      .select()
      .from(customerPricingTable)
      .where(
        and(
          eq(customerPricingTable.customerId, customerId),
          eq(customerPricingTable.productId, productId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(customerPricingTable)
        .set({ customPrice: String(customPrice) })
        .where(
          and(
            eq(customerPricingTable.customerId, customerId),
            eq(customerPricingTable.productId, productId),
          ),
        );
    } else {
      await db.insert(customerPricingTable).values({
        customerId,
        productId,
        customPrice: String(customPrice),
      });
    }
  }
  res.json({ ok: true });
});

export default router;
