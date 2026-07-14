import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Loader2, CheckCircle2, XCircle, LogOut, ShieldCheck, Building2, 
  User, Phone, FileText, MapPin, Mail, MessageSquare, Trash2, Power 
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Inquiry {
  id: number;
  name: string;
  shopName: string;
  address: string;
  phone: string;
  gstNumber?: string | null;
  email?: string | null;
  message: string;
  createdAt: string;
}

interface RegisteredMerchant {
  id: number;
  username: string;
  shopName: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  uniqueVendorId: string | null;
  status: "ACTIVE" | "DEACTIVATED";
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const logout = useLogout();
  
  // Inquiries State
  const [inquiriesList, setInquiriesList] = useState<Inquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(true);
  
  // Registered Merchants State
  const [merchantsList, setMerchantsList] = useState<RegisteredMerchant[]>([]);
  const [loadingMerchants, setLoadingMerchants] = useState(true);

  // Accept Modal State
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [initialUsername, setInitialUsername] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [submittingAccept, setSubmittingAccept] = useState(false);

  const [actioningIds, setActioningIds] = useState<Record<number, "approve" | "reject">>({});

  useEffect(() => {
    if (!userLoading && (!user?.authenticated || user.role !== "super_admin")) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  const fetchInquiries = async () => {
    setLoadingInquiries(true);
    try {
      const res = await fetch("/api/inquiries", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setInquiriesList(data);
      } else {
        toast.error("Failed to load inquiries list");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred while loading inquiries");
    } finally {
      setLoadingInquiries(false);
    }
  };

  const fetchMerchants = async () => {
    setLoadingMerchants(true);
    try {
      const res = await fetch("/api/super-admin/merchants", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMerchantsList(data);
      } else {
        toast.error("Failed to load registered merchants");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred while loading merchants");
    } finally {
      setLoadingMerchants(false);
    }
  };

  useEffect(() => {
    if (user?.authenticated && user.role === "super_admin") {
      fetchInquiries();
      fetchMerchants();
    }
  }, [user]);

  const handleOpenAcceptModal = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setInitialUsername(inquiry.name.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.floor(100 + Math.random() * 900));
    setInitialPassword(Math.random().toString(36).slice(-8));
    setShowAcceptModal(true);
  };

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !initialUsername || !initialPassword) {
      toast.error("Username and Password are required");
      return;
    }
    setSubmittingAccept(true);
    try {
      const res = await fetch(`/api/super-admin/accept-inquiry/${selectedInquiry.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: initialUsername, password: initialPassword }),
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Merchant account created and activated successfully!");
        setShowAcceptModal(false);
        setInitialUsername("");
        setInitialPassword("");
        setSelectedInquiry(null);
        fetchInquiries();
        fetchMerchants();
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to accept partner request");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setSubmittingAccept(false);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("Are you sure you want to reject and delete this partner inquiry?")) return;
    setActioningIds(prev => ({ ...prev, [id]: "reject" }));
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Partner inquiry rejected successfully.");
        setInquiriesList(prev => prev.filter(item => item.id !== id));
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to reject inquiry");
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

  const handleToggleStatus = async (id: number, currentStatus: "ACTIVE" | "DEACTIVATED") => {
    const nextStatus = currentStatus === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    const statusLabel = nextStatus === "ACTIVE" ? "activated" : "deactivated";
    try {
      const res = await fetch(`/api/super-admin/merchants/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
        credentials: "include",
      });
      if (res.ok) {
        toast.success(`Merchant status updated to ${nextStatus}`);
        setMerchantsList(prev =>
          prev.map(m => (m.id === id ? { ...m, status: nextStatus } : m))
        );
      } else {
        const errData = await res.json();
        toast.error(errData.message || `Failed to update status to ${nextStatus}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    }
  };

  const handleDeleteMerchant = async (id: number) => {
    if (!confirm("Are you sure you want to completely delete this registered merchant? All their credentials will be completely purged from the system. This action is irreversible.")) {
      return;
    }
    try {
      const res = await fetch(`/api/super-admin/merchants/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Merchant credentials completely purged from the system.");
        setMerchantsList(prev => prev.filter(m => m.id !== id));
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Failed to delete merchant");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
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
            <Button variant="ghost" size="icon" className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer" onClick={handleLogout} disabled={logout.isPending}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Applications Ledger Section */}
        <div>
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shadow-xs mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> B2B Partner Onboarding
            </span>
            <h2 className="text-2xl font-serif font-bold text-foreground">Pending Partner Inquiries</h2>
            <p className="text-muted-foreground text-sm">Review incoming B2B partner requests, accept inquiries to set up active credentials, or reject requests.</p>
          </div>

          <Card className="border shadow-md overflow-hidden bg-card">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg font-serif">Applications Ledger</CardTitle>
              <CardDescription>Partner requests awaiting credentials generation</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingInquiries ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Fetching inquiries...</p>
                </div>
              ) : inquiriesList.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Building2 className="w-12 h-12 stroke-[1.2] text-muted-foreground/60" />
                  <p className="font-semibold text-lg">No Pending Partner Inquiries</p>
                  <p className="text-sm text-muted-foreground/80 max-w-xs text-center">There are no new B2B registration inquiries at the moment.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-6 py-4">Business / Shop</th>
                        <th className="px-6 py-4">Merchant / Contact</th>
                        <th className="px-6 py-4">GST Number</th>
                        <th className="px-6 py-4">Address & Message</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiriesList.map((item) => {
                        const isRejectLoading = actioningIds[item.id] === "reject";
                        const isAnyLoading = !!actioningIds[item.id];

                        return (
                          <tr key={item.id} className="border-b hover:bg-muted/5 transition-colors duration-200">
                            <td className="px-6 py-4 font-medium text-foreground">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="font-semibold block">{item.shopName}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{new Date(item.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <User className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  <span>{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  <span>{item.phone}</span>
                                </div>
                                {item.email && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Mail className="w-3.5 h-3.5 text-muted-foreground/60" />
                                    <span>{item.email}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground/60" />
                                <span>{item.gstNumber || "—"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground max-w-xs">
                              <div className="space-y-1 text-xs">
                                <div className="flex items-start gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{item.address}</span>
                                </div>
                                <div className="flex items-start gap-1">
                                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                                  <span className="italic line-clamp-2">"{item.message}"</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                                  onClick={() => handleOpenAcceptModal(item)}
                                  disabled={isAnyLoading}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="font-semibold flex items-center gap-1.5 cursor-pointer"
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
        </div>

        {/* Registered Merchants Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-serif font-bold text-foreground">Registered Wholesaler Merchants</h2>
            <p className="text-muted-foreground text-sm">Monitor and manage the status and lifecycles of active B2B wholesalers.</p>
          </div>

          <Card className="border shadow-md overflow-hidden bg-card">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg font-serif">Merchants Directory</CardTitle>
              <CardDescription>Active and suspended wholesale accounts</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMerchants ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Fetching merchants directory...</p>
                </div>
              ) : merchantsList.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Building2 className="w-12 h-12 stroke-[1.2] text-muted-foreground/60" />
                  <p className="font-semibold text-lg">No Registered Wholesalers</p>
                  <p className="text-sm text-muted-foreground/80">No wholesaler accounts have been generated yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-6 py-4">Wholesaler Shop</th>
                        <th className="px-6 py-4">Owner / Contact</th>
                        <th className="px-6 py-4">Vendor ID / Username</th>
                        <th className="px-6 py-4">Billing Address</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {merchantsList.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-muted/5 transition-colors duration-200">
                          <td className="px-6 py-4 font-medium text-foreground">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5" />
                              </div>
                              <span className="font-semibold">{item.shopName || "—"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-muted-foreground/60" />
                                <span>{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground/60" />
                                <span>{item.phone || "—"}</span>
                              </div>
                              {item.email && (
                                <div className="flex items-center gap-2 text-xs">
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground/60" />
                                  <span>{item.email}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-muted-foreground">
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="text-[10px] font-bold tracking-wider">{item.uniqueVendorId || "LEGACY"}</Badge>
                              <span className="block text-xs font-semibold text-foreground/80 mt-1">@{item.username}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground max-w-xs text-xs">
                            <div className="flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{item.address || "No address provided"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {item.status === "ACTIVE" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 border-emerald-200">ACTIVE</Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 border-amber-200">SUSPENDED / DEACTIVATED</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`font-semibold flex items-center gap-1.5 cursor-pointer ${
                                  item.status === "ACTIVE" 
                                    ? "hover:bg-amber-50 hover:text-amber-700 border-amber-200 text-amber-600" 
                                    : "hover:bg-emerald-50 hover:text-emerald-700 border-emerald-200 text-emerald-600"
                                }`}
                                onClick={() => handleToggleStatus(item.id, item.status)}
                              >
                                <Power className="w-3.5 h-3.5" />
                                {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="font-semibold flex items-center gap-1.5 cursor-pointer"
                                onClick={() => handleDeleteMerchant(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </main>

      {/* Accept Inquiry & Create Credentials Modal */}
      <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Generate Merchant Credentials</DialogTitle>
            <DialogDescription>
              Provide custom login credentials for the partner request.
            </DialogDescription>
          </DialogHeader>

          {selectedInquiry && (
            <form onSubmit={handleAcceptSubmit} className="space-y-4 py-2">
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-sm space-y-1.5">
                <p><span className="font-semibold text-muted-foreground">Merchant:</span> {selectedInquiry.name}</p>
                <p><span className="font-semibold text-muted-foreground">Business:</span> {selectedInquiry.shopName}</p>
                {selectedInquiry.gstNumber && <p><span className="font-semibold text-muted-foreground">GST IN:</span> {selectedInquiry.gstNumber}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="initial-username">Initial Username</Label>
                <Input
                  id="initial-username"
                  value={initialUsername}
                  onChange={(e) => setInitialUsername(e.target.value)}
                  placeholder="Enter initial username"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="initial-password">Initial Password</Label>
                <Input
                  id="initial-password"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Enter initial password"
                  required
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setShowAcceptModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer" disabled={submittingAccept}>
                  {submittingAccept && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create & Activate Account
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
