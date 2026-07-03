import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SignupRetailer() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    vendorId: "",
    password: "",
    otp: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const setupRecaptcha = () => {
    if ((window as any).recaptchaVerifier) return;
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {
        console.log("Firebase reCAPTCHA solved");
      },
    });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shopName || !form.ownerName || !form.phone || !form.vendorId || !form.password) {
      toast.error("Please fill in all fields first");
      return;
    }

    setLoading(true);
    try {
      // Validate wholesaler vendor ID exists
      const res = await fetch("/api/auth/signup/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, vendorId: form.vendorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to validate Vendor ID");

      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = form.phone.startsWith("+") ? form.phone : `+91${form.phone}`;

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      toast.success(`Verification code sent to ${form.phone}`);
    } catch (err: any) {
      console.error("Firebase send-otp failed:", err);
      if (err.code === "auth/operation-not-allowed") {
        toast.error("Firebase Phone Authentication is disabled. Please enable the 'Phone' sign-in provider in the Firebase Console (Authentication > Sign-in method) for the project supplygrid-393bf.");
      } else {
        toast.error(err.message || "Error validating Vendor ID or sending OTP");
      }
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch {}
        (window as any).recaptchaVerifier = null;
      }
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
      let idToken = "";
      if (!confirmationResult) {
        throw new Error("Verification session not found. Please click resend code.");
      }
      const result = await confirmationResult.confirm(form.otp);
      idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/signup/retailer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          vendorId: form.vendorId,
          password: form.password,
          firebaseToken: idToken,
          shopName: form.shopName,
          ownerName: form.ownerName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      setSuccess(true);
      toast.success("Retailer account created and linked successfully!");
    } catch (err: any) {
      console.error("Firebase verification failed:", err);
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
              Your Retailer (રીટેલર) account is ready. You are linked to your Wholesaler.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-xl text-sm text-muted-foreground my-2">
              You can now log in using your Mobile Number as the username and view your wholesaler's catalog.
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
            <Logo className="w-16 h-16 shadow-lg rounded-xl p-2 bg-card" strokeColor="#ea580c" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Retailer Signup</h1>
          <p className="text-muted-foreground mt-2">Connect with your Wholesaler on SupplyGrid</p>
        </div>

        <Card className="border-t-4 border-t-orange-600 shadow-xl">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Retailer Registration</CardTitle>
            <CardDescription>Enter details to link with your supplier</CardDescription>
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
                    placeholder="e.g. Krishna Provision Store"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Owner Name (માલિકનું નામ)</label>
                  <Input
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    placeholder="e.g. Kirit Bhai"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-600 font-bold">
                    Unique Wholesaler Vendor ID (WH-XXXXX)
                  </label>
                  <Input
                    name="vendorId"
                    value={form.vendorId}
                    onChange={handleChange}
                    placeholder="e.g. WH-K2L8B"
                    className="border-orange-500 focus-visible:ring-orange-500 uppercase font-mono font-bold tracking-wider"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Mobile Number (login username)</label>
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
                    placeholder="Create your login password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 py-6 mt-4 text-base" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Vendor ID & Send OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-sm text-green-700 text-center mb-2">
                  OTP sent to <strong>{form.phone}</strong>.
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
                  <Button type="submit" className="w-2/3 py-6 bg-orange-600 hover:bg-orange-700 text-white" disabled={loading}>
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
