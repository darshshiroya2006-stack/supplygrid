import "express-session";

declare module "express-session" {
  interface SessionData {
    role?: "admin" | "wholesaler" | "retailer" | "customer";
    userId?: number;
    name?: string;
    shopName?: string;
    uniqueVendorId?: string;
    signupOtp?: string;
    signupOtpExpiry?: number;
    signupPhone?: string;
  }
}

import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.role !== "admin" && req.session.role !== "wholesaler") {
    res.status(401).json({ message: "Admin or Wholesaler authentication required" });
    return;
  }
  next();
}

export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  if (req.session.role !== "retailer" && req.session.role !== "customer" || !req.session.userId) {
    res.status(401).json({ message: "Customer/Retailer authentication required" });
    return;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.role) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  next();
}
