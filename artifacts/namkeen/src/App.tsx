import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter, useGetCurrentUser } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

// Initialize global headers/fetch interceptor immediately on module load
const initialToken = localStorage.getItem("supplygrid_token");
if (initialToken) {
  try {
    // @ts-ignore
    if (typeof axios !== 'undefined') {
      // @ts-ignore
      axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
    }
  } catch (e) {}
}

// 1. setAuthTokenGetter for customFetch
setAuthTokenGetter(() => localStorage.getItem("supplygrid_token"));

// 2. Global fetch override for standard fetch calls
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const currentToken = localStorage.getItem("supplygrid_token");
  if (currentToken) {
    let isApiUrl = false;
    if (typeof input === "string") {
      isApiUrl = input.startsWith("/") || input.includes(window.location.host);
    } else if (input instanceof URL) {
      isApiUrl = input.pathname.startsWith("/") || input.host === window.location.host;
    } else if (input && typeof input === "object" && "url" in input) {
      const urlStr = (input as any).url;
      isApiUrl = urlStr.startsWith("/") || urlStr.includes(window.location.host);
    }

    if (isApiUrl) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${currentToken}`);
      }
      return originalFetch(input, { ...init, headers });
    }
  }
  return originalFetch(input, init);
};

import Landing from "@/pages/index";
import Login from "@/pages/login";
import SignupWholesaler from "@/pages/signup-wholesaler";
import SignupRetailer from "@/pages/signup-retailer";
import RetailerDashboard from "@/pages/retailer-dashboard";
import SuperAdminDashboard from "@/pages/super-admin";
import NotFound from "@/pages/not-found";

// Shop pages
import ShopIndex from "@/pages/shop/index";
import ShopCart from "@/pages/shop/cart";
import ShopOrders from "@/pages/shop/orders";
import ShopOrderDetails from "@/pages/shop/order-details";

// Admin pages
import AdminIndex from "@/pages/admin/index";
import AdminProducts from "@/pages/admin/products";
import AdminCustomers from "@/pages/admin/customers";
import AdminCustomerPricing from "@/pages/admin/customer-pricing";
import AdminCustomerOrders from "@/pages/admin/customer-orders";
import AdminOrders from "@/pages/admin/orders";
import AdminOrderDetails from "@/pages/admin/order-details";
import AdminInquiries from "@/pages/admin/inquiries";
import AdminStock from "@/pages/admin/stock";
import AdminSupplierLedger from "@/pages/admin/supplier-ledger";
import AdminRecentActivity from "@/pages/admin/recent-activity";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup/wholesaler" component={SignupWholesaler} />
      <Route path="/signup/retailer" component={SignupRetailer} />
      <Route path="/retailer" component={RetailerDashboard} />
      <Route path="/retailer/dashboard" component={RetailerDashboard} />
      <Route path="/super-admin" component={SuperAdminDashboard} />
      
      {/* Shop Routes */}
      <Route path="/shop" component={ShopIndex} />
      <Route path="/shop/cart" component={ShopCart} />
      <Route path="/shop/orders" component={ShopOrders} />
      <Route path="/shop/orders/:id" component={ShopOrderDetails} />
      
      {/* Admin Routes */}
      <Route path="/admin" component={AdminIndex} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/admin/customers/:id/pricing" component={AdminCustomerPricing} />
      <Route path="/admin/customers/:id/orders" component={AdminCustomerOrders} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/orders/:id" component={AdminOrderDetails} />
      <Route path="/admin/inquiries" component={AdminInquiries} />
      <Route path="/admin/stock" component={AdminStock} />
      <Route path="/admin/stock/supplier/:id" component={AdminSupplierLedger} />
      <Route path="/admin/recent-activity" component={AdminRecentActivity} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useGetCurrentUser();
  const token = localStorage.getItem("supplygrid_token");

  // Determine if we are on login or landing route
  const isAuthRoute = location === "/" || location === "/login";

  useEffect(() => {
    if (token) {
      try {
        // @ts-ignore
        if (typeof axios !== 'undefined') {
          // @ts-ignore
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {}
    }
  }, [token]);

  useEffect(() => {
    // If token exists, is valid, and we are on an auth route, redirect to correct landing page
    if (token && user?.authenticated) {
      if (isAuthRoute) {
        const isWholesaler = user.role === "wholesaler" || user.role === "admin" || user.role === "super_admin";
        if (user.role === "super_admin") {
          setLocation("/super-admin");
        } else {
          setLocation(isWholesaler ? "/admin/products" : "/retailer/dashboard");
        }
      }
    } else if (token && !isLoading && !user?.authenticated) {
      // If token exists but verification failed, remove the invalid token
      localStorage.removeItem("supplygrid_token");
    }
  }, [token, user, isLoading, isAuthRoute, setLocation]);

  // If token exists and we are verifying on an auth route, show loading spinner to prevent flash of login page
  if (token && isAuthRoute && isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Checking session...</p>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGuard>
            <Router />
          </AuthGuard>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
