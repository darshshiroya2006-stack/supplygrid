import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and, or } from "drizzle-orm";
import { db, adminsTable, customersTable, retailerWholesalersTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { sendEmailOtp, sendForgotPasswordOtp } from "../lib/email.js";

const router: IRouter = Router();
const emailOtpCache = new Map<string, { otp: string; expiresAt: number }>();

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────

function generateUniqueVendorId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "WH-";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getRetailerLinkedWholesalers(retailerId: number) {
  const links = await db
    .select({
      id: adminsTable.id,
      shopName: adminsTable.shopName,
      uniqueVendorId: adminsTable.uniqueVendorId,
      name: adminsTable.name,
    })
    .from(retailerWholesalersTable)
    .innerJoin(adminsTable, eq(retailerWholesalersTable.wholesalerId, adminsTable.id))
    .where(eq(retailerWholesalersTable.retailerId, retailerId));
  return links;
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid login body" });
    return;
  }
  const { username, password } = parsed.data;

  // Auto-seed admin
  if (username === "admin") {
    const [existingAdmin] = await db.select().from(adminsTable).where(eq(adminsTable.username, "admin")).limit(1);
    if (!existingAdmin) {
      const hash = bcrypt.hashSync("admin", 10);
      await db.insert(adminsTable).values({
        username: "admin",
        passwordHash: hash,
        name: "Darsh Shiroya",
        role: "super_admin",
        status: "ACTIVE"
      });
    } else if (existingAdmin.role !== "super_admin" || existingAdmin.status !== "ACTIVE") {
      await db.update(adminsTable)
        .set({ role: "super_admin", status: "ACTIVE" })
        .where(eq(adminsTable.id, existingAdmin.id));
    }
  }

  // Try wholesaler/admin table first
  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.username, username)).limit(1);
  if (admin && bcrypt.compareSync(password, admin.passwordHash)) {
    if (admin.role === "wholesaler" && admin.status === "PENDING") {
      res.status(403).json({ message: "તમારું એકાઉન્ટ હજી સુપર એડમિનના અપ્રુવલ માટે બાકી છે!" });
      return;
    }

    req.session.role = admin.role as any;
    req.session.userId = admin.id;
    req.session.name = admin.name;
    req.session.shopName = admin.shopName ?? undefined;
    req.session.uniqueVendorId = admin.uniqueVendorId ?? undefined;
    res.json({
      authenticated: true,
      role: admin.role,
      userId: admin.id,
      name: admin.name,
      shopName: admin.shopName ?? null,
      uniqueVendorId: admin.uniqueVendorId ?? null,
      status: admin.status,
      linkedWholesalers: [],
    });
    return;
  }

  // Try retailer table
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.username, username))
    .limit(1);

  if (customer && bcrypt.compareSync(password, customer.passwordHash)) {
    req.session.role = customer.role as any;
    req.session.userId = customer.id;
    req.session.name = customer.ownerName ?? customer.shopName;
    req.session.shopName = customer.shopName;

    const linkedWholesalers = await getRetailerLinkedWholesalers(customer.id);

    res.json({
      authenticated: true,
      role: customer.role,
      userId: customer.id,
      name: customer.ownerName ?? customer.shopName,
      shopName: customer.shopName,
      uniqueVendorId: null,
      linkedWholesalers,
      // Legacy compat — first linked wholesaler's shop name
      wholesalerShopName: linkedWholesalers[0]?.shopName ?? null,
    });
    return;
  }

  res.status(401).json({ message: "Invalid username or password" });
});

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ─────────────────────────────────────────────
// GET CURRENT USER (/me)
// ─────────────────────────────────────────────

router.get("/me", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.session.role) {
    res.json({
      authenticated: false,
      role: "guest",
      userId: null,
      name: null,
      shopName: null,
      uniqueVendorId: null,
      status: null,
      wholesalerShopName: null,
      linkedWholesalers: [],
    });
    return;
  }

  let linkedWholesalers: Awaited<ReturnType<typeof getRetailerLinkedWholesalers>> = [];
  let wholesalerShopName: string | null = null;
  let status: string | null = null;

  if ((req.session.role === "retailer" || req.session.role === "customer") && req.session.userId) {
    linkedWholesalers = await getRetailerLinkedWholesalers(req.session.userId);
    wholesalerShopName = linkedWholesalers[0]?.shopName ?? null;
  } else if (req.session.userId) {
    const [admin] = await db.select({ status: adminsTable.status }).from(adminsTable).where(eq(adminsTable.id, req.session.userId)).limit(1);
    if (admin) {
      status = admin.status;
    }
  }

  res.json({
    authenticated: true,
    role: req.session.role,
    userId: req.session.userId ?? null,
    name: req.session.name ?? null,
    shopName: req.session.shopName ?? null,
    uniqueVendorId: req.session.uniqueVendorId ?? null,
    status,
    wholesalerShopName,
    linkedWholesalers,
  });
});

