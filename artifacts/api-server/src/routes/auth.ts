import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db, adminsTable, customersTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { verifyFirebaseIdToken } from "../lib/firebaseAdmin.js";
import { sendEmailOtp } from "../lib/email.js";

const router: IRouter = Router();
const emailOtpCache = new Map<string, { otp: string; expiresAt: number }>();

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid login body" });
    return;
  }
  const { username, password } = parsed.data;


if (username === "admin") {
  const [existingAdmin] = await db.select().from(adminsTable).where(eq(adminsTable.username, "admin")).limit(1);
  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync("admin", salt); 
    await db.insert(adminsTable).values({
      username: "admin",
      passwordHash: hash,
      name: "Darsh Shiroya", 
    });
  }
}

  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.username, username)).limit(1);
  if (admin && bcrypt.compareSync(password, admin.passwordHash)) {
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
    });
    return;
  }

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

    let wholesalerShopName = null;
    if (customer.vendorId) {
      const [w] = await db
        .select({ shopName: adminsTable.shopName })
        .from(adminsTable)
        .where(eq(adminsTable.id, customer.vendorId))
        .limit(1);
      wholesalerShopName = w?.shopName ?? null;
    }

    res.json({
      authenticated: true,
      role: customer.role,
      userId: customer.id,
      name: customer.ownerName ?? customer.shopName,
      shopName: customer.shopName,
      uniqueVendorId: null,
      wholesalerShopName,
    });
    return;
  }

  res.status(401).json({ message: "Invalid username or password" });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.session.role) {
    res.json({ authenticated: false, role: "guest", userId: null, name: null, shopName: null, uniqueVendorId: null, wholesalerShopName: null });
    return;
  }

  let wholesalerShopName = null;
  if ((req.session.role === "retailer" || req.session.role === "customer") && req.session.userId) {
    const [c] = await db
      .select({ vendorId: customersTable.vendorId })
      .from(customersTable)
      .where(eq(customersTable.id, req.session.userId))
      .limit(1);
    if (c?.vendorId) {
      const [w] = await db
        .select({ shopName: adminsTable.shopName })
        .from(adminsTable)
        .where(eq(adminsTable.id, c.vendorId))
        .limit(1);
      wholesalerShopName = w?.shopName ?? null;
    }
  }

  res.json({
    authenticated: true,
    role: req.session.role,
    userId: req.session.userId ?? null,
    name: req.session.name ?? null,
    shopName: req.session.shopName ?? null,
    uniqueVendorId: req.session.uniqueVendorId ?? null,
    wholesalerShopName,
  });
});

// Helper to generate a unique vendor ID (e.g. WH-XXXXX)
function generateUniqueVendorId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "WH-";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 1. Firebase Phone Auth Vendor validation endpoint
router.post("/signup/send-otp", async (req, res) => {
  const { phone, vendorId } = req.body;
  if (!phone) {
    res.status(400).json({ message: "Mobile number is required" });
    return;
  }

  if (vendorId) {
    // Validate that the wholesaler vendor ID exists
    const [wholesaler] = await db
      .select()
      .from(adminsTable)
      .where(and(eq(adminsTable.uniqueVendorId, vendorId), eq(adminsTable.role, "wholesaler")))
      .limit(1);
    if (!wholesaler) {
      res.status(400).json({ message: "Invalid Vendor ID. Wholesaler not found." });
      return;
    }
  }

  res.json({ message: "Validation successful" });
});

// 1.5. Generate and Send Email OTP for Wholesaler Signup
router.post("/signup/send-email-otp", async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) {
    res.status(400).json({ message: "Email and phone number are required" });
    return;
  }

  // Check if username already exists for the email or phone
  const [existingEmail] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email))
    .limit(1);
  if (existingEmail) {
    res.status(400).json({ message: "A wholesaler account already exists with this Email Address." });
    return;
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set expiry in 5 minutes
  const expiresAt = Date.now() + 5 * 60 * 1000;
  emailOtpCache.set(email.toLowerCase(), { otp, expiresAt });

  // Send the email OTP
  const success = await sendEmailOtp(email, otp);
  if (!success) {
    res.status(500).json({ message: "Failed to dispatch verification email. Please try again." });
    return;
  }

  res.json({ message: "Verification OTP sent successfully" });
});

