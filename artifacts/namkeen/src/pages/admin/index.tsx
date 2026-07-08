import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useLocation, Link } from "wouter";
import { format } from "date-fns";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShoppingCart,
  IndianRupee,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
  BarChart2,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────
interface AnalyticsData {
  range: string;
  totalSales: number;
  totalSalesPending: number;
  totalPurchases: number;
  totalPurchasePending: number;
  totalPurchasedKg: number;
  closingStockKg: number;
  chartData: { label: string; sales: number; purchases: number }[];
  productLedger: {
    productName: string;
    openingStockKg: number;
    purchasedKg: number;
    soldKg: number;
    closingKg: number;
  }[];
  periodOrders: {
    id: number;
    customerId: number;
    shopName: string;
    ownerName: string;
    status: string;
    billingType: string;
    sequenceNumber: number | null;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
    createdAt: string;
  }[];
  periodPurchases: {
    id: number;
    date: string;
    supplierName: string;
    productName: string;
    quantityKg: number;
    totalPrice: number;
    amountPaidToSupplier: number;
    purchasePaymentStatus: string;
    createdAt: string;
  }[];
}

// ─── Constants ────────────────────────────────────────────────
const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const inrFmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 10 }).format(v);

const safeInrFmt = (v: any) => {
  const num = Number(v || 0);
  return isNaN(num) ? "₹0" : inrFmt(num);
};

