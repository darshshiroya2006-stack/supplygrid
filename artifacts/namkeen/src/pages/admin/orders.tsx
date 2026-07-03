import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListOrders, getListOrdersQueryKey, useDeleteOrder, useRecordOrderPayment, useConvertOrderGst } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Loader2, Search, FileText, Trash2, Calendar, IndianRupee, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { format } from "date-fns";
import { toast } from "sonner";
import { OrderSummary } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";

export default function AdminOrders() {
  const [search, setSearch] = useState("");
  const [billingTab, setBillingTab] = useState<"without_gst" | "with_gst">("without_gst");
  const queryClient = useQueryClient();
  const convertGst = useConvertOrderGst({
    mutation: {
      onSuccess: () => {
        toast.success("Order transferred to GST bills successfully");
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to convert order to GST bill");
      }
    }
  });
  const [, setLocation] = useLocation();

  const getOrderDisplayId = (order: OrderSummary | undefined | null) => {
    if (!order) return "";
    return order.billingType === "with_gst" ? `GST-#${order.sequenceNumber}` : `#${order.sequenceNumber}`;
  };

  const [paymentOrder, setPaymentOrder] = useState<OrderSummary | null>(null);
  const [paymentInput, setPaymentInput] = useState("");
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);

  // Dynamic calendar dropdown parameters
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);
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

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedDate(undefined);
    if (year === currentYear && selectedMonth !== "all" && selectedMonth > currentMonthIndex + 1) {
      setSelectedMonth(currentMonthIndex + 1);
    }
  };

  const queryParams = {
    year: selectedDate ? selectedDate.getFullYear() : selectedYear,
    month: String(selectedDate ? selectedDate.getMonth() + 1 : selectedMonth),
    day: String(selectedDate ? selectedDate.getDate() : "all"),
  };

  const { data: orders, isLoading } = useListOrders(queryParams as any);
  const deleteOrder = useDeleteOrder();
  const recordPayment = useRecordOrderPayment();

  const filteredOrders = orders?.filter(o => 
    o.billingType === billingTab &&
    (o.shopName.toLowerCase().includes(search.toLowerCase()) || 
     o.id.toString().includes(search) ||
     o.sequenceNumber.toString().includes(search) ||
     getOrderDisplayId(o).toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingOrderId(id);
  };

  const handleConfirmDelete = () => {
    if (deletingOrderId === null) return;
    deleteOrder.mutate(
      { id: deletingOrderId },
      {
        onSuccess: () => {
          toast.success("Order deleted successfully");
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          setDeletingOrderId(null);
        },
        onError: () => {
          toast.error("Failed to delete order");
          setDeletingOrderId(null);
        }
      }
    );
  };

  const handleConvertToGst = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to convert Order #${id} to a GST bill? This will calculate 5% GST (2.5% CGST and 2.5% SGST) and update the total.`)) {
      convertGst.mutate({ id });
    }
  };

  const openPaymentModal = (e: React.MouseEvent, order: OrderSummary) => {
    e.stopPropagation();
    setPaymentOrder(order);
    setPaymentInput(String(order.paidAmount || 0));
  };

  const handleRecordPayment = () => {
    if (!paymentOrder) return;
    const amount = parseFloat(paymentInput);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    recordPayment.mutate(
      { id: paymentOrder.id, data: { paidAmount: amount } },
      {
        onSuccess: () => {
          toast.success("Payment recorded successfully");
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          setPaymentOrder(null);
        },
        onError: () => toast.error("Failed to record payment")
      }
    );
  };

  const renderOrderStatus = (status: string) => {
    if (status.toLowerCase() === 'processed') {
      return <span className="bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded text-xs">PROCESSED</span>;
    }
    switch (status.toLowerCase()) {
      case 'unprocessed':
        return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">UNPROCESSED</span>;
      case 'completed':
      case 'delivered':
        return <span className="bg-accent/10 text-accent px-2 py-1 rounded text-xs font-medium">{status.toUpperCase()}</span>;
      case 'pending':
        return <span className="bg-secondary/20 text-secondary-foreground px-2 py-1 rounded text-xs font-medium">{status.toUpperCase()}</span>;
      default:
        return <span className="bg-muted px-2 py-1 rounded text-xs font-medium">{status}</span>;
    }
  };

  const renderPaymentStatus = (order: OrderSummary) => {
    const { paymentStatus, paidAmount, totalAmount } = order;
    const due = totalAmount - paidAmount;
    switch (paymentStatus) {
      case "fully_paid":
        return (
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
            Fully Paid
          </span>
        );
      case "partially_paid":
        return (
          <div className="flex flex-col gap-0.5">
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
              Partial
            </span>
            <span className="text-xs text-destructive font-medium">Due ₹{due.toLocaleString()}</span>
          </div>
        );
      default:
        return (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
            Pending ₹{totalAmount.toLocaleString()}
          </span>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-1">Review and manage wholesale orders</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Dynamic calendar dropdown selectors */}
          <div className="flex items-center gap-3 flex-wrap">
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
                onValueChange={(val) => {
                  setSelectedMonth(val === "all" ? "all" : Number(val));
                  setSelectedDate(undefined);
                }}
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
                      className={`w-[180px] justify-start text-left font-normal bg-background ${
                        !selectedDate && "text-muted-foreground"
                      }`}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
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

          <div className="relative w-full lg:w-64 self-end lg:self-center">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input 
              placeholder="Search order ID or shop..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="px-4 pt-4 border-b">
          <Tabs value={billingTab} onValueChange={(v) => setBillingTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-2">
              <TabsTrigger value="without_gst">Without GST Bills</TabsTrigger>
              <TabsTrigger value="with_gst">With GST Bills</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders?.map((order) => {
                  const isUnprocessed = order.status === "unprocessed";
                  const isUnprinted = order.isPrinted === false;
                  return (
                    <TableRow 
                      key={order.id} 
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                        (isUnprocessed || isUnprinted)
                          ? "bg-orange-50/80 dark:bg-orange-950/20 border-l-4 border-l-orange-500 font-medium"
                          : ""
                      }`}
                      onClick={() => setLocation(`/admin/orders/${order.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{getOrderDisplayId(order)}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground text-sm">
                          <Calendar className="w-3 h-3 mr-2" />
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{order.shopName}</TableCell>
                      <TableCell>{order.itemCount} items</TableCell>
                      <TableCell className="text-right font-bold">₹{order.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>{renderOrderStatus(order.status)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {order.billingType === "without_gst" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2 border-primary text-primary hover:bg-primary/5 cursor-pointer shadow-xs font-semibold whitespace-nowrap"
                            onClick={(e) => handleConvertToGst(e, order.id)}
                            disabled={convertGst.isPending}
                          >
                            Add to GST Bill
                          </Button>
                        ) : (
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                            With GST
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{renderPaymentStatus(order)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                          title="Record Payment"
                          onClick={(e) => openPaymentModal(e, order)}
                        >
                          <IndianRupee className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => setLocation(`/admin/orders/${order.id}`)}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                          onClick={(e) => handleDelete(e, order.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredOrders?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No orders found for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!paymentOrder} onOpenChange={(open) => { if (!open) setPaymentOrder(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Record Payment — Order {getOrderDisplayId(paymentOrder)}</DialogTitle>
            <DialogDescription>
              Update the amount paid by <strong>{paymentOrder?.shopName}</strong> for this order.
            </DialogDescription>
          </DialogHeader>

          {paymentOrder && (
            <form onSubmit={(e) => { e.preventDefault(); handleRecordPayment(); }} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Order Total</p>
                  <p className="font-bold text-lg">₹{paymentOrder.totalAmount.toLocaleString()}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Balance Due</p>
                  <p className={`font-bold text-lg ${(paymentOrder.totalAmount - paymentOrder.paidAmount) > 0 ? "text-destructive" : "text-green-600"}`}>
                    ₹{(paymentOrder.totalAmount - paymentOrder.paidAmount).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Total Paid Amount (₹)</label>
                <Input
                  type="number"
                  min={0}
                  max={paymentOrder.totalAmount}
                  step={0.01}
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Enter the cumulative total amount received so far.</p>
              </div>

              <DialogFooter className="pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setPaymentOrder(null)}>Cancel</Button>
                <Button type="submit" disabled={recordPayment.isPending}>
                  {recordPayment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingOrderId !== null} onOpenChange={(open) => { if (!open) setDeletingOrderId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wholesale Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Order {getOrderDisplayId(orders?.find(o => o.id === deletingOrderId))}? This action will permanently remove the record from the database, restore the allocated product stock items, and clear the transactional sales logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
              disabled={deleteOrder.isPending}
            >
              {deleteOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
