import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, LogOut, ShieldCheck, Building2, User, Phone, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PendingWholesaler {
  id: number;
  shopName: string | null;
  name: string;
  phone: string | null;
  gst_number: string | null;
  gstin: string | null;
}

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const logout = useLogout();
  
  const [pendingList, setPendingList] = useState<PendingWholesaler[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [actioningIds, setActioningIds] = useState<Record<number, "approve" | "reject">>({});

  useEffect(() => {
    if (!userLoading && (!user?.authenticated || user.role !== "super_admin")) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  const fetchPending = async () => {
    setLoadingPending(true);
    try {
      const res = await fetch("/api/super-admin/pending", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPendingList(data);
      } else {
        toast.error("Failed to load pending wholesalers list");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred while loading pending list");
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (user?.authenticated && user.role === "super_admin") {
      fetchPending();
    }
  }, [user]);

  const handleApprove = async (id: number) => {
    setActioningIds(prev => ({ ...prev, [id]: "approve" }));
    try {
      const res = await fetch(`/api/super-admin/approve/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Wholesaler approved successfully!");
        // Animate row removal by filtering it out after a brief delay
        setTimeout(() => {
          setPendingList(prev => prev.filter(item => item.id !== id));
        }, 150);
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to approve wholesaler");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setActioningIds(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const handleReject = async (id: number) => {
    setActioningIds(prev => ({ ...prev, [id]: "reject" }));
    try {
      const res = await fetch(`/api/super-admin/reject/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Wholesaler application rejected and removed!");
        // Animate row removal
        setTimeout(() => {
          setPendingList(prev => prev.filter(item => item.id !== id));
        }, 150);
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to reject wholesaler");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setActioningIds(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  if (userLoading || (user?.authenticated && user.role !== "super_admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      {/* Premium Header */}
      <header className="bg-card border-b shadow-sm sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-9 h-9 shadow-md rounded-lg p-1 bg-background" />
            <div>
              <h1 className="text-xl font-serif font-bold text-foreground">SupplyGrid</h1>
              <span className="text-[10px] text-primary uppercase font-bold tracking-wider block -mt-1">Super Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.name || "Super Admin"}</p>
              <p className="text-xs text-muted-foreground uppercase">{user?.role || "System Master"}</p>
            </div>
            <Button variant="ghost" size="icon" className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={handleLogout} disabled={logout.isPending}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shadow-xs mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Central Wholesaler Approvals
          </span>
          <h2 className="text-3xl font-serif font-bold text-foreground">Pending Wholesaler Registrations</h2>
          <p className="text-muted-foreground mt-1">Review, approve, or reject incoming wholesale merchant requests. Only approved accounts can access the platform.</p>
        </div>

        <Card className="border shadow-md overflow-hidden bg-card">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="text-lg font-serif">Applications Ledger</CardTitle>
            <CardDescription>Accounts waiting for system access permissions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingPending ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching pending accounts...</p>
              </div>
            ) : pendingList.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Building2 className="w-12 h-12 stroke-[1.2] text-muted-foreground/60" />
                <p className="font-semibold text-lg">No Pending Registrations</p>
                <p className="text-sm text-muted-foreground/80 max-w-xs text-center">All registered wholesaler merchant accounts have been approved and are active.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-4">Business / Shop Name</th>
                      <th className="px-6 py-4">Owner Name</th>
                      <th className="px-6 py-4">Mobile Number</th>
                      <th className="px-6 py-4">GST Number</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingList.map((item) => {
                      const isApproveLoading = actioningIds[item.id] === "approve";
                      const isRejectLoading = actioningIds[item.id] === "reject";
                      const isAnyLoading = !!actioningIds[item.id];

                      return (
                        <tr
                          key={item.id}
                          className="border-b hover:bg-muted/5 transition-colors duration-200"
                        >
                          <td className="px-6 py-4 font-medium text-foreground">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5" />
                              </div>
                              <span className="font-semibold">{item.shopName || "—"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-muted-foreground/60" />
                              <span>{item.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-muted-foreground/60" />
                              <span>{item.phone || "—"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground/60" />
                              <span>{item.gst_number || item.gstin || "—"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                                onClick={() => handleApprove(item.id)}
                                disabled={isAnyLoading}
                              >
                                {isApproveLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="font-semibold flex items-center gap-1.5"
                                onClick={() => handleReject(item.id)}
                                disabled={isAnyLoading}
                              >
                                {isRejectLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
