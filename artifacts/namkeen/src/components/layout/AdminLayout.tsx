import { ReactNode, useState, useEffect } from "react";
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
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const logout = useLogout();
  const { data: summary } = useGetDashboardSummary({
    year: new Date().getFullYear(),
    month: "all",
  } as any);

  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "subaccounts">("profile");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    shopName: "",
    phone: "",
    address: "",
    gst_number: "",
    username: "",
    password: "",
  });

  // Sub-accounts states
  const [subAccounts, setSubAccounts] = useState<{ staff: any[]; retailers: any[] }>({ staff: [], retailers: [] });
  const [loadingSubAccounts, setLoadingSubAccounts] = useState(false);
  const [subType, setSubType] = useState<"staff" | "retailer">("staff");
  const [subUsername, setSubUsername] = useState("");
  const [subPassword, setSubPassword] = useState("");
  const [subName, setSubName] = useState("");
  const [subPhone, setSubPhone] = useState("");
  const [subSaving, setSubSaving] = useState(false);

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
          username: data.username || "",
          password: "",
        });
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchSubAccounts = async () => {
    setLoadingSubAccounts(true);
    try {
      const res = await fetch("/api/wholesaler/sub-accounts", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSubAccounts(data);
      }
    } catch (err) {
      console.error("Failed to load sub-accounts", err);
    } finally {
      setLoadingSubAccounts(false);
    }
  };

  useEffect(() => {
    if (showProfileSettings && settingsTab === "subaccounts") {
      fetchSubAccounts();
    }
  }, [showProfileSettings, settingsTab]);

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

  const handleCreateSubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subUsername.trim() || !subPassword || !subName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "All fields are required" });
      return;
    }

    setSubSaving(true);
    try {
      const res = await fetch("/api/wholesaler/sub-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: subType,
          username: subUsername.trim(),
          password: subPassword,
          name: subName.trim(),
          phone: subPhone.trim(),
        }),
        credentials: "include",
      });

      if (res.ok) {
        toast({
          title: "Sub-Account Created",
          description: `Active ${subType === "staff" ? "staff" : "retailer"} sub-account has been successfully created.`,
        });
        setSubUsername("");
        setSubPassword("");
        setSubName("");
        setSubPhone("");
        fetchSubAccounts();
      } else {
        const errData = await res.json();
        toast({
          variant: "destructive",
          title: "Error",
          description: errData.message || "Failed to create sub-account",
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setSubSaving(false);
    }
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem('supplygrid_token');
        localStorage.clear();
        try {
          // @ts-ignore
          if (typeof axios !== 'undefined') {
            // @ts-ignore
            delete axios.defaults.headers.common['Authorization'];
          }
        } catch (e) {}
        queryClient.clear();
        window.location.href = '/login';
      },
      onError: () => {
        localStorage.removeItem('supplygrid_token');
        localStorage.clear();
        try {
          // @ts-ignore
          if (typeof axios !== 'undefined') {
            // @ts-ignore
            delete axios.defaults.headers.common['Authorization'];
          }
        } catch (e) {}
        queryClient.clear();
        window.location.href = '/login';
      },
    });
  };

  if (userLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user?.authenticated || (user.role !== "admin" && user.role !== "wholesaler")) {
    if (user?.role === "super_admin") {
      setLocation("/super-admin");
      return null;
    }
    setLocation("/login");
    return null;
  }

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

      <Dialog open={showProfileSettings} onOpenChange={(open) => {
        setShowProfileSettings(open);
        if (!open) {
          setSettingsTab("profile");
        }
      }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Account Options & Sub-Accounts</DialogTitle>
            <DialogDescription>
              Manage your wholesaler profile details and configure active staff/retailer sub-accounts.
            </DialogDescription>
          </DialogHeader>

          {/* Premium Custom Tabs */}
          <div className="flex border-b mb-6">
            <button
              type="button"
              onClick={() => setSettingsTab("profile")}
              className={`flex-1 pb-3 font-semibold text-sm transition-colors border-b-2 text-center cursor-pointer ${
                settingsTab === "profile"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Profile Details
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab("subaccounts")}
              className={`flex-1 pb-3 font-semibold text-sm transition-colors border-b-2 text-center cursor-pointer ${
                settingsTab === "subaccounts"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Sub-Accounts
            </button>
          </div>

          {settingsTab === "profile" && (
            profileLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading profile details...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profileData.username || ""}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    placeholder="e.g. patel1008"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password (Leave blank to keep current)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={profileData.password || ""}
                    onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                    placeholder="Enter new password"
                  />
                </div>

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
            )
          )}

          {settingsTab === "subaccounts" && (
            <div className="space-y-6 py-2">
              <form onSubmit={handleCreateSubAccount} className="space-y-4 border-b pb-6 mb-6">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Create New Sub-Account</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="subType">Account Type</Label>
                    <select
                      id="subType"
                      value={subType}
                      onChange={(e) => setSubType(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="staff">Staff (Accesses Wholesaler Board)</option>
                      <option value="retailer">Retailer (Stores Orders/Pricing)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="subName">{subType === "staff" ? "Full Name" : "Shop Name"}</Label>
                    <Input
                      id="subName"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder={subType === "staff" ? "e.g. Ramesh Patel" : "e.g. Ramesh Provisions"}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="subUsername">Username</Label>
                    <Input
                      id="subUsername"
                      value={subUsername}
                      onChange={(e) => setSubUsername(e.target.value)}
                      placeholder="Enter login username"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="subPassword">Password</Label>
                    <Input
                      id="subPassword"
                      type="password"
                      value={subPassword}
                      onChange={(e) => setSubPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="subPhone">Phone (Optional)</Label>
                    <Input
                      id="subPhone"
                      value={subPhone}
                      onChange={(e) => setSubPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full font-semibold" disabled={subSaving}>
                      {subSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Create Sub-Account
                    </Button>
                  </div>
                </div>
              </form>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Existing Sub-Accounts</h4>
                {loadingSubAccounts ? (
                  <div className="py-6 flex items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading accounts...</span>
                  </div>
                ) : subAccounts.staff.length === 0 && subAccounts.retailers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No sub-accounts created yet.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b font-semibold text-muted-foreground">
                          <th className="px-4 py-2">Username</th>
                          <th className="px-4 py-2">Name / Shop Name</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subAccounts.staff.map((s: any) => (
                          <tr key={s.id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-2 font-mono">{s.username}</td>
                            <td className="px-4 py-2">{s.name}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                Staff
                              </span>
                            </td>
                            <td className="px-4 py-2">{s.phone || "—"}</td>
                          </tr>
                        ))}
                        {subAccounts.retailers.map((r: any) => (
                          <tr key={r.id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-2 font-mono">{r.username}</td>
                            <td className="px-4 py-2">{r.shopName}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                Retailer
                              </span>
                            </td>
                            <td className="px-4 py-2">{r.phone || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
