import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /api/retailer/profile
router.get("/profile", async (req, res) => {
  if (!req.session.userId || (req.session.role !== "retailer" && req.session.role !== "customer")) {
    res.status(401).json({ message: "Retailer authentication required" });
    return;
  }

  const [customer] = await db
    .select({
      id: customersTable.id,
      shopName: customersTable.shopName,
      ownerName: customersTable.ownerName,
      phone: customersTable.phone,
      email: customersTable.email,
      address: customersTable.address,
    })
    .from(customersTable)
    .where(eq(customersTable.id, req.session.userId))
    .limit(1);

  if (!customer) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  res.json(customer);
});

// PATCH /api/retailer/profile
router.patch("/profile", async (req, res) => {
  if (!req.session.userId || (req.session.role !== "retailer" && req.session.role !== "customer")) {
    res.status(401).json({ message: "Retailer authentication required" });
    return;
  }

  const { shopName, ownerName, phone, address } = req.body;

  const updates: Record<string, any> = {};
  if (shopName !== undefined) updates.shopName = shopName;
  if (ownerName !== undefined) updates.ownerName = ownerName;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(customersTable)
    .set(updates)
    .where(eq(customersTable.id, req.session.userId))
    .returning({
      id: customersTable.id,
      shopName: customersTable.shopName,
      ownerName: customersTable.ownerName,
      phone: customersTable.phone,
      email: customersTable.email,
      address: customersTable.address,
    });

  if (shopName) {
    req.session.shopName = shopName;
  }

  res.json(updated);
});

export default router;
