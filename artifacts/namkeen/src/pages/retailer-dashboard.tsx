import { useState } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Store,
  Plus,
  ArrowRight,
  LogOut,
  Loader2,
  Building2,
  ChevronRight,
  CheckCircle2,
  Hash,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useWholesalerStore, LinkedWholesaler } from "@/hooks/use-wholesaler";

export default function RetailerDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetCurrentUser();
  const logout = useLogout();
  const { setSelectedWholesaler } = useWholesalerStore();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newVendorId, setNewVendorId] = useState("");
  const [linking, setLinking] = useState(false);

  const linkedWholesalers: LinkedWholesaler[] = (user as any)?.linkedWholesalers ?? [];

  const handleSelectWholesaler = (w: LinkedWholesaler) => {
    setSelectedWholesaler(w);
    setLocation("/shop");
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem('supplygrid_token');
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        localStorage.removeItem('supplygrid_token');
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const handleAddWholesaler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorId.trim()) return;
    setLinking(true);
    try {
      const res = await fetch("/api/auth/retailer/link-wholesaler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: newVendorId.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to link wholesaler");
      toast.success(data.message || "Wholesaler linked successfully!");
      setAddDialogOpen(false);
      setNewVendorId("");
      // Refresh user data to show new wholesaler
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
    } catch (err: any) {
      toast.error(err.message || "Failed to link wholesaler");
    } finally {
      setLinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user?.authenticated || (user.role !== "retailer" && user.role !== "customer")) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-amber-50">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8 shrink-0" strokeColor="#ea580c" />
            <div>
              <h1 className="font-serif text-lg font-bold leading-tight text-foreground">SupplyGrid</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Retailer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground">{user.shopName || user.name}</p>
              <p className="text-xs text-muted-foreground">{user.name}</p>
            </div>
            <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-sm">
              {(user.name || "R")[0].toUpperCase()}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Welcome Banner */}
        <div className="mb-8">
          <h2 className="text-3xl font-serif font-bold text-foreground">
            Welcome back, {user.shopName || user.name}! 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            Select a wholesaler to browse their catalog and place orders.
          </p>
        </div>

        {/* Wholesaler Cards */}
        {linkedWholesalers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-10 h-10 text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No Wholesalers Linked</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Add your first wholesaler using their Vendor ID to start browsing products and placing orders.
            </p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 px-8 py-5 text-base font-semibold"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Wholesaler
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {linkedWholesalers.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleSelectWholesaler(w)}
                  className="group text-left"
                >
                  <Card className="border-2 border-transparent group-hover:border-orange-400 group-hover:shadow-lg transition-all duration-200 cursor-pointer relative overflow-hidden">
                    {/* Accent stripe */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-amber-500" />
                    <CardContent className="p-5 pl-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center shrink-0">
                            <Store className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-serif text-lg font-bold text-foreground group-hover:text-orange-700 transition-colors">
                              {w.shopName || w.name}
                            </h3>
                            {w.uniqueVendorId && (
                              <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                                <Hash className="w-3 h-3" /> {w.uniqueVendorId}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all mt-1" />
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="font-medium">Linked</span>
                        </div>
                        <span className="text-xs text-muted-foreground">• Click to shop</span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}

              {/* Add New Wholesaler Card */}
              <button
                onClick={() => setAddDialogOpen(true)}
                className="group text-left"
              >
                <Card className="border-2 border-dashed border-muted-foreground/30 group-hover:border-orange-400 group-hover:shadow-md transition-all duration-200 cursor-pointer h-full min-h-[120px]">
                  <CardContent className="p-5 flex flex-col items-center justify-center h-full gap-2">
                    <div className="w-12 h-12 bg-orange-50 group-hover:bg-orange-100 rounded-xl flex items-center justify-center transition-colors">
                      <Plus className="w-6 h-6 text-orange-500" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground group-hover:text-orange-600 transition-colors">
                      Add New Wholesaler
                    </p>
                  </CardContent>
                </Card>
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {linkedWholesalers.length} wholesaler{linkedWholesalers.length !== 1 ? "s" : ""} linked to your account
            </p>
          </>
        )}
      </main>

      {/* Add Wholesaler Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Add New Wholesaler</DialogTitle>
            <DialogDescription>
              Enter the Wholesaler's unique Vendor ID to link them to your account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddWholesaler} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-orange-600">Wholesaler Vendor ID</label>
              <Input
                value={newVendorId}
                onChange={(e) => setNewVendorId(e.target.value.toUpperCase())}
                placeholder="e.g. WH-K2L8B"
                className="uppercase font-mono font-bold tracking-widest text-center text-lg h-12 border-orange-400 focus-visible:ring-orange-500"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Ask your wholesaler for their Vendor ID. It starts with WH- followed by 5 characters.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={linking || !newVendorId.trim()}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {linking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Link Wholesaler
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