// ─────────────────────────────────────────────
// WHOLESALER SIGNUP
// ─────────────────────────────────────────────

router.post("/signup/send-email-otp", async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) {
    res.status(400).json({ message: "Email and phone number are required" });
    return;
  }

  const [existingEmail] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email))
    .limit(1);
  if (existingEmail) {
    res.status(400).json({ message: "A wholesaler account already exists with this Email Address." });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  emailOtpCache.set(`wholesaler:${email.toLowerCase()}`, { otp, expiresAt });

  const success = await sendEmailOtp(email, otp, "wholesaler");
  if (!success) {
    res.status(500).json({ message: "Failed to dispatch verification email. Please try again." });
    return;
  }

  res.json({ message: "Verification OTP sent successfully" });
});

router.post("/signup/wholesaler", async (req, res) => {
  const { shopName, ownerName, username, phone, email, password, otp } = req.body;
  if (!shopName || !ownerName || !username || !phone || !email || !password || !otp) {
    res.status(400).json({ message: "All fields, including the 6-digit OTP code, are required." });
    return;
  }

  const cached = emailOtpCache.get(`wholesaler:${email.toLowerCase()}`);
  if (!cached) {
    res.status(400).json({ message: "No verification session found for this email. Please request a new OTP." });
    return;
  }
  if (Date.now() > cached.expiresAt) {
    emailOtpCache.delete(`wholesaler:${email.toLowerCase()}`);
    res.status(400).json({ message: "OTP has expired. Please request a new code." });
    return;
  }
  if (cached.otp !== otp.trim()) {
    res.status(400).json({ message: "Invalid verification code. Please check your email and try again." });
    return;
  }
  emailOtpCache.delete(`wholesaler:${email.toLowerCase()}`);

  const [existingUser] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.username, username))
    .limit(1);
  if (existingUser) {
    res.status(400).json({ message: "A wholesaler account already exists with this Username." });
    return;
  }

  let uniqueVendorId = generateUniqueVendorId();
  while (true) {
    const [dup] = await db.select().from(adminsTable).where(eq(adminsTable.uniqueVendorId, uniqueVendorId)).limit(1);
    if (!dup) break;
    uniqueVendorId = generateUniqueVendorId();
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const [created] = await db
    .insert(adminsTable)
    .values({ username, passwordHash, name: ownerName, role: "wholesaler", uniqueVendorId, shopName, phone, email })
    .returning();

  res.status(201).json({ message: "Wholesaler registered successfully", uniqueVendorId: created.uniqueVendorId });
});

// ─────────────────────────────────────────────
// RETAILER SIGNUP (Email OTP + UPSERT)
// ─────────────────────────────────────────────

