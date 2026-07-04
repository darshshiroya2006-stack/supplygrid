import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and, or } from "drizzle-orm";
import {
  db,
  customersTable,
  productsTable,
  customerPricingTable,
  retailerWholesalersTable,
} from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  SetCustomerPricingBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/session";

const router: IRouter = Router();

function toCustomer(c: any) {
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
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : new Date(c.createdAt).toISOString(),
  };
}

async function checkWholesalerLink(customerId: number, wholesalerId: number): Promise<boolean> {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);
  if (!customer) return false;
  if (customer.vendorId === wholesalerId) return true;

  const [hasLink] = await db
    .select()
    .from(retailerWholesalersTable)
    .where(
      and(
        eq(retailerWholesalersTable.retailerId, customerId),
        eq(retailerWholesalersTable.wholesalerId, wholesalerId)
      )
    )
    .limit(1);
  return !!hasLink;
}


router.get("/", requireAdmin, async (req, res) => {
  let rows;
  if (req.session.role === "wholesaler") {
    const wholesalerId = req.session.userId!;
    rows = await db
      .select({
        id: customersTable.id,
        shopName: customersTable.shopName,
        ownerName: customersTable.ownerName,
        username: customersTable.username,
        phone: customersTable.phone,
        address: customersTable.address,
        city: customersTable.city,
        notes: customersTable.notes,
        alwaysGst: customersTable.alwaysGst,
        createdAt: customersTable.createdAt,
      })
      .from(customersTable)
      .leftJoin(
        retailerWholesalersTable,
        eq(retailerWholesalersTable.retailerId, customersTable.id)
      )
      .where(
        or(
          eq(customersTable.vendorId, wholesalerId),
          eq(retailerWholesalersTable.wholesalerId, wholesalerId)
        )
      )
      .groupBy(customersTable.id)
      .orderBy(customersTable.shopName);
  } else {
    rows = await db.select().from(customersTable).orderBy(customersTable.shopName);
  }
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
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!c) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  if (req.session.role === "wholesaler") {
    const isLinked = await checkWholesalerLink(id, req.session.userId!);
    if (!isLinked) {
      res.status(404).json({ message: "Not found" });
      return;
    }
  }
  res.json(toCustomer(c));
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!c) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  if (req.session.role === "wholesaler") {
    const isLinked = await checkWholesalerLink(id, req.session.userId!);
    if (!isLinked) {
      res.status(404).json({ message: "Not found" });
      return;
    }
  }

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

  const [updated] = await db
    .update(customersTable)
    .set(updates)
    .where(eq(customersTable.id, id))
    .returning();
  
  res.json(toCustomer(updated));
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (req.session.role === "wholesaler") {
    const isLinked = await checkWholesalerLink(id, req.session.userId!);
    if (!isLinked) {
      res.status(404).json({ message: "Not found" });
      return;
    }
  }
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.json({ ok: true });
});

router.get("/:id/pricing", requireAdmin, async (req, res) => {
  const customerId = Number(req.params.id);

  if (req.session.role === "wholesaler") {
    const isLinked = await checkWholesalerLink(customerId, req.session.userId!);
    if (!isLinked) {
      res.status(404).json({ message: "Customer not found" });
      return;
    }
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer) {
    res.status(404).json({ message: "Customer not found" });
    return;
  }

  // Fetch only products belonging to the logged-in wholesaler vendor
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.vendorId, req.session.userId!))
    .orderBy(productsTable.name);

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

  if (req.session.role === "wholesaler") {
    const isLinked = await checkWholesalerLink(customerId, req.session.userId!);
    if (!isLinked) {
      res.status(403).json({ message: "Unauthorized access to this customer pricing" });
      return;
    }
  }

  const parsed = SetCustomerPricingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const { productId, customPrice } = parsed.data;

  // Verify product ownership before saving pricing
  const [product] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.vendorId, req.session.userId!)
      )
    )
    .limit(1);

  if (!product) {
    res.status(403).json({ message: "Unauthorized access to this product pricing" });
    return;
  }

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
    // Atomic upsert — prevents race condition between two concurrent price-setting requests
    await db
      .insert(customerPricingTable)
      .values({
        customerId,
        productId,
        customPrice: String(customPrice),
      })
      .onConflictDoUpdate({
        target: [customerPricingTable.customerId, customerPricingTable.productId],
        set: { customPrice: String(customPrice) },
      });
  }
  res.json({ ok: true });
});

export default router;
