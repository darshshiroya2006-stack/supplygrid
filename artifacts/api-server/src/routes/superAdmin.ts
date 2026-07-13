import { Router, type Request, type Response } from "express";
import { db, adminsTable, inquiriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../lib/session";
import bcrypt from "bcryptjs";

const router = Router();

// GET /super-admin/pending - Get all pending wholesalers
router.get("/super-admin/pending", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const pending = await db
      .select({
        id: adminsTable.id,
        shopName: adminsTable.shopName,
        name: adminsTable.name,
        phone: adminsTable.phone,
        gst_number: adminsTable.gst_number,
        gstin: adminsTable.gstin,
      })
      .from(adminsTable)
      .where(and(eq(adminsTable.status, "PENDING"), eq(adminsTable.role, "wholesaler")));
    
    res.json(pending);
  } catch (error: any) {
    console.error("GET_PENDING_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to fetch pending wholesalers" });
  }
});

// PUT /super-admin/approve/:id - Approve wholesaler
router.put("/super-admin/approve/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    await db
      .update(adminsTable)
      .set({ status: "ACTIVE" })
      .where(eq(adminsTable.id, id));

    res.json({ success: true, message: "Wholesaler approved successfully" });
  } catch (error: any) {
    console.error("APPROVE_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to approve wholesaler" });
  }
});

// DELETE /super-admin/reject/:id - Reject/Delete wholesaler request
router.delete("/super-admin/reject/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    await db
      .delete(adminsTable)
      .where(eq(adminsTable.id, id));

    res.json({ success: true, message: "Wholesaler rejected and deleted successfully" });
  } catch (error: any) {
    console.error("REJECT_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to reject wholesaler" });
  }
});

// GET /super-admin/merchants - Get all registered Wholesaler merchants
router.get("/super-admin/merchants", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const merchants = await db
      .select({
        id: adminsTable.id,
        username: adminsTable.username,
        shopName: adminsTable.shopName,
        name: adminsTable.name,
        phone: adminsTable.phone,
        email: adminsTable.email,
        address: adminsTable.address,
        gst_number: adminsTable.gst_number,
        uniqueVendorId: adminsTable.uniqueVendorId,
        status: adminsTable.status,
        createdAt: adminsTable.createdAt,
      })
      .from(adminsTable)
      .where(eq(adminsTable.role, "wholesaler"));
    res.json(merchants);
  } catch (error: any) {
    console.error("GET_MERCHANTS_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to fetch merchants" });
  }
});

// PUT /super-admin/merchants/:id/status - Toggle status (ACTIVE/DEACTIVATED)
router.put("/super-admin/merchants/:id/status", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (isNaN(id) || !status || (status !== "ACTIVE" && status !== "DEACTIVATED")) {
      res.status(400).json({ message: "Invalid status value. Must be ACTIVE or DEACTIVATED." });
      return;
    }

    await db
      .update(adminsTable)
      .set({ status })
      .where(eq(adminsTable.id, id));

    res.json({ success: true, message: `Merchant status updated to ${status} successfully.` });
  } catch (error: any) {
    console.error("UPDATE_STATUS_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to update status" });
  }
});

// DELETE /super-admin/merchants/:id - Delete a merchant completely (purge from credentials)
router.delete("/super-admin/merchants/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }

    await db
      .delete(adminsTable)
      .where(eq(adminsTable.id, id));

    res.json({ success: true, message: "Merchant deleted and credentials completely purged" });
  } catch (error: any) {
    console.error("DELETE_MERCHANT_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to delete merchant" });
  }
});

// POST /super-admin/accept-inquiry/:id - Accept partner request and prompt username/password
router.post("/super-admin/accept-inquiry/:id", requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { username, password } = req.body;
    if (isNaN(id) || !username || !password) {
      res.status(400).json({ message: "Username and password are required" });
      return;
    }

    // 1. Fetch inquiry
    const [inquiry] = await db
      .select()
      .from(inquiriesTable)
      .where(eq(inquiriesTable.id, id))
      .limit(1);
    if (!inquiry) {
      res.status(404).json({ message: "Partner inquiry not found" });
      return;
    }

    // 2. Check if username is taken in adminsTable
    const [dupAdmin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, username.trim()))
      .limit(1);
    if (dupAdmin) {
      res.status(400).json({ message: "Username is already taken" });
      return;
    }

    // 3. Generate uniqueVendorId (WH-XXXXX)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let uniqueVendorId = "WH-";
    while (true) {
      for (let i = 0; i < 5; i++) {
        uniqueVendorId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const [dup] = await db
        .select()
        .from(adminsTable)
        .where(eq(adminsTable.uniqueVendorId, uniqueVendorId))
        .limit(1);
      if (!dup) break;
      uniqueVendorId = "WH-";
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    // 4. Create wholesaler merchant account
    await db.insert(adminsTable).values({
      username: username.trim(),
      passwordHash,
      name: inquiry.name,
      shopName: inquiry.shopName,
      phone: inquiry.phone,
      email: inquiry.email,
      address: inquiry.address,
      gst_number: inquiry.gstNumber,
      gstin: inquiry.gstNumber,
      role: "wholesaler",
      status: "ACTIVE",
      uniqueVendorId,
    });

    // 5. Delete the inquiry
    await db.delete(inquiriesTable).where(eq(inquiriesTable.id, id));

    res.json({ success: true, message: "Wholesaler merchant account created successfully!" });
  } catch (error: any) {
    console.error("ACCEPT_INQUIRY_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to accept inquiry" });
  }
});

export default router;
