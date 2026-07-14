import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Package, LogOut, Menu, ArrowLeftRight, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useCart } from "@/hooks/use-cart";
import { useWholesalerStore } from "@/hooks/use-wholesaler";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";

export function ShopLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();
  const itemCount = useCart((state: { getItemCount: () => number }) => state.getItemCount());
  const { selectedWholesaler } = useWholesalerStore();

  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    address: "",
  });

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/retailer/profile", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProfileData({
          shopName: data.shopName || "",
          ownerName: data.ownerName || "",
          phone: data.phone || "",
          address: data.address || "",
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
      const res = await fetch("/api/retailer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Profile updated successfully!");
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setShowProfileSettings(false);
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to update profile");
      }
    } catch (err) {
      console.error("Failed to save profile", err);
      toast.error("An unexpected error occurred while saving profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem('supplygrid_token');
        useCart.getState().clearCart();
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        localStorage.removeItem('supplygrid_token');
        useCart.getState().clearCart();
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-card border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
                      <Link href="/shop">
              <div className="cursor-pointer flex items-center gap-3">
                <Logo className="w-8 h-8 shrink-0" />
                <div>
                  <h1 className="text-2xl font-serif font-bold text-primary leading-tight">
                    {selectedWholesaler?.shopName || user?.wholesalerShopName || "SupplyGrid"}
                  </h1>
                  {(selectedWholesaler || user?.wholesalerShopName) && (
                    <span className="text-[10px] text-muted-foreground block -mt-1 font-sans font-medium">
                      Shopping from: {selectedWholesaler?.shopName || user?.wholesalerShopName}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/shop">
                <Button variant={location === "/shop" ? "default" : "ghost"}>
                  <Package className="w-4 h-4 mr-2" />
                  Products
                </Button>
              </Link>
              <Link href="/shop/orders">
                <Button variant={location.startsWith("/shop/orders") ? "default" : "ghost"}>
                  Orders
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
                        {/* Switch Wholesaler button — only for retailers with multiple options */}
            {(user?.role === "retailer" || user?.role === "customer") && (
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex items-center gap-1.5 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => setLocation("/retailer")}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Switch
              </Button>
            )}
            <Link href="/shop/cart">
              <Button variant="outline" className="relative">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Cart
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Desktop user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden md:flex gap-2">
                  <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-sm font-medium leading-none">{user?.shopName || user?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">Retailer</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.shopName || user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.name}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setShowProfileSettings(true);
                    fetchProfile();
                  }}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{logout.isPending ? "Logging out…" : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/shop" className="w-full cursor-pointer">
                    <Package className="mr-2 h-4 w-4" />
                    Products
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/shop/orders" className="w-full cursor-pointer">
                    Orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setShowProfileSettings(true);
                    fetchProfile();
                  }}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{logout.isPending ? "Logging out…" : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <Dialog open={showProfileSettings} onOpenChange={setShowProfileSettings}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Edit Retailer Profile</DialogTitle>
            <DialogDescription>
              Update your shop name, contact name, phone, and default delivery address.
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
                <Label htmlFor="custShopName">Shop Name</Label>
                <Input
                  id="custShopName"
                  value={profileData.shopName}
                  onChange={(e) => setProfileData({ ...profileData, shopName: e.target.value })}
                  placeholder="e.g. Ghanshyam Namkeen"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custOwnerName">Contact Name</Label>
                <Input
                  id="custOwnerName"
                  value={profileData.ownerName}
                  onChange={(e) => setProfileData({ ...profileData, ownerName: e.target.value })}
                  placeholder="e.g. Darsh Bhai"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custPhone">Phone Number</Label>
                <Input
                  id="custPhone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custAddress">Delivery Address</Label>
                <Textarea
                  id="custAddress"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  placeholder="Enter full delivery address"
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
