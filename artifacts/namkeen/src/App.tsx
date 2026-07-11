import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