// Step 1 — validate vendor ID + send OTP to retailer email
router.post("/signup/send-retailer-otp", async (req, res) => {
  const { email, vendorId } = req.body;
  if (!email || !vendorId) {
    res.status(400).json({ message: "Email and Wholesaler Vendor ID are required" });
    return;
  }

  const cleanVendorId = String(vendorId).trim().toUpperCase();

  // Validate wholesaler vendor ID
  const [wholesaler] = await db
    .select()
    .from(adminsTable)
    .where(and(eq(adminsTable.uniqueVendorId, cleanVendorId), eq(adminsTable.role, "wholesaler")))
    .limit(1);
  if (!wholesaler) {
    res.status(400).json({ message: "Invalid Wholesaler Vendor ID. No wholesaler found with this ID." });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  emailOtpCache.set(`retailer:${email.toLowerCase()}`, { otp, expiresAt });

  const success = await sendEmailOtp(email, otp, "retailer");
  if (!success) {
    res.status(500).json({ message: "Failed to send verification email. Please try again." });
    return;
  }

  res.json({ message: "Verification OTP sent to your email" });
});

// Step 2 — verify OTP + UPSERT customer + link to wholesaler
router.post("/signup/retailer", async (req, res) => {
  const { shopName, ownerName, address, username, password, phone, email, vendorId, otp } = req.body;

  if (!shopName || !username || !password || !email || !vendorId || !otp) {
    res.status(400).json({ message: "All fields including the 6-digit OTP are required." });
    return;
  }

  // Verify OTP
  const cached = emailOtpCache.get(`retailer:${email.toLowerCase()}`);
  if (!cached) {
    res.status(400).json({ message: "No active OTP session found. Please request a new code." });
    return;
  }
  if (Date.now() > cached.expiresAt) {
    emailOtpCache.delete(`retailer:${email.toLowerCase()}`);
    res.status(400).json({ message: "OTP has expired. Please request a new code." });
    return;
  }
  if (cached.otp !== otp.trim()) {
    res.status(400).json({ message: "Invalid verification code. Please check your email and try again." });
    return;
  }
  emailOtpCache.delete(`retailer:${email.toLowerCase()}`);

  // Validate wholesaler
  const cleanVendorId = String(vendorId).trim().toUpperCase();
  const [wholesaler] = await db
    .select()
    .from(adminsTable)
    .where(and(eq(adminsTable.uniqueVendorId, cleanVendorId), eq(adminsTable.role, "wholesaler")))
    .limit(1);
  if (!wholesaler) {
    res.status(404).json({ message: "Wholesaler with this Vendor ID not found." });
    return;
  }

  // Check if username is already taken by ANOTHER account
  const [usernameTaken] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.username, username))
    .limit(1);
  if (usernameTaken && usernameTaken.email?.toLowerCase() !== email.toLowerCase() && usernameTaken.phone !== phone) {
    res.status(400).json({ message: "This User ID is already taken. Please choose a different one." });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  // UPSERT: find by email OR phone
  const [existing] = await db
    .select()
    .from(customersTable)
    .where(or(eq(customersTable.email, email.toLowerCase()), ...(phone ? [eq(customersTable.phone, phone)] : [])))
    .limit(1);

  let customerId: number;

  if (existing) {
    // Merge credentials into existing record
    await db
      .update(customersTable)
      .set({
        username,
        passwordHash,
        shopName,
        ownerName: ownerName || existing.ownerName,
        phone: phone || existing.phone,
        address: address || existing.address,
        email: email.toLowerCase(),
        vendorId: existing.vendorId ?? wholesaler.id, // keep original primary vendor
      })
      .where(eq(customersTable.id, existing.id));
    customerId = existing.id;
  } else {
    // New retailer — insert fresh record
    const [created] = await db
      .insert(customersTable)
      .values({
        shopName,
        ownerName: ownerName || null,
        username,
        passwordHash,
        phone: phone || null,
        email: email.toLowerCase(),
        address: address || null,
        role: "retailer",
        vendorId: wholesaler.id,
      })
      .returning();
    customerId = created.id;
  }

  // Link to wholesaler in join table (ignore if already linked)
  try {
    console.log(`[Signup Retailer] Attempting to link retailer ID ${customerId} to wholesaler ID ${wholesaler.id} (shopName: ${wholesaler.shopName})`);
    await db
      .insert(retailerWholesalersTable)
      .values({ retailerId: customerId, wholesalerId: wholesaler.id })
      .onConflictDoNothing();
    console.log(`[Signup Retailer] Link mapping query completed successfully.`);
  } catch (error: any) {
    console.error(`[Signup Retailer ERROR] Relation mapping query failed:`, error);
  }

  res.status(201).json({
    message: `Account created and linked to ${wholesaler.shopName || wholesaler.name}!`,
  });
});

// ─────────────────────────────────────────────
// RETAILER: LINK A NEW WHOLESALER
// ─────────────────────────────────────────────

router.post("/retailer/link-wholesaler", async (req, res) => {
  if (!req.session.userId || req.session.role !== "retailer") {
    res.status(401).json({ message: "Retailer authentication required" });
    return;
  }
  const { vendorId } = req.body;
  if (!vendorId) {
    res.status(400).json({ message: "Wholesaler Vendor ID is required" });
    return;
  }

  const cleanVendorId = String(vendorId).trim().toUpperCase();

  const [wholesaler] = await db
    .select()
    .from(adminsTable)
    .where(and(eq(adminsTable.uniqueVendorId, cleanVendorId), eq(adminsTable.role, "wholesaler")))
    .limit(1);
  if (!wholesaler) {
    res.status(404).json({ message: "No wholesaler found with this Vendor ID." });
    return;
  }

  try {
    console.log(`[Link Wholesaler] Attempting to link retailer ID ${req.session.userId} to wholesaler ID ${wholesaler.id} (shopName: ${wholesaler.shopName})`);
    await db
      .insert(retailerWholesalersTable)
      .values({ retailerId: req.session.userId, wholesalerId: wholesaler.id })
      .onConflictDoNothing();
    console.log(`[Link Wholesaler] Link mapping query completed successfully.`);
  } catch (error: any) {
    console.error(`[Link Wholesaler ERROR] Relation mapping query failed:`, error);
  }

  res.json({ message: `Linked to ${wholesaler.shopName || wholesaler.name} successfully!` });
});

// ─────────────────────────────────────────────
// RETAILER: GET ALL LINKED WHOLESALERS
// ─────────────────────────────────────────────

