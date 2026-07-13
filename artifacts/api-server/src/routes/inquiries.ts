import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, inquiriesTable } from "@workspace/db";
import { CreateInquiryBody } from "@workspace/api-zod";
import { sendInquiryEmail } from "../lib/email";

const router: IRouter = Router();

const requireInquiryAccess = (req: any, res: any, next: any) => {
  if (
    req.session.role !== "admin" &&
    req.session.role !== "wholesaler" &&
    req.session.role !== "super_admin"
  ) {
    res.status(401).json({ message: "Admin, Wholesaler or Super Admin authentication required" });
    return;
  }
  next();
};

router.get("/", requireInquiryAccess, async (_req, res) => {
  const rows = await db.select().from(inquiriesTable).orderBy(desc(inquiriesTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      shopName: r.shopName,
      address: r.address,
      phone: r.phone,
      gstNumber: r.gstNumber,
      email: r.email,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/", async (req, res) => {
  const parsed = CreateInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const [created] = await db
    .insert(inquiriesTable)
    .values({
      name: b.name,
      shopName: b.shopName,
      address: b.address,
      phone: b.phone,
      gstNumber: b.gstNumber ?? null,
      email: b.email ?? null,
      message: b.message,
    })
    .returning();

  // Dispatch email notification to platform admin (non-blocking)
  sendInquiryEmail(
    created.name,
    created.shopName,
    created.phone,
    created.email,
    created.message
  ).catch((err) => {
    console.error("[Inquiry Email] Failed to send email:", err);
  });

  res.status(201).json({
    id: created.id,
    name: created.name,
    shopName: created.shopName,
    address: created.address,
    phone: created.phone,
    gstNumber: created.gstNumber,
    email: created.email,
    message: created.message,
    createdAt: created.createdAt.toISOString(),
  });
});

router.delete("/:id", requireInquiryAccess, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(inquiriesTable).where(eq(inquiriesTable.id, id));
  res.json({ ok: true });
});

export default router;
