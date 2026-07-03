import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
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
        toast.success("Logged in successfully");
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        
        if (session.role === 'admin' || session.role === 'wholesaler') {
          setLocation("/admin");
        } else {
          setLocation("/shop");
        }
      },
      onError: (error) => {
        toast.error(error.data?.message || "Invalid credentials");
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
            
            <div className="mt-8 pt-6 border-t flex flex-col gap-3 text-center">
              <span className="text-xs text-muted-foreground">New to SupplyGrid?</span>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" className="w-1/2 py-5 text-xs text-primary font-semibold" onClick={() => setLocation("/signup/wholesaler")}>
                  Wholesaler Sign Up
                </Button>
                <Button variant="outline" className="w-1/2 py-5 text-xs text-orange-600 font-semibold border-orange-200 hover:bg-orange-50" onClick={() => setLocation("/signup/retailer")}>
                  Retailer Sign Up
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
