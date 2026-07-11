import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq, and, ne } from "drizzle-orm";
import { db, adminsTable, customersTable, retailerWholesalersTable } from "@workspace/db";
import { requireAdmin } from "../lib/session";

const router = Router();

// GET /wholesaler/sub-accounts - Get all sub-accounts (staff & retailers) bound to this wholesaler
router.get("/wholesaler/sub-accounts", requireAdmin, async (req: Request, res: Response) => {
  try {
    const wholesalerId = req.session.userId!;
    const vendorId = req.session.uniqueVendorId;

    // Fetch staff sub-accounts
    let staff: any[] = [];
    if (vendorId) {
      staff = await db
        .select({
          id: adminsTable.id,
          username: adminsTable.username,
          name: adminsTable.name,
          phone: adminsTable.phone,
          role: adminsTable.role,
          createdAt: adminsTable.createdAt,
        })
        .from(adminsTable)
        .where(
          and(
            eq(adminsTable.uniqueVendorId, vendorId),
            ne(adminsTable.id, wholesalerId)
          )
        );
    }

    // Fetch retailer sub-accounts
    const retailers = await db
      .select({
        id: customersTable.id,
        shopName: customersTable.shopName,
        ownerName: customersTable.ownerName,
        username: customersTable.username,
        phone: customersTable.phone,
        role: customersTable.role,
        createdAt: customersTable.createdAt,
      })
      .from(customersTable)
      .where(eq(customersTable.vendorId, wholesalerId));

    res.json({
      staff: staff.map(s => ({ ...s, type: "staff" })),
      retailers: retailers.map(r => ({ ...r, type: "retailer" })),
    });
  } catch (error: any) {
    console.error("GET_SUB_ACCOUNTS_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to fetch sub-accounts" });
  }
});

// POST /wholesaler/sub-accounts - Create a staff or retailer sub-account
router.post("/wholesaler/sub-accounts", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, username, password, name, phone } = req.body;
    if (!type || !username || !password || !name) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    const wholesalerId = req.session.userId!;
    const vendorId = req.session.uniqueVendorId;
    const passwordHash = bcrypt.hashSync(password, 10);

    if (type === "staff") {
      if (!vendorId) {
        res.status(400).json({ message: "Wholesaler unique vendor ID not found" });
        return;
      }

      // Check username uniqueness in admins
      const [existing] = await db
        .select()
        .from(adminsTable)
        .where(eq(adminsTable.username, username.trim().toLowerCase()))
        .limit(1);

      if (existing) {
        res.status(400).json({ message: "Username is already taken" });
        return;
      }

      // Insert staff user
      const [created] = await db
        .insert(adminsTable)
        .values({
          username: username.trim().toLowerCase(),
          passwordHash,
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          role: "wholesaler", // So they get backend access
          status: "ACTIVE",  // Auto ACTIVE
          uniqueVendorId: vendorId,
        })
        .returning();

      res.status(201).json({
        success: true,
        message: "Staff sub-account created successfully",
        account: {
          id: created.id,
          username: created.username,
          name: created.name,
          role: created.role,
          type: "staff",
        }
      });
    } else if (type === "retailer") {
      // Check username uniqueness in customers
      const [existing] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.username, username.trim().toLowerCase()))
        .limit(1);

      if (existing) {
        res.status(400).json({ message: "Username is already taken" });
        return;
      }

      // Insert customer user
      const [created] = await db
        .insert(customersTable)
        .values({
          shopName: name.trim(), // For retailer, name is the Shop Name
          username: username.trim().toLowerCase(),
          passwordHash,
          phone: phone ? phone.trim() : null,
          role: "retailer",
          vendorId: wholesalerId,
        })
        .returning();

      // Link them in the join table
      try {
        await db
          .insert(retailerWholesalersTable)
          .values({ retailerId: created.id, wholesalerId })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Link mapping failed during retailer sub-account creation:", err);
      }

      res.status(201).json({
        success: true,
        message: "Retailer sub-account created successfully",
        account: {
          id: created.id,
          username: created.username,
          shopName: created.shopName,
          role: created.role,
          type: "retailer",
        }
      });
    } else {
      res.status(400).json({ message: "Invalid account type" });
    }
  } catch (error: any) {
    console.error("CREATE_SUB_ACCOUNT_ERROR:", error);
    res.status(500).json({ message: error.message || "Failed to create sub-account" });
  }
});

export default router;
