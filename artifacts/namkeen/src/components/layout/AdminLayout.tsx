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
  Settings,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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

  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    shopName: "",
    phone: "",
    address: "",
    gst_number: "",
  });
  const { toast } = useToast();

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/wholesaler/profile", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProfileData({
          shopName: data.shopName || "",
          phone: data.phone || "",
          address: data.address || "",
          gst_number: data.gst_number || "",
        });
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await fetch("/api/wholesaler/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
        credentials: "include",
      });
      if (res.ok) {
        toast({
          title: "Profile Updated",
          description: "Your wholesaler profile details have been saved successfully.",
        });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setShowProfileSettings(false);
      } else {
        const errData = await res.json();
        toast({
          variant: "destructive",
          title: "Error",
          description: errData.message || "Failed to update profile",
        });
      }
    } catch (err) {
      console.error("Failed to save profile", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while saving profile.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

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
      <aside className="w-64 bg-card border-r flex flex-col hidden md:flex print:hidden">
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
            className="w-full justify-start gap-3 mb-2 cursor-pointer print:hidden"
            onClick={() => {
              setShowProfileSettings(true);
              fetchProfile();
            }}
          >
            <Settings className="w-4 h-4" />
            Edit Profile
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 print:hidden"
            onClick={() => setShowLogoutAlert(true)}
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4" />
            {logout.isPending ? "Logging out…" : "Logout"}
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden bg-card border-b p-4 flex items-center justify-between print:hidden">
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
        <div className="md:hidden overflow-x-auto flex border-b bg-card p-2 gap-2 hide-scrollbar print:hidden">
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

      <Dialog open={showProfileSettings} onOpenChange={setShowProfileSettings}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Edit Wholesaler Profile</DialogTitle>
            <DialogDescription>
              Update your shop name, contact number, official GSTIN, and business address.
            </DialogDescription>
          </DialogHeader>

          {profileLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading profile details...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="shopName">Shop Name</Label>
                <Input
                  id="shopName"
                  value={profileData.shopName}
                  onChange={(e) => setProfileData({ ...profileData, shopName: e.target.value })}
                  placeholder="e.g. Patel General Store"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input
                  id="gstNumber"
                  value={profileData.gst_number}
                  onChange={(e) => setProfileData({ ...profileData, gst_number: e.target.value })}
                  placeholder="e.g. 24AAAAP1234A1Z1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Shop Address</Label>
                <Textarea
                  id="address"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  placeholder="Enter full billing address"
                  className="min-h-[80px]"
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setShowProfileSettings(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
