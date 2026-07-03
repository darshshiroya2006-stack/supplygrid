import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function SignupWholesaler() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [success, setSuccess] = useState(false);
  const [vendorId, setVendorId] = useState("");

  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    username: "",
    phone: "",
    email: "",
    password: "",
    otp: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shopName || !form.ownerName || !form.username || !form.phone || !form.email || !form.password) {
      toast.error("Please fill in all fields first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, phone: form.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send verification OTP");

      setOtpSent(true);
      toast.success("Verification 6-digit OTP code has been sent to your email!");
    } catch (err: any) {
      console.error("Email OTP dispatch failed:", err);
      toast.error(err.message || "Failed to send verification email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.otp) {
      toast.error("Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/wholesaler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: form.shopName,
          ownerName: form.ownerName,
          username: form.username,
          phone: form.phone,
          email: form.email,
          password: form.password,
          otp: form.otp,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      setVendorId(data.uniqueVendorId);
      setSuccess(true);
      toast.success("Wholesaler account created successfully!");
    } catch (err: any) {
      console.error("OTP verification failed:", err);
      toast.error(err.message || "Registration failed during verification");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-t-4 border-t-green-500 shadow-xl text-center p-6">
          <CardHeader className="flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <CardTitle className="font-serif text-3xl font-bold">Registration Successful!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your Wholesaler (વેપારી) account has been created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-xl border border-dashed border-muted-foreground/30 my-4">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                Your Unique Vendor ID
              </span>
              <span className="text-3xl font-mono font-bold text-primary block mt-1 tracking-wide select-all">
                {vendorId}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-2">
                (Share this with your retailers so they can connect and place orders)
              </span>
            </div>
            <Button className="w-full py-6 text-base" onClick={() => setLocation("/login")}>
              Go to Login <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Logo className="w-16 h-16 shadow-lg rounded-xl p-2 bg-card" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Wholesaler Signup</h1>
          <p className="text-muted-foreground mt-2">Register on the SupplyGrid B2B Network</p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-xl">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Create Distributor Account</CardTitle>
            <CardDescription>Enter your shop & contact details below</CardDescription>
          </CardHeader>
          <CardContent>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Shop Name (દુકાનનું નામ)</label>
                  <Input
                    name="shopName"
                    value={form.shopName}
                    onChange={handleChange}
                    placeholder="e.g. Maruti Distributors"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Owner Name (માલિકનું નામ)</label>
                  <Input
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    placeholder="e.g. Ramesh Patel"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Username (યુઝરનેમ)</label>
                  <Input
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="e.g. ramesh_patel"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="e.g. name@supplygrid.com"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none gap-2 border-r pr-2 my-2 border-input">
                      <span className="text-base select-none">🇮🇳</span>
                      <span className="text-sm font-semibold text-muted-foreground select-none">+91</span>
                    </div>
                    <Input
                      name="phone"
                      value={form.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setForm((prev) => ({ ...prev, phone: val }));
                      }}
                      placeholder="9876543210"
                      className="pl-20 text-base py-6"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a strong password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full py-6 mt-4 text-base" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-sm text-green-700 text-center mb-2">
                  6-digit verification code sent to <strong>{form.email}</strong>.
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Enter 6-Digit OTP Code</label>
                  <Input
                    name="otp"
                    value={form.otp}
                    onChange={handleChange}
                    placeholder="Enter OTP Code"
                    className="text-center text-lg tracking-widest font-mono"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="flex gap-2 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-1/3 py-6"
                    onClick={() => setOtpSent(false)}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-2/3 py-6" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify & Create Account
                  </Button>
                </div>
              </form>
            )}

            <div className="text-center mt-6 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button variant="link" className="p-0 h-auto font-semibold text-primary" onClick={() => setLocation("/login")}>
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