// Custom bar-chart tooltip
function AnalyticsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="font-medium">
          {p.name}: {inrFmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Reusable Premium Blur Modal ───────────────────────────────
function DashboardModal({ open, onOpenChange, title, description, children, className = "max-w-lg" }: any) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 transition-all duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={`fixed left-[50%] top-[50%] z-50 grid w-[90vw] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl ${className}`}
        >
          <div className="flex flex-col space-y-1.5 text-center sm:text-left border-b pb-4 mb-2">
            <DialogPrimitive.Title className="text-xl font-bold text-foreground font-serif">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
          </div>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {children}
          </div>
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground p-1 hover:bg-muted rounded-md">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function AdminIndex() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-based

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(currentMonthIndex + 1); // 1-based
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [productSearch, setProductSearch] = useState("");

  // Modals active states
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isPurchasesOpen, setIsPurchasesOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [salesScope, setSalesScope] = useState<"month" | "year">("month");
  const [purchasesScope, setPurchasesScope] = useState<"month" | "year">("month");

  // Tab & search states inside modals
  const [salesTab, setSalesTab] = useState<"pending" | "paid">("pending");
  const [salesSearch, setSalesSearch] = useState("");
  const [purchasesTab, setPurchasesTab] = useState<"pending" | "paid">("pending");
  const [purchasesSearch, setPurchasesSearch] = useState("");

  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [recordingPayment, setRecordingPayment] = useState<{ type: "sales" | "purchases"; data: any } | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<any | null>(null);
  const [confirmDeletePurchase, setConfirmDeletePurchase] = useState<any | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierName: "",
    productName: "",
    quantityKg: "",
    totalPrice: "",
    amountPaidToSupplier: "",
    notes: "",
  });

  // Summary query — direct fetch with explicit year/month/day query params
  // so the URL (and React Query cache key) updates instantly on every filter change.
  // Build YYYY-MM-DD from local date parts — avoids UTC offset shifting the
  // date backward (e.g. midnight IST = previous day in UTC via toISOString).
  const summaryDayParam = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : "";
  const summaryUrl =
    `/api/dashboard/summary` +
    `?year=${selectedYear}` +
    `&month=${selectedMonth}` +
    (summaryDayParam ? `&day=${summaryDayParam}` : "");

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard-summary", selectedYear, selectedMonth, summaryDayParam],
    queryFn: async () => {
      const res = await fetch(summaryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard summary");
      return res.json();
    },
  });

  // Dynamic ranges list
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  // Sync year and month changes
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedDate(undefined);
    if (year === currentYear && selectedMonth !== "all" && selectedMonth > currentMonthIndex + 1) {
      setSelectedMonth(currentMonthIndex + 1);
    }
  };

  const getSelectedLabel = () => {
    if (selectedMonth === "all") {
      return `Year ${selectedYear}`;
    }
    const monthObj = months.find((m) => m.value === selectedMonth);
    return `${monthObj?.label} ${selectedYear}`;
  };

  // Main analytics query
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", selectedYear, selectedMonth, selectedDate],
    queryFn: async () => {
      const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
      const res = await fetch(`/api/dashboard/analytics?year=${selectedYear}&month=${selectedMonth}&date=${dateStr}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Yearly analytics query
  const { data: yearlyAnalytics, isLoading: yearlyAnalyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", selectedYear, "all"],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/analytics?year=${selectedYear}&month=all`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch yearly analytics");
      return res.json();
    },
    enabled: (isSalesOpen && salesScope === "year") || (isPurchasesOpen && purchasesScope === "year"),
    staleTime: 30_000,
  });

  // Low stock items: products with current stock < 20 KG
  const lowStockLedgerItems = useMemo(() => {
    if (!analytics?.productLedger) return [];
    return analytics.productLedger.filter((row) => row.closingKg < 20);
  }, [analytics?.productLedger]);

  // Client-side filtering of Product ledger table inside Closing Stock Modal
  const filteredLedger = useMemo(() => {
    if (!analytics?.productLedger) return [];
    return analytics.productLedger.filter((row) =>
      row.productName.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [analytics?.productLedger, productSearch]);

  // Reactive filters for expanded lists inside Sales/Purchases Modals
  const filteredOrders = useMemo(() => {
    const ordersSource = salesScope === "year" ? yearlyAnalytics?.periodOrders : analytics?.periodOrders;
    if (!ordersSource) return [];
    return ordersSource.filter((o) => {
      const isPaidMatch = salesTab === "paid" ? o.paymentStatus === "fully_paid" : o.paymentStatus !== "fully_paid";
      if (!isPaidMatch) return false;
      if (!salesSearch) return true;
      const s = salesSearch.toLowerCase();
      const orderDate = o.createdAt ? format(new Date(o.createdAt), "dd MMM yyyy") : "";
      const displayId = o.billingType === "with_gst" ? `gst-#${o.sequenceNumber ?? o.id}` : `#${o.sequenceNumber ?? o.id}`;
      return (
        o.id.toString().includes(s) ||
        displayId.includes(s) ||
        o.shopName?.toLowerCase().includes(s) ||
        o.ownerName?.toLowerCase().includes(s) ||
        orderDate.toLowerCase().includes(s)
      );
    });
  }, [analytics?.periodOrders, yearlyAnalytics?.periodOrders, salesScope, salesTab, salesSearch]);

  const filteredPurchases = useMemo(() => {
    const purchasesSource = purchasesScope === "year" ? yearlyAnalytics?.periodPurchases : analytics?.periodPurchases;
    if (!purchasesSource) return [];
    return purchasesSource.filter((p) => {
      const isPaidMatch = purchasesTab === "paid" ? p.purchasePaymentStatus === "fully_paid" : p.purchasePaymentStatus !== "fully_paid";
      if (!isPaidMatch) return false;
      if (!purchasesSearch) return true;
      const s = purchasesSearch.toLowerCase();
      const purchaseDate = p.date ? format(new Date(p.date), "dd MMM yyyy") : "";
      return (
        p.id.toString().includes(s) ||
        p.supplierName?.toLowerCase().includes(s) ||
        p.productName?.toLowerCase().includes(s) ||
        purchaseDate.toLowerCase().includes(s)
      );
    });
  }, [analytics?.periodPurchases, yearlyAnalytics?.periodPurchases, purchasesScope, purchasesTab, purchasesSearch]);

  // Record Payment Modal triggers and save logic
  const openRecordPaymentModal = (type: "sales" | "purchases", data: any) => {
    setRecordingPayment({ type, data });
    setPaymentAmountInput(String(type === "sales" ? data.paidAmount : data.amountPaidToSupplier));
  };

  const handleSavePaymentRecord = async () => {
    if (!recordingPayment) return;
    const { type, data } = recordingPayment;
    const amount = Number(paymentAmountInput);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setMutatingId(data.id);
    try {
      if (type === "sales") {
        const res = await fetch(`/api/orders/${data.id}/payment`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidAmount: amount }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to update payment status");
        toast.success("Sales payment record updated successfully");
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      } else {
        const res = await fetch(`/api/stock/${data.id}/payment`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountPaidToSupplier: amount }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to update payment status");
        toast.success("Purchases procurement payment record updated successfully");
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["stock_ledger"] });
      }
      setRecordingPayment(null);
    } catch (err: any) {
      toast.error(err.message || "Error saving payment record");
    } finally {
      setMutatingId(null);
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirmDeleteOrder) return;
    try {
      const res = await fetch(`/api/orders/${confirmDeleteOrder.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete order");
      toast.success("Order deleted successfully");
      setConfirmDeleteOrder(null);
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err: any) {
      toast.error(err.message || "Error deleting order");
    }
  };

  const handleDeletePurchase = async () => {
    if (!confirmDeletePurchase) return;
    try {
      const res = await fetch(`/api/stock/${confirmDeletePurchase.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete purchase entry");
      toast.success("Procurement entry deleted successfully");
      setConfirmDeletePurchase(null);
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["stock_ledger"] });
    } catch (err: any) {
      toast.error(err.message || "Error deleting purchase entry");
    }
  };

  const openEditPurchase = (purchase: any) => {
    setEditingPurchase(purchase);
    setPurchaseForm({
      supplierName: purchase.supplierName,
      productName: purchase.productName,
      quantityKg: String(purchase.quantityKg),
      totalPrice: String(purchase.totalPrice),
      amountPaidToSupplier: String(purchase.amountPaidToSupplier),
      notes: purchase.notes || "",
    });
  };

  const handleSavePurchase = async () => {
    if (!editingPurchase) return;
    try {
      const res1 = await fetch(`/api/stock/${editingPurchase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: purchaseForm.supplierName,
          productName: purchaseForm.productName,
          quantityKg: Number(purchaseForm.quantityKg),
          totalPrice: Number(purchaseForm.totalPrice),
          notes: purchaseForm.notes || null,
        }),
        credentials: "include",
      });
      if (!res1.ok) {
        const errData = await res1.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update details");
      }

      const res2 = await fetch(`/api/stock/${editingPurchase.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaidToSupplier: Number(purchaseForm.amountPaidToSupplier),
        }),
        credentials: "include",
      });
      if (!res2.ok) {
        const errData = await res2.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update payment");
      }

      toast.success("Procurement entry updated successfully");
      setEditingPurchase(null);
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["stock_ledger"] });
    } catch (err: any) {
      toast.error(err.message || "Error updating entry");
    }
  };

  return (
    <AdminLayout>
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your wholesale operations</p>
        </div>

        {/* ── Temporal range dynamic Month & Year Pickers ─────── */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Year</span>
            <Select value={String(selectedYear)} onValueChange={(val) => handleYearChange(Number(val))}>
              <SelectTrigger className="w-[110px] bg-background">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Month</span>
            <Select
              value={String(selectedMonth)}
              onValueChange={(val) => setSelectedMonth(val === "all" ? "all" : Number(val))}
            >
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map((m) => {
                  const isFutureMonth = selectedYear === currentYear && m.value > currentMonthIndex + 1;
                  return (
                    <SelectItem key={m.value} value={String(m.value)} disabled={isFutureMonth}>
                      {m.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
             </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day / Date</span>
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-[180px] h-9 justify-start text-left font-normal bg-background ${
                      !selectedDate && "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a day</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      if (date) {
                        setSelectedYear(date.getFullYear());
                        setSelectedMonth(date.getMonth() + 1);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {selectedDate && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(undefined)}
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  title="Clear day filter"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary cards (always-on, year-specific) ─────────── */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: New Orders */}
          <div className="relative">
            {summary.newOrdersCount > 0 && (
              <span className="absolute top-2 right-2 flex h-3 w-3 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
            )}
            <Card
              className="cursor-pointer hover:shadow-md hover:border-orange-400/60 transition-all duration-200 h-full"
              onClick={() => setLocation("/admin/orders")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground text-primary hover:underline">Total Orders</CardTitle>
                <ShoppingCart className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {summaryLoading ? "..." : (summary?.totalOrders ?? 0)}
                </div>
                {summary.newOrdersCount > 0 ? (
                  <p className="text-xs text-orange-500 font-semibold animate-pulse mt-1">
                    ⚠️ {summary.newOrdersCount} {summary.newOrdersCount === 1 ? "New Order" : "New Orders"} Pending
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">All Invoices Processed</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Card 2: Yearly Total Sales */}
          <Card
            className="cursor-pointer hover:shadow-md transition-all duration-200"
            onClick={() => {
              setSalesScope("year");
              setIsSalesOpen(true);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Yearly Total Sales</CardTitle>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{safeInrFmt(summary.yearlySalesTotal)}</div>
              <div className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 animate-pulse">
                Pending: {safeInrFmt(summary.yearlySalesPending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Year {selectedYear}</p>
            </CardContent>
          </Card>

          {/* Card 3: Yearly Total Purchases */}
          <Card
            className="cursor-pointer hover:shadow-md transition-all duration-200"
            onClick={() => {
              setPurchasesScope("year");
              setIsPurchasesOpen(true);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Yearly Total Purchases</CardTitle>
              <TrendingDown className="w-4 h-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{safeInrFmt(summary.yearlyPurchasesTotal)}</div>
              <div className="text-xs font-semibold text-amber-600/80 dark:text-amber-400/80 mt-0.5 animate-pulse">
                Pending: {safeInrFmt(summary.yearlyPurchasesPending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Year {selectedYear}</p>
            </CardContent>
          </Card>

          {/* Card 4: Alerts */}
          <Card
            className={`cursor-pointer hover:shadow-md transition-all duration-200 ${
              summary.lowStockProducts > 0 ? "border-destructive/50 bg-destructive/5" : ""
            }`}
            onClick={() => setIsAlertsOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alerts</CardTitle>
              <AlertTriangle className={`w-4 h-4 ${summary.lowStockProducts > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{summary.lowStockProducts}</div>
              <p className="text-xs text-muted-foreground mt-1">Low stock products • Click to view</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          ANALYTICS SECTION — driven by selectedYear / selectedMonth
      ════════════════════════════════════════════════════════ */}
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          Financial Analytics — <span className="text-primary">{getSelectedLabel()}</span>
        </h2>
        <p className="text-sm text-muted-foreground">Sales vs. Purchase performance with stock ledger breakdown</p>
      </div>

      {/* ── Analytics metric cards ────────────────────────────── */}
      {analyticsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-4">
          {/* Total Sales Card */}
          <Card
            className="cursor-pointer hover:shadow-md transition-all duration-200 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card"
            onClick={() => {
              setSalesScope("month");
              setIsSalesOpen(true);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {inrFmt(analytics.totalSales)}
              </div>
              <div className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 animate-pulse">
                Pending: {inrFmt(analytics.totalSalesPending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Delivered orders • Click to open details</p>
            </CardContent>
          </Card>

          {/* Total Purchases Card */}
          <Card
            className="cursor-pointer hover:shadow-md transition-all duration-200 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-card"
            onClick={() => {
              setPurchasesScope("month");
              setIsPurchasesOpen(true);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
              <TrendingDown className="w-5 h-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {inrFmt(analytics.totalPurchases)}
              </div>
              <div className="text-xs font-semibold text-amber-600/80 dark:text-amber-400/80 mt-0.5 animate-pulse">
                Pending: {inrFmt(analytics.totalPurchasePending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Supplier intake • Click to open details</p>
            </CardContent>
          </Card>

          {/* Closing Stock Card */}
          <Card
            className="cursor-pointer hover:shadow-md transition-all duration-200 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-card"
            onClick={() => setIsStockOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Closing Stock</CardTitle>
              <Package className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {analytics.closingStockKg.toLocaleString("en-IN", { maximumFractionDigits: 1 })} KG
              </div>
              <p className="text-xs text-muted-foreground mt-1">Available across catalog • Click to open ledger</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ── Sales vs. Purchases comparison chart on main page ── */}
      {analyticsLoading ? (
        <Skeleton className="h-[320px] w-full rounded-xl" />
      ) : analytics && (analytics.totalSales > 0 || analytics.totalPurchases > 0) ? (
        <Card className="shadow-sm mb-6 mt-2">
          <CardHeader>
            <CardTitle>Sales vs. Purchases Performance</CardTitle>
            <CardDescription>
              {selectedMonth === "all"
                ? "Monthly comparison — Jan to Dec"
                : "Day-by-day comparison for the selected month"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.chartData.length > 0 ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.chartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                    barCategoryGap="30%"
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval={selectedMonth === "all" ? 0 : "preserveStartEnd"}
                      dy={6}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                      width={56}
                    />
                    <Tooltip content={<AnalyticsTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                      formatter={(v) => v === "sales" ? "Sales (₹)" : "Purchases (₹)"}
                    />
                    <Bar dataKey="sales"     name="sales"     fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="purchases" name="purchases" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart2 className="w-10 h-10 opacity-30" />
                <p className="text-sm">No transaction history available for this period.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 mb-8">
          <BarChart2 className="w-12 h-12 opacity-35 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">No Transactions</h3>
          <p className="text-sm max-w-sm px-6">
            No transaction history available for this period.
          </p>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════
          CENTRALIZED DIALOG OVERLAYS (MODALS)
      ════════════════════════════════════════════════════════ */}

      {/* ── Alerts Card Modal (Low Stock Alerts) ── */}
      <DashboardModal
        open={isAlertsOpen}
        onOpenChange={setIsAlertsOpen}
        title="Low Stock Alerts"
        description="Detailed overview of products currently out of stock or matching lower inventory thresholds."
        className="max-w-4xl"
      >
        {lowStockLedgerItems.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-6 font-semibold">Product Name</TableHead>
                <TableHead className="text-right font-semibold">Purchased (KG)</TableHead>
                <TableHead className="text-right font-semibold">Sold (KG)</TableHead>
                <TableHead className="text-right font-semibold pr-6">Current Stock (KG)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockLedgerItems.map((row) => (
                <TableRow key={row.productName} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="pl-6 font-medium text-foreground">{row.productName}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.purchasedKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} KG
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.soldKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} KG
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {row.closingKg <= 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-950/30 animate-pulse">
                        0 KG (Unavailable)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs text-amber-600 bg-amber-100 dark:bg-amber-950/30 font-semibold">
                        {row.closingKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} KG
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
            <Check className="w-10 h-10 text-emerald-500 bg-emerald-100 dark:bg-emerald-950/30 p-2 rounded-full" />
            <p className="font-semibold text-foreground">All products are healthy!</p>
            <p className="text-xs">No catalog items are currently flagged as out of stock.</p>
          </div>
        )}
      </DashboardModal>

      {/* ── Total Sales Card Modal ── */}
      <DashboardModal
        open={isSalesOpen}
        onOpenChange={setIsSalesOpen}
        title="Sales Transactions Ledger"
        description={salesScope === "year" ? `Manage and review sales orders within Year ${selectedYear}.` : `Manage and review sales orders within ${getSelectedLabel()}.`}
        className="max-w-6xl"
      >
        <div className="flex flex-col space-y-4">
          {/* Sub-tabs header and search row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="flex gap-1.5 bg-muted p-1 rounded-md text-sm font-medium w-fit border">
              <button
                onClick={() => setSalesTab("pending")}
                className={`px-3 py-1 rounded transition-all ${salesTab === "pending" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Pending Bills
              </button>
              <button
                onClick={() => setSalesTab("paid")}
                className={`px-3 py-1 rounded transition-all ${salesTab === "paid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Paid Bills
              </button>
            </div>
            <Input
              type="text"
              placeholder="Search by Retailer, Order ID, or Date..."
              value={salesSearch}
              onChange={(e) => setSalesSearch(e.target.value)}
              className="max-w-xs bg-background h-9 text-sm"
            />
          </div>

          {salesScope === "year" && yearlyAnalyticsLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[120px] pl-6 font-semibold">Order ID</TableHead>
                    <TableHead className="font-semibold">Retailer / Shop Name</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="text-right font-semibold">Total Price</TableHead>
                    <TableHead className="text-right font-semibold">Amount Paid</TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                    <TableHead className="text-right pr-6 w-[140px] font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((o) => (
                    <TableRow key={o.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-medium pl-6">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          onClick={() => setIsSalesOpen(false)}
                          className="text-primary hover:underline"
                        >
                          {o.billingType === "with_gst" ? `GST-#${o.sequenceNumber ?? o.id}` : `#${o.sequenceNumber ?? o.id}`}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{o.shopName || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{o.ownerName}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {o.createdAt ? format(new Date(o.createdAt), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">{inrFmt(o.totalAmount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{inrFmt(o.paidAmount)}</TableCell>
                      <TableCell className="text-center">
                        {o.paymentStatus === "fully_paid" ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Paid</Badge>
                        ) : o.paymentStatus === "partially_paid" ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100">Partial</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            disabled={mutatingId === o.id}
                            onClick={() => openRecordPaymentModal("sales", o)}
                            title="Record Payment (₹)"
                          >
                            <span className="font-bold text-sm">₹</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => {
                              setIsSalesOpen(false);
                              setLocation(`/admin/orders/${o.id}`);
                            }}
                            title="View Order Details"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDeleteOrder(o)}
                            title="Delete Order Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
              No transaction history recorded for this period.
            </div>
          )}
        </div>
      </DashboardModal>

      {/* ── Total Purchases Card Modal ── */}
      <DashboardModal
        open={isPurchasesOpen}
        onOpenChange={setIsPurchasesOpen}
        title="Purchases Procurement Ledger"
        description={purchasesScope === "year" ? `Manage and review purchase orders within Year ${selectedYear}.` : `Manage and review procurement entry logs within ${getSelectedLabel()}.`}
        className="max-w-7xl"
      >
        <div className="flex flex-col space-y-4">
          {/* Sub-tabs header and search row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="flex gap-1.5 bg-muted p-1 rounded-md text-sm font-medium w-fit border">
              <button
                onClick={() => setPurchasesTab("pending")}
                className={`px-3 py-1 rounded transition-all ${purchasesTab === "pending" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Pending Purchases
              </button>
              <button
                onClick={() => setPurchasesTab("paid")}
                className={`px-3 py-1 rounded transition-all ${purchasesTab === "paid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Paid Purchases
              </button>
            </div>
            <Input
              type="text"
              placeholder="Search by Supplier, Product, or ID..."
              value={purchasesSearch}
              onChange={(e) => setPurchasesSearch(e.target.value)}
              className="max-w-xs bg-background h-9 text-sm"
            />
          </div>

          {purchasesScope === "year" && yearlyAnalyticsLoading ? (
            <div className="p-8 flex justify-center border rounded-lg bg-muted/10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredPurchases.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6 font-semibold">Supplier Name</TableHead>
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="text-right font-semibold">Qty (KG)</TableHead>
                    <TableHead className="text-right font-semibold">Total Price</TableHead>
                    <TableHead className="text-right font-semibold">Amount Paid</TableHead>
                    <TableHead className="text-center font-semibold">Status</TableHead>
                    <TableHead className="text-right pr-6 w-[140px] font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-semibold text-foreground pl-6">{p.supplierName}</TableCell>
                      <TableCell className="text-muted-foreground">{p.productName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.date ? format(new Date(p.date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.quantityKg} KG</TableCell>
                      <TableCell className="text-right font-medium text-foreground">{inrFmt(p.totalPrice)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{inrFmt(p.amountPaidToSupplier)}</TableCell>
                      <TableCell className="text-center">
                        {p.purchasePaymentStatus === "fully_paid" ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Paid</Badge>
                        ) : p.purchasePaymentStatus === "partially_paid" ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100">Partial</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            disabled={mutatingId === p.id}
                            onClick={() => openRecordPaymentModal("purchases", p)}
                            title="Record Payment (₹)"
                          >
                            <span className="font-bold text-sm">₹</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => openEditPurchase(p)}
                            title="Edit Procurement Entry"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDeletePurchase(p)}
                            title="Delete Purchase Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
              No transaction history recorded for this period.
            </div>
          )}
        </div>
      </DashboardModal>

      {/* ── Closing Stock Card Modal (Full Product Ledger Table Grid) ── */}
      <DashboardModal
        open={isStockOpen}
        onOpenChange={setIsStockOpen}
        title="Product Volume Ledger"
        description="Comprehensive breakdown of stock intake, deliveries, and current balances across the entire catalog."
        className="max-w-5xl"
      >
        <div className="flex flex-col space-y-4">
          <div className="p-3 bg-muted/40 rounded-lg border">
            <Input
              type="text"
              placeholder="Search catalog products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="max-w-xs bg-background h-9 text-sm"
            />
          </div>

          {filteredLedger.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6 font-semibold">Product Name</TableHead>
                    <TableHead className="text-right font-semibold">Opening Stock</TableHead>
                    <TableHead className="text-right font-semibold">Purchased</TableHead>
                    <TableHead className="text-right font-semibold">Sold</TableHead>
                    <TableHead className="text-right font-semibold pr-6">Current Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLedger.map((row: any) => {
                    const isOutOfStock = row.closingKg <= 0;
                    const hasConversion = row.conversionFactor && row.conversionFactor > 0;
                    const boxesLeft = hasConversion ? Math.floor(row.closingKg / row.conversionFactor) : 0;
                    const packetsLeft = hasConversion ? Math.round(row.closingKg % row.conversionFactor) : 0;
                    const mainUnitName = (row.mainUnit && isNaN(Number(row.mainUnit))) ? row.mainUnit : "Main Unit";
                    const subUnitName = (row.subUnit && isNaN(Number(row.subUnit))) ? row.subUnit : "Sub-Unit";

                    const formatInventory = (qty: number) => {
                      if (hasConversion) {
                        const boxes = Math.floor(qty / row.conversionFactor);
                        const packets = Math.round(qty % row.conversionFactor);
                        return `${boxes} ${mainUnitName}, ${packets} ${subUnitName}`;
                      }
                      return `${qty.toLocaleString("en-IN", { maximumFractionDigits: 2 })} KG`;
                    };

                    const displayVal = hasConversion
                      ? `${boxesLeft} ${mainUnitName}, ${packetsLeft} ${subUnitName} Left`
                      : `${row.closingKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} KG`;

                    return (
                      <TableRow key={row.productName} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="pl-6 font-medium text-foreground">{row.productName}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatInventory(row.openingStockKg)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatInventory(row.purchasedKg)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatInventory(row.soldKg)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {row.closingKg <= 0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-950/30 animate-pulse">
                              {hasConversion ? `0 ${mainUnitName}, 0 ${subUnitName} Left` : "0 KG (Unavailable)"}
                            </span>
                          ) : row.closingKg < 20 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs text-amber-600 bg-amber-100 dark:bg-amber-950/30 font-semibold">
                              {displayVal}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {displayVal}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
              No matching products found in this period.
            </div>
          )}
        </div>
      </DashboardModal>

      {/* ── Confirmation Dialog: Delete Order ── */}
      <DialogPrimitive.Root open={!!confirmDeleteOrder} onOpenChange={(open) => !open && setConfirmDeleteOrder(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 transition-all duration-300" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 rounded-xl">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <DialogPrimitive.Title className="text-lg font-bold text-foreground font-serif">Confirm Delete Order</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete order #{confirmDeleteOrder?.sequenceNumber ?? confirmDeleteOrder?.id}? This action cannot be undone and will modify all accounting liquidity metrics.
              </DialogPrimitive.Description>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4 border-t pt-4">
              <Button variant="ghost" onClick={() => setConfirmDeleteOrder(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteOrder}>Delete Record</Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ── Confirmation Dialog: Delete Purchase ── */}
      <DialogPrimitive.Root open={!!confirmDeletePurchase} onOpenChange={(open) => !open && setConfirmDeletePurchase(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 transition-all duration-300" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 rounded-xl">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <DialogPrimitive.Title className="text-lg font-bold text-foreground font-serif">Confirm Delete Procurement Record</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete purchase log #{confirmDeletePurchase?.id} (Supplier: {confirmDeletePurchase?.supplierName})? This action cannot be undone and will modify all stock quantities and outstanding payables.
              </DialogPrimitive.Description>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4 border-t pt-4">
              <Button variant="ghost" onClick={() => setConfirmDeletePurchase(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeletePurchase}>Delete Record</Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ── Dialog: Edit Purchase ── */}
      <DialogPrimitive.Root open={!!editingPurchase} onOpenChange={(open) => !open && setEditingPurchase(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 transition-all duration-300" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-[90vw] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 rounded-xl">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left border-b pb-4 mb-2">
              <DialogPrimitive.Title className="text-lg font-bold text-foreground font-serif">Edit Procurement Entry</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                Update transaction values and ledger logs for procurement log #{editingPurchase?.id}.
              </DialogPrimitive.Description>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSavePurchase(); }} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Supplier Name</span>
                  <Input
                    type="text"
                    value={purchaseForm.supplierName}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, supplierName: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Product Name</span>
                  <Input
                    type="text"
                    value={purchaseForm.productName}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, productName: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Quantity (KG)</span>
                  <Input
                    type="number"
                    value={purchaseForm.quantityKg}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, quantityKg: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Total Price (₹)</span>
                  <Input
                    type="number"
                    value={purchaseForm.totalPrice}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, totalPrice: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Amount Paid (₹)</span>
                  <Input
                    type="number"
                    value={purchaseForm.amountPaidToSupplier}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, amountPaidToSupplier: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Notes</span>
                <Input
                  type="text"
                  placeholder="procurement comments..."
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="h-9"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4 border-t pt-4">
                <Button type="button" variant="ghost" onClick={() => setEditingPurchase(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 p-1 hover:bg-muted rounded-md">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ── Dialog: Record Payment ── */}
      <DialogPrimitive.Root open={!!recordingPayment} onOpenChange={(open) => !open && setRecordingPayment(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] backdrop-blur-md bg-black/40 transition-all duration-300" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[60] grid w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 rounded-xl">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left border-b pb-4 mb-2">
              <DialogPrimitive.Title className="text-lg font-bold text-foreground font-serif">
                Record Payment
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {recordingPayment?.type === "sales"
                  ? `Log collection payment for Order #${recordingPayment.data.sequenceNumber ?? recordingPayment.data.id}`
                  : `Log procurement payment to Supplier ${recordingPayment?.data.supplierName}`}
              </DialogPrimitive.Description>
            </div>

            {recordingPayment && (() => {
              const type = recordingPayment.type;
              const data = recordingPayment.data;
              const total = type === "sales" ? Number(data.totalAmount) : Number(data.totalPrice);
              const currentPaid = type === "sales" ? Number(data.paidAmount) : Number(data.amountPaidToSupplier);
              const balanceDue = Math.max(0, total - currentPaid);

              return (
                <form onSubmit={(e) => { e.preventDefault(); handleSavePaymentRecord(); }} className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Invoice Total</span>
                      <span className="font-semibold text-foreground">{inrFmt(total)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Balance Due</span>
                      <span className="font-semibold text-destructive">{inrFmt(balanceDue)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground block">
                      Total Paid Amount (₹)
                    </label>
                    <Input
                      type="number"
                      value={paymentAmountInput}
                      onChange={(e) => setPaymentAmountInput(e.target.value)}
                      placeholder="Enter amount paid..."
                      className="h-9"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4 border-t pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecordingPayment(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={mutatingId !== null}
                    >
                      {mutatingId !== null ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                      Save Payment
                    </Button>
                  </div>
                </form>
              );
            })()}

            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 p-1 hover:bg-muted rounded-md">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </AdminLayout>
  );
}
