import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, inquiriesTable } from "@workspace/db";
import { CreateInquiryBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/session";

const router: IRouter = Router();

router.get("/", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(inquiriesTable).orderBy(desc(inquiriesTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      shopName: r.shopName,
      phone: r.phone,
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
      shopName: b.shopName ?? null,
      phone: b.phone,
      email: b.email ?? null,
      message: b.message,
    })
    .returning();
  res.status(201).json({
    id: created.id,
    name: created.name,
    shopName: created.shopName,
    phone: created.phone,
    email: created.email,
    message: created.message,
    createdAt: created.createdAt.toISOString(),
  });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(inquiriesTable).where(eq(inquiriesTable.id, id));
  res.json({ ok: true });
});

export default router;
