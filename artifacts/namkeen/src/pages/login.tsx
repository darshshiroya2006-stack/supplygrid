import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLogin, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogin();

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "reset">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("OTP sent to your email!");
        setForgotStep("otp");
      } else {
        toast.error(data.message || "Failed to send OTP.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp) return;
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("OTP verified!");
        setForgotStep("reset");
      } else {
        toast.error(data.message || "Invalid OTP.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password reset successfully! Please log in.");
        setShowForgotPassword(false);
        setForgotStep("email");
        setForgotEmail("");
        setForgotOtp("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setForgotLoading(false);
    }
  };

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    login.mutate({ data: values }, {
      onSuccess: (session) => {
        const token = (session as any).token;
        if (token) {
          localStorage.setItem('supplygrid_token', token);
          try {
            // @ts-ignore
            if (typeof axios !== 'undefined') {
              // @ts-ignore
              axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            }
          } catch (e) {}
        }
        toast.success("Logged in successfully");
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        
        const isWholesaler = session.role === 'wholesaler' || session.role === 'admin' || session.role === 'super_admin';
        if (session.role === 'super_admin') {
          window.location.href = '/super-admin';
        } else {
          window.location.href = isWholesaler ? '/admin/products' : '/retailer/dashboard';
        }
      },
      onError: (error) => {
        toast.error(error.data?.message || "Invalid credentials");
        if (error.status === 401) {
          setTimeout(() => {
            setLocation("/");
            setTimeout(() => {
              const el = document.getElementById("contact");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }, 200);
          }, 1500);
        }
      }
    });
  }


  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Logo className="w-16 h-16 shadow-lg rounded-xl p-2 bg-card" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            SupplyGrid
          </h1>
          <p className="text-muted-foreground mt-2">Retailer & Wholesaler Portal</p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-xl">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username / Email / Mobile</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username, email or mobile" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password" {...field} />
                      </FormControl>
                      <div className="flex justify-end mt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full text-base py-6" disabled={login.isPending}>
                  {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={(open) => {
        setShowForgotPassword(open);
        if (!open) {
          setForgotStep("email");
          setForgotEmail("");
          setForgotOtp("");
          setNewPassword("");
          setConfirmPassword("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Reset Password</DialogTitle>
            <DialogDescription>
              {forgotStep === "email" && "Enter your registered email address to receive a 6-digit verification code."}
              {forgotStep === "otp" && "Enter the 6-digit code sent to your email address."}
              {forgotStep === "reset" && "Create a secure new password for your account."}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowForgotPassword(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Code
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="forgot-otp">Verification Code</Label>
                <Input
                  id="forgot-otp"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  required
                />
              </div>
              <DialogFooter className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setForgotStep("email")}>
                  Back
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Code
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={forgotLoading} className="w-full">
                  {forgotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reset Password
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