router.get("/retailer/wholesalers", async (req, res) => {
  if (!req.session.userId || req.session.role !== "retailer") {
    res.status(401).json({ message: "Retailer authentication required" });
    return;
  }
  const wholesalers = await getRetailerLinkedWholesalers(req.session.userId);
  res.json(wholesalers);
});

// ─────────────────────────────────────────────
// WHOLESALER PROFILE: GET + UPDATE
// ─────────────────────────────────────────────

router.get("/profile", async (req, res) => {
  if (!req.session.userId || (req.session.role !== "admin" && req.session.role !== "wholesaler")) {
    res.status(401).json({ message: "Wholesaler authentication required" });
    return;
  }

  const [admin] = await db
    .select({
      shopName: adminsTable.shopName,
      name: adminsTable.name,
      phone: adminsTable.phone,
      email: adminsTable.email,
      address: adminsTable.address,
      gstin: adminsTable.gstin,
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

router.patch("/profile", async (req, res) => {
  if (!req.session.userId || (req.session.role !== "admin" && req.session.role !== "wholesaler")) {
    res.status(401).json({ message: "Wholesaler authentication required" });
    return;
  }

  const { shopName, phone, address, gstin } = req.body;

  const updates: Record<string, string> = {};
  if (shopName !== undefined) updates.shopName = shopName;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (gstin !== undefined) updates.gstin = gstin;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(adminsTable)
    .set(updates)
    .where(eq(adminsTable.id, req.session.userId))
    .returning({
      shopName: adminsTable.shopName,
      name: adminsTable.name,
      phone: adminsTable.phone,
      email: adminsTable.email,
      address: adminsTable.address,
      gstin: adminsTable.gstin,
    });

  if (shopName) {
    req.session.shopName = shopName;
  }

  res.json(updated);
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD FLOW
// ─────────────────────────────────────────────

router.post("/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ message: "Email is required." });
    return;
  }

  // Check if email exists in adminsTable
  const [admin] = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.email, email.trim()))
    .limit(1);

  // Check if email exists in customersTable
  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.email, email.trim()))
    .limit(1);

  if (!admin && !customer) {
    res.status(404).json({ message: "Email address not registered." });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  emailOtpCache.set(`forgot-password:${email.toLowerCase().trim()}`, { otp, expiresAt });

  const success = await sendForgotPasswordOtp(email.trim(), otp);
  if (!success) {
    res.status(500).json({ message: "Failed to send reset code. Please try again." });
    return;
  }

  res.json({ message: "Verification OTP sent successfully." });
});

router.post("/forgot-password/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400).json({ message: "Email and OTP are required." });
    return;
  }

  const cached = emailOtpCache.get(`forgot-password:${email.toLowerCase().trim()}`);
  if (!cached) {
    res.status(400).json({ message: "No password reset session found for this email. Please request a new OTP." });
    return;
  }

  if (Date.now() > cached.expiresAt) {
    emailOtpCache.delete(`forgot-password:${email.toLowerCase().trim()}`);
    res.status(400).json({ message: "OTP has expired. Please request a new code." });
    return;
  }

  if (cached.otp !== otp.trim()) {
    res.status(400).json({ message: "Invalid verification code. Please check and try again." });
    return;
  }

  res.json({ message: "OTP verified successfully. You may reset your password now." });
});

router.post("/forgot-password/reset", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    res.status(400).json({ message: "Email, OTP, and new password are required." });
    return;
  }

  const cached = emailOtpCache.get(`forgot-password:${email.toLowerCase().trim()}`);
  if (!cached) {
    res.status(400).json({ message: "No password reset session found for this email. Please request a new OTP." });
    return;
  }

  if (Date.now() > cached.expiresAt) {
    emailOtpCache.delete(`forgot-password:${email.toLowerCase().trim()}`);
    res.status(400).json({ message: "OTP has expired. Please request a new code." });
    return;
  }

  if (cached.otp !== otp.trim()) {
    res.status(400).json({ message: "Invalid verification code. Please check and try again." });
    return;
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Update in adminsTable
  const [admin] = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.email, email.trim()))
    .limit(1);

  if (admin) {
    await db
      .update(adminsTable)
      .set({ passwordHash })
      .where(eq(adminsTable.id, admin.id));
  } else {
    // Update in customersTable
    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.email, email.trim()))
      .limit(1);

    if (customer) {
      await db
        .update(customersTable)
        .set({ passwordHash })
        .where(eq(customersTable.id, customer.id));
    } else {
      res.status(404).json({ message: "Account not found." });
      return;
    }
  }

  // Clean cache
  emailOtpCache.delete(`forgot-password:${email.toLowerCase().trim()}`);

  res.json({ message: "Password reset successful. You may sign in now." });
});

export default router;
