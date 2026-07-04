import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListOrders, useListCustomers, getListOrdersQueryKey, useDeleteOrder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Search, Trash2, Calendar, IndianRupee, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { toast } from "sonner";
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

export default function CustomerOrders() {
  const params = useParams<{ id: string }>();
  const customerId = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);

  const { data: allOrders, isLoading: ordersLoading } = useListOrders({ range: "all" });
  const { data: customers, isLoading: customersLoading } = useListCustomers();
  const deleteOrder = useDeleteOrder();

  const customer = customers?.find(c => c.id === customerId);

  const customerOrders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter(o => o.customerId === customerId);
  }, [allOrders, customerId]);

  const filteredOrders = useMemo(() => {
    return customerOrders.filter(order => {
      const displayId = order.billingType === "with_gst" ? `GST-#${order.sequenceNumber}` : `#${order.sequenceNumber}`;
      const matchesSearch =
        !search ||
        order.id.toString().includes(search) ||
        (order.sequenceNumber && order.sequenceNumber.toString().includes(search)) ||
        displayId.toLowerCase().includes(search.toLowerCase()) ||
        order.shopName.toLowerCase().includes(search.toLowerCase());

      let matchesDate = true;
      if (dateFilter) {
        const orderDate = format(parseISO(order.createdAt), "yyyy-MM-dd");
        matchesDate = orderDate === dateFilter;
      }

      return matchesSearch && matchesDate;
    });
  }, [customerOrders, search, dateFilter]);

  const totalAmount = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPaid = customerOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalDue = totalAmount - totalPaid;

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingOrderId(id);
  };

  const renderPaymentStatus = (order: { paymentStatus: string; paidAmount: number; totalAmount: number }) => {
    const due = order.totalAmount - order.paidAmount;
    switch (order.paymentStatus) {
      case "fully_paid":
        return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">Fully Paid</span>;
      case "partially_paid":
        return (
          <div className="flex flex-col gap-0.5">
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">Partial</span>
            <span className="text-xs text-destructive font-medium">Due ₹{due.toLocaleString()}</span>
          </div>
        );
      default:
        return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">Pending</span>;
    }
  };

  const renderOrderStatus = (status: string) => {
    const s = (status || "").toLowerCase().trim();
    if (s === 'processed') {
      return (
        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold text-xs uppercase">
          PROCESSED
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 font-semibold text-xs uppercase">
        UNPROCESSED
      </span>
    );
  };

  const isLoading = ordersLoading || customersLoading;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/customers")} className="mb-4 -ml-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">
              {customer?.shopName ?? "Customer"} — Orders
            </h1>
            {customer?.ownerName && (
              <p className="text-muted-foreground mt-1">{customer.ownerName}</p>
            )}
          </div>
          {customer && (
            <div className="flex gap-2 text-sm">
              <span className="bg-muted px-3 py-1.5 rounded-full font-mono">{customer.username}</span>
              {customer.city && <span className="bg-muted px-3 py-1.5 rounded-full">{customer.city}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <ShoppingBag className="w-3.5 h-3.5" /> Total Orders
          </div>
          <p className="text-2xl font-bold">{customerOrders.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <IndianRupee className="w-3.5 h-3.5" /> Total Billed
          </div>
          <p className="text-2xl font-bold">₹{totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <IndianRupee className="w-3.5 h-3.5" /> Total Paid
          </div>
          <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <IndianRupee className="w-3.5 h-3.5" /> Balance Due
          </div>
          <p className={`text-2xl font-bold ${totalDue > 0 ? "text-destructive" : "text-green-600"}`}>
            ₹{totalDue.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search by Order ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              className="w-44"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter("")} className="text-xs text-muted-foreground px-2">
                Clear
              </Button>
            )}
          </div>
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
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order, index) => {
                  const displaySeq = filteredOrders.length - index;
                  return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/admin/orders/${order.id}`)}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {order.billingType === "with_gst" ? `GST-#${displaySeq}` : `#${displaySeq}`}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {isValid(parseISO(order.createdAt))
                          ? format(parseISO(order.createdAt), "dd MMM yyyy")
                          : order.createdAt}
                      </div>
                    </TableCell>
                    <TableCell>{order.itemCount} items</TableCell>
                    <TableCell className="text-right font-bold">₹{order.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      ₹{(order.paidAmount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>{renderPaymentStatus(order)}</TableCell>
                    <TableCell>
                      {renderOrderStatus(order.status)}
                    </TableCell>
                    <TableCell className="text-right">
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
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {customerOrders.length === 0
                        ? "This customer has no orders yet."
                        : "No orders match your search."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog open={deletingOrderId !== null} onOpenChange={(open) => { if (!open) setDeletingOrderId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete Order #{deletingOrderId}? This will remove the record, restore any allocated stock, and clear transactional logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingOrderId !== null) {
                  deleteOrder.mutate(
                    { id: deletingOrderId },
                    {
                      onSuccess: () => {
                        toast.success("Order deleted");
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
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
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
