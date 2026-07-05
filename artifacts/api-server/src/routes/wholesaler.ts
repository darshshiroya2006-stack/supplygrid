import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";

const router: IRouter = Router();

// GET /api/wholesaler/profile
router.get("/profile", async (req, res) => {
  if (!req.session.userId || (req.session.role !== "admin" && req.session.role !== "wholesaler")) {
    res.status(401).json({ message: "Wholesaler authentication required" });
    return;
  }

  const [admin] = await db
    .select({
      id: adminsTable.id,
      shopName: adminsTable.shopName,
      name: adminsTable.name,
      phone: adminsTable.phone,
      email: adminsTable.email,
      address: adminsTable.address,
      gstin: adminsTable.gstin,
      gst_number: adminsTable.gst_number,
    })
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.userId))
    .limit(1);

  if (!admin) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  res.json(admin);
});

// PATCH /api/wholesaler/profile
router.patch("/profile", async (req, res) => {
  if (!req.session.userId || (req.session.role !== "admin" && req.session.role !== "wholesaler")) {
    res.status(401).json({ message: "Wholesaler authentication required" });
    return;
  }

  const { shopName, phone, address, gstin, gst_number } = req.body;

  const updates: Record<string, any> = {};
  if (shopName !== undefined) updates.shopName = shopName;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (gstin !== undefined) updates.gstin = gstin;
  if (gst_number !== undefined) updates.gst_number = gst_number;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(adminsTable)
    .set(updates)
    .where(eq(adminsTable.id, req.session.userId))
    .returning({
      id: adminsTable.id,
      shopName: adminsTable.shopName,
      name: adminsTable.name,
      phone: adminsTable.phone,
      email: adminsTable.email,
      address: adminsTable.address,
      gstin: adminsTable.gstin,
      gst_number: adminsTable.gst_number,
    });

  if (shopName) {
    req.session.shopName = shopName;
  }

  res.json(updated);
});

export default router;
