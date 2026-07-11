import { Router, type Request, type Response } from "express";
import { db, adminsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../lib/session";

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

export default router;
