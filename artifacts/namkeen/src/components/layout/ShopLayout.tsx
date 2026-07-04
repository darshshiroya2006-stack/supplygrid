import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Package, LogOut, Menu, ArrowLeftRight } from "lucide-react";
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

export function ShopLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();
  const itemCount = useCart((state: { getItemCount: () => number }) => state.getItemCount());
  const { selectedWholesaler } = useWholesalerStore();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        useCart.getState().clearCart();
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        useCart.getState().clearCart();
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-card border-b sticky top-0 z-10">
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
    </div>
  );
}
