import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, ArrowRight, Store, Mail, Phone, Lock, User, MapPin, Hash } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function SignupRetailer() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    address: "",
    username: "",
    password: "",
    phone: "",
    email: "",
    vendorId: "",
    otp: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shopName || !form.username || !form.password || !form.email || !form.vendorId) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/send-retailer-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, vendorId: form.vendorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      setOtpSent(true);
      toast.success(`Verification code sent to ${form.email}`);
    } catch (err: any) {
      toast.error(err.message || "Error sending verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.otp) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/retailer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: form.shopName,
          ownerName: form.ownerName,
          address: form.address,
          username: form.username,
          password: form.password,
          phone: form.phone ? `+91${form.phone}` : undefined,
          email: form.email,
          vendorId: form.vendorId,
          otp: form.otp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      setSuccess(true);
      toast.success(data.message || "Account created successfully!");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-amber-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-t-4 border-t-green-500 shadow-2xl text-center p-6">
          <CardHeader className="flex flex-col items-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <CardTitle className="font-serif text-3xl font-bold">Registration Successful!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your Retailer account is ready and linked to your Wholesaler.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-sm text-green-800">
              You can now log in with your <strong>User ID</strong> and <strong>Password</strong> to browse your wholesaler's catalog.
            </div>
            <Button className="w-full py-6 text-base bg-orange-600 hover:bg-orange-700" onClick={() => setLocation("/login")}>
              Go to Login <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-amber-50 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Logo className="w-16 h-16 shadow-lg rounded-xl p-2 bg-card" strokeColor="#ea580c" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Retailer Sign Up</h1>
          <p className="text-muted-foreground mt-2">Connect with your Wholesaler on SupplyGrid</p>
        </div>

        <Card className="border-t-4 border-t-orange-600 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="font-serif text-2xl">Retailer Registration</CardTitle>
            <CardDescription>Create your account and link to your wholesaler</CardDescription>
          </CardHeader>
          <CardContent>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                {/* Row 1: Shop Name + Owner Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-orange-500" /> Shop Name *
                    </label>
                    <Input name="shopName" value={form.shopName} onChange={handleChange} placeholder="Krishna Provision Store" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-orange-500" /> Owner Name
                    </label>
                    <Input name="ownerName" value={form.ownerName} onChange={handleChange} placeholder="Kirit Bhai" />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" /> Shop Address
                  </label>
                  <Input name="address" value={form.address} onChange={handleChange} placeholder="123 Market Street, Ahmedabad" />
                </div>

                {/* User ID */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-orange-500" /> User ID (Login Username) *
                  </label>
                  <Input
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="e.g. krishna_store"
                    required
                    autoComplete="username"
                  />
                  <p className="text-xs text-muted-foreground">You will use this to log in.</p>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange-500" /> Password *
                  </label>
                  <Input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a secure password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                {/* Mobile */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-orange-500" /> Mobile Number
                  </label>
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
                      className="pl-20 text-base"
                      maxLength={10}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-orange-500" /> Email Address * (for OTP)
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {/* Vendor ID */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-orange-600 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> Wholesaler Vendor ID *
                  </label>
                  <Input
                    name="vendorId"
                    value={form.vendorId}
                    onChange={(e) => setForm(p => ({ ...p, vendorId: e.target.value.toUpperCase() }))}
                    placeholder="e.g. WH-K2L8B"
                    className="border-orange-400 focus-visible:ring-orange-500 uppercase font-mono font-bold tracking-widest text-center text-lg"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Ask your wholesaler for their Vendor ID.</p>
                </div>

                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 py-6 mt-2 text-base font-semibold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Mail className="mr-2 h-4 w-4" />
                  Verify & Send OTP to Email
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndRegister} className="space-y-5">
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-sm text-center">
                  <Mail className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-orange-800 font-medium">Check your inbox!</p>
                  <p className="text-orange-700 mt-1">A 6-digit code was sent to <strong>{form.email}</strong></p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-center block">Enter 6-Digit Verification Code</label>
                  <Input
                    name="otp"
                    value={form.otp}
                    onChange={handleChange}
                    placeholder="_ _ _ _ _ _"
                    className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                    maxLength={6}
                    required
                    autoFocus
                    inputMode="numeric"
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-1/3 py-6"
                    onClick={() => { setOtpSent(false); setForm(p => ({ ...p, otp: "" })); }}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-2/3 py-6 bg-orange-600 hover:bg-orange-700 text-white font-semibold" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify & Create Account
                  </Button>
                </div>

                <button
                  type="button"
                  className="text-sm text-center w-full text-muted-foreground hover:text-orange-600 underline underline-offset-2 mt-1"
                  onClick={handleSendOtp}
                  disabled={loading}
                >
                  Resend Code
                </button>
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