// 2. Wholesaler Registration endpoint (Email OTP Verified)
router.post("/signup/wholesaler", async (req, res) => {
  const { shopName, ownerName, username, phone, email, password, otp } = req.body;

  if (!shopName || !ownerName || !username || !phone || !email || !password || !otp) {
    res.status(400).json({ message: "All fields, including the 6-digit OTP code, are required." });
    return;
  }

  // Verify the cached email OTP
  const cached = emailOtpCache.get(email.toLowerCase());
  if (!cached) {
    res.status(400).json({ message: "No verification session found for this email address. Please request a new OTP." });
    return;
  }

  if (Date.now() > cached.expiresAt) {
    emailOtpCache.delete(email.toLowerCase());
    res.status(400).json({ message: "Verification OTP has expired. Please request a new code." });
    return;
  }

  if (cached.otp !== otp.trim()) {
    res.status(400).json({ message: "Invalid 6-digit verification code. Please check your email and try again." });
    return;
  }

  // Remove OTP from cache on successful verification
  emailOtpCache.delete(email.toLowerCase());

  // Check if username already exists
  const [existingUser] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.username, username))
    .limit(1);
  if (existingUser) {
    res.status(400).json({ message: "A wholesaler account already exists with this Username." });
    return;
  }

  // Generate unique vendor ID
  let uniqueVendorId = generateUniqueVendorId();
  let isUnique = false;
  while (!isUnique) {
    const [dup] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.uniqueVendorId, uniqueVendorId))
      .limit(1);
    if (!dup) {
      isUnique = true;
    } else {
      uniqueVendorId = generateUniqueVendorId();
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const [created] = await db
    .insert(adminsTable)
    .values({
      username,
      passwordHash,
      name: ownerName,
      role: "wholesaler",
      uniqueVendorId,
      shopName,
      phone,
      email,
    })
    .returning();

  res.status(201).json({
    message: "Wholesaler registered successfully",
    uniqueVendorId: created.uniqueVendorId,
  });
});

// 3. Retailer Registration endpoint (Firebase Verified)
router.post("/signup/retailer", async (req, res) => {
  const { phone, vendorId, password, firebaseToken, shopName, ownerName } = req.body;

  if (!phone || !vendorId || !password || !firebaseToken) {
    res.status(400).json({ message: "Mobile number, Vendor ID, password, and Firebase token are required" });
    return;
  }

  // Verify Firebase ID Token
  const verifiedPhone = await verifyFirebaseIdToken(firebaseToken);
  if (!verifiedPhone) {
    res.status(400).json({ message: "Firebase phone verification failed. Please try again." });
    return;
  }

  const cleanSubmittedPhone = phone.replace(/\D/g, "");
  const cleanVerifiedPhone = verifiedPhone.replace(/\D/g, "");
  if (!cleanVerifiedPhone.endsWith(cleanSubmittedPhone)) {
    res.status(400).json({ message: "Verification mismatch: OTP was not verified for this mobile number." });
    return;
  }

  // Validate Wholesaler Vendor ID exists
  const [wholesaler] = await db
    .select()
    .from(adminsTable)
    .where(and(eq(adminsTable.uniqueVendorId, vendorId), eq(adminsTable.role, "wholesaler")))
    .limit(1);
  if (!wholesaler) {
    res.status(404).json({ message: "Wholesaler with the entered Vendor ID was not found." });
    return;
  }

  // Check if username (phone) already exists in customersTable
  const [existingCustomer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.username, phone))
    .limit(1);
  if (existingCustomer) {
    res.status(400).json({ message: "A retailer account already exists with this Mobile Number." });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const finalShopName = shopName || `${phone} Retailer`;
  const finalOwnerName = ownerName || "Retailer";

  await db
    .insert(customersTable)
    .values({
      shopName: finalShopName,
      ownerName: finalOwnerName,
      username: phone,
      passwordHash,
      phone,
      role: "retailer",
      vendorId: wholesaler.id,
    });

  res.status(201).json({
    message: "Retailer registered successfully and linked to wholesaler: " + wholesaler.shopName,
  });
});

export default router;
