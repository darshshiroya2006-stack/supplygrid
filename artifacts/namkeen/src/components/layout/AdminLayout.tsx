import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey, useGetDashboardSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  MessageSquare,
  Warehouse,
  LogOut,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/stock", label: "Stock Ledger", icon: Warehouse },
  { href: "/admin/inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/admin/recent-activity", label: "Recent Activity", icon: Activity },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();
  const { data: summary } = useGetDashboardSummary({
    year: new Date().getFullYear(),
    month: "all",
  } as any);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="flex h-screen bg-muted/30">
      <aside className="w-64 bg-card border-r flex flex-col hidden md:flex">
        <div className="p-6 border-b">
          <Link href="/admin">
            <div className="cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-3">
              <Logo className="w-8 h-8 shrink-0" />
              <h1 className="text-2xl font-serif font-bold text-primary truncate">
                {user?.shopName || "SupplyGrid"}
              </h1>
            </div>
          </Link>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {user?.role === "wholesaler" ? "Wholesaler Distributor" : "Supply Chain Network"}
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (location.startsWith(item.href) && item.href !== '/admin');
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-card-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.label === "Orders" && summary?.newOrdersCount && summary.newOrdersCount > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-background">
                      {summary.newOrdersCount}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium">{user?.name || "Admin"}</p>
            <p className="text-xs text-muted-foreground truncate uppercase">{user?.role || "Administrator"}</p>
            {user?.uniqueVendorId && (
              <div className="mt-2 bg-primary/10 border border-primary/20 p-2 rounded-lg text-center">
                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider block">Vendor ID</span>
                <span className="text-sm font-mono font-bold text-primary select-all">{user.uniqueVendorId}</span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={() => setShowLogoutAlert(true)}
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4" />
            {logout.isPending ? "Logging out…" : "Logout"}
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden bg-card border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Logo className="w-7 h-7 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-serif font-bold text-primary truncate">{user?.shopName || "SupplyGrid"}</h1>
              {user?.uniqueVendorId && (
                <span className="text-[10px] font-mono text-muted-foreground font-semibold">Vendor ID: {user.uniqueVendorId}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowLogoutAlert(true)} disabled={logout.isPending}>
            <LogOut className="w-5 h-5" />
          </Button>
        </header>

        {/* Mobile Nav */}
        <div className="md:hidden overflow-x-auto flex border-b bg-card p-2 gap-2 hide-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (location.startsWith(item.href) && item.href !== '/admin');
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center whitespace-nowrap gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-card-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.label === "Orders" && summary?.newOrdersCount && summary.newOrdersCount > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white shadow-sm ring-1 ring-background ml-0.5">
                      {summary.newOrdersCount}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <AlertDialog open={showLogoutAlert} onOpenChange={setShowLogoutAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out of the SupplyGrid Dashboard?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
              disabled={logout.isPending}
            >
              Confirm Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
