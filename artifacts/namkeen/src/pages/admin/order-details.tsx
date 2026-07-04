import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Logo } from "@/components/Logo";
import {
  useGetOrder,
  useDeleteOrder,
  getListOrdersQueryKey,
  getGetOrderQueryKey,
  getListProductsQueryKey,
  getListStockEntriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, ArrowLeft, Printer, Trash2, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
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

const inrFmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 10 }).format(v);

export default function AdminOrderDetails() {
  const [, params] = useRoute("/admin/orders/:id");
  const orderId = Number(params?.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) },
  });
  const deleteOrder = useDeleteOrder();

  // Local draft states for live editing
  const [items, setItems] = useState<any[]>([]);
  const [serverSavedItems, setServerSavedItems] = useState<any[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (order && !hasLoaded) {
      const mapped = order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      }));
      setItems(mapped);
      setServerSavedItems(mapped);
      setHasLoaded(true);
    }
  }, [order, hasLoaded]);

  useEffect(() => {
    setHasLoaded(false);
  }, [orderId]);

  const handleConfirmDelete = () => {
    deleteOrder.mutate(
      { id: orderId },
      {
        onSuccess: () => {
          toast.success("Order deleted successfully");
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          setLocation("/admin/orders");
        },
        onError: () => toast.error("Failed to delete order"),
      }
    );
  };

  // Inline adjustment handlers
  const handleItemChange = (productId: number, field: "quantity" | "unitPrice", val: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const quantity = field === "quantity" ? val : item.quantity;
          const unitPrice = field === "unitPrice" ? val : item.unitPrice;
          const lineTotal = quantity * unitPrice;
          return { ...item, quantity, unitPrice, lineTotal };
        }
        return item;
      })
    );
  };

  const handleItemDelete = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveChanges();
    }
  };

  const handleSaveChanges = async () => {
    if (items.length === 0) {
      toast.error("An invoice must contain at least one item");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update order");
      }

      const freshOrder = await res.json();

      // Enforce strict query invalidations
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", orderId] }),
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListStockEntriesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ["stock_ledger"] }),
      ]);

      // Direct local state sync with server-validated data streams
      const mapped = freshOrder.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      }));
      setItems(mapped);
      setServerSavedItems(mapped);
      setHasLoaded(true);

      toast.success("Invoice adjustments saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Error saving adjustments");
    } finally {
      setIsSaving(false);
    }
  };

  // Form Dirtiness check
  const isFormDirty = JSON.stringify(items) !== JSON.stringify(serverSavedItems);

  // Reactive subtotal and billing metrics
  const itemsSubtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  let cgst = 0;
  let sgst = 0;
  let grandTotal = itemsSubtotal;

  if (order?.billingType === "with_gst") {
    cgst = itemsSubtotal * 0.025;
    sgst = itemsSubtotal * 0.025;
    grandTotal = itemsSubtotal + cgst + sgst;
  }

  const paidAmount = order?.paidAmount ?? 0;
  const balanceDue = Math.max(0, grandTotal - paidAmount);

  const paymentStatusLabel = () => {
    if (!order) return "";
    const computedStatus =
      paidAmount >= grandTotal ? "fully_paid" : paidAmount > 0 ? "partially_paid" : "pending";
    switch (computedStatus) {
      case "fully_paid":
        return "PAID IN FULL";
      case "partially_paid":
        return "PARTIALLY PAID";
      default:
        return "PAYMENT PENDING";
    }
  };

  const paymentStatusColor = () => {
    if (!order) return "";
    const computedStatus =
      paidAmount >= grandTotal ? "fully_paid" : paidAmount > 0 ? "partially_paid" : "pending";
    switch (computedStatus) {
      case "fully_paid":
        return "bg-green-100 text-green-700 border border-green-200";
      case "partially_paid":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      default:
        return "bg-red-100 text-red-700 border border-red-200";
    }
  };

  const handleSendWhatsApp = () => {
    if (!order) return;
    const invoiceNo = order.billingType === "with_gst"
      ? `GST-${order.sequenceNumber ?? order.id}`
      : `INV-${(order.sequenceNumber ?? order.id).toString().padStart(6, "0")}`;

    const message = `*Invoice ${invoiceNo}*

Hello ${order.shopName || order.customerName},
Your order has been conformed.
Total Amount: ₹${grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
Thank you for your business!`;

    let phone = order.phone || "";
    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = "91" + formattedPhone;
    }

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handlePrint = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/print`, {
        method: "PATCH",
        credentials: "include",
      });
      if (response.ok) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) }),
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["analytics"] }),
          queryClient.invalidateQueries({ queryKey: ["orders"] }),
        ]);
        
        // Allow the browser to paint the state change to the screen before printing dialog blocks the main thread
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (err) {
      console.error("Failed to mark order as printed:", err);
    }
    window.print();
  };

  return (
    <AdminLayout>
      {/* Controls — hidden when printing */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <Link href="/admin/orders">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Orders
          </Button>
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleSaveChanges}
            disabled={!isFormDirty || isSaving}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-emerald-700 transition-all duration-300 ease-in-out"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            className="gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-medium"
          >
            <MessageSquare className="w-4 h-4" /> Send to WhatsApp
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteAlert(true)} className="gap-2">
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center bg-card rounded-xl border">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : order ? (
        <div className="print-invoice-wrapper">
          <div
            id="invoice"
            className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-sm border max-w-3xl mx-auto print:shadow-none print:border-none print:rounded-none print:p-0 print:max-w-none"
          >
            {/* ── Header ── */}
            <div className="flex justify-between items-start pb-8 mb-8 border-b-2 border-gray-900">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Logo className="w-11 h-11" />
                  <div>
                    <h1 className="text-2xl font-serif font-bold text-gray-900 leading-tight">{order.sellerShopName || "Wholesaler"}</h1>
                    {order.sellerName && <p className="text-gray-500 text-xs">{order.sellerName}</p>}
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5 ml-1 mt-4">
                  {order.sellerAddress && <p>{order.sellerAddress}</p>}
                  {order.sellerPhone && <p>📞 +91 {order.sellerPhone}</p>}
                  {order.sellerGstin && <p>GSTIN: {order.sellerGstin}</p>}
                </div>
              </div>

              <div className="text-right">
                <p className="text-5xl font-serif font-bold text-gray-100 uppercase tracking-widest leading-none mb-4">
                  INVOICE
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-end gap-6">
                    <span className="text-gray-500 font-medium">Invoice No</span>
                    <span className="font-mono font-bold text-gray-900">
                      {order.billingType === "with_gst"
                        ? `GST-${order.sequenceNumber ?? order.id}`
                        : `INV-${(order.sequenceNumber ?? order.id).toString().padStart(6, "0")}`}
                    </span>
                  </div>
                  <div className="flex justify-end gap-6">
                    <span className="text-gray-500 font-medium">Date</span>
                    <span className="font-medium text-gray-900">
                      {format(new Date(order.createdAt), "dd MMM yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-end gap-6">
                    <span className="text-gray-500 font-medium">Order ID</span>
                    <span className="font-mono text-gray-900">
                      {order.billingType === "with_gst"
                        ? `GST-#${order.sequenceNumber ?? order.id}`
                        : `#${order.sequenceNumber ?? order.id}`}
                    </span>
                  </div>
                  <div className="flex justify-end gap-6">
                    <span className="text-gray-500 font-medium">Status</span>
                    <span className="font-medium uppercase text-gray-900">{order.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bill To ── */}
            <div className="flex justify-between items-start mb-8 gap-8">
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bill To</p>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-gray-900">{order.shopName}</h4>
                  <p className="text-gray-600 text-sm mt-0.5">{order.customerName}</p>
                  <p className="text-gray-400 text-xs mt-2 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Customer ID: {order.customerId}
                  </p>
                </div>
              </div>

              {/* Payment Status Badge - Hidden during hardcopy print */}
              <div className="text-right print:hidden">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Payment</p>
                <span className={`inline-block px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide ${paymentStatusColor()}`}>
                  {paymentStatusLabel()}
                </span>
                {balanceDue > 0 && (
                  <p className="text-xs text-red-600 font-medium mt-1.5">
                    Balance Due: {inrFmt(balanceDue)}
                  </p>
                )}
              </div>
            </div>

            {/* ── Items Table ── */}
            <div className="mb-8">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-900 hover:bg-gray-900">
                    <TableHead className="text-white text-center w-10 rounded-tl-lg">#</TableHead>
                    <TableHead className="text-white font-semibold">Item Description</TableHead>
                    <TableHead className="text-white text-right font-semibold">Unit</TableHead>
                    <TableHead className="text-white text-right font-semibold w-24">Qty</TableHead>
                    <TableHead className="text-white text-right font-semibold w-28">Rate (₹)</TableHead>
                    <TableHead className="text-white text-right font-semibold print:rounded-tr-lg">Amount (₹)</TableHead>
                    <TableHead className="text-white text-center w-12 rounded-tr-lg print:hidden" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className="text-center text-gray-400 text-sm">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-gray-900">{item.productName}</TableCell>
                      <TableCell className="text-right text-gray-500 text-sm">{item.unit}</TableCell>

                      {/* Interactive Qty input */}
                      <TableCell className="text-right print:hidden">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.productId, "quantity", Number(e.target.value))}
                          onKeyDown={handleInputKeyDown}
                          className="h-8 text-right font-medium bg-transparent border-gray-200 focus:bg-white"
                          min={0.1}
                          step={0.1}
                        />
                      </TableCell>
                      <TableCell className="text-right hidden print:table-cell font-medium text-gray-900">
                        {item.quantity}
                      </TableCell>

                      {/* Interactive Rate input */}
                      <TableCell className="text-right print:hidden">
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(item.productId, "unitPrice", Number(e.target.value))}
                          onKeyDown={handleInputKeyDown}
                          className="h-8 text-right font-medium bg-transparent border-gray-200 focus:bg-white"
                          min={0}
                        />
                      </TableCell>
                      <TableCell className="text-right hidden print:table-cell text-gray-500">
                        {Number(item.unitPrice).toLocaleString()}
                      </TableCell>

                      <TableCell className="text-right font-bold text-gray-900">
                        {Number(item.lineTotal).toLocaleString()}
                      </TableCell>

                      {/* Delete action row */}
                      <TableCell className="text-center print:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleItemDelete(item.productId)}
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* ── Totals + Notes ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-8">
              <div className="w-full sm:w-1/2">
                {order.notes && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</p>
                    <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 p-3 rounded-lg leading-relaxed">
                      {order.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-64">
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2.5">
                  {order.billingType === "with_gst" ? (
                    <>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>{inrFmt(itemsSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>CGST (2.5%)</span>
                        <span>{inrFmt(cgst)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>SGST (2.5%)</span>
                        <span>{inrFmt(sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>{inrFmt(itemsSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Tax (0%)</span>
                        <span>₹0</span>
                      </div>
                    </>
                  )}
                  <Separator className="bg-gray-200" />
                  <div className="flex justify-between font-bold text-gray-900 text-base">
                    <span>Grand Total</span>
                    <span>{inrFmt(grandTotal)}</span>
                  </div>
                  {paidAmount > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-green-600 font-medium">
                        <span>Amount Paid</span>
                        <span>– {inrFmt(paidAmount)}</span>
                      </div>
                      <Separator className="bg-gray-200" />
                      <div className={`flex justify-between font-bold text-base ${balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
                        <span>{balanceDue > 0 ? "Balance Due" : "Fully Paid"}</span>
                        <span>{inrFmt(balanceDue)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-400">
              <div className="text-center sm:text-left">
                <p className="font-semibold text-gray-600 text-sm mb-0.5">Thank you for your business!</p>
                <p>powered by supplygrid &nbsp;|&nbsp; +91 8347783720</p>
              </div>
              <div className="text-center sm:text-right">
                <p>This is a computer generated invoice.</p>
                <p>No signature required.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-muted-foreground bg-card rounded-xl border">
          Order not found.
        </div>
      )}

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wholesale Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Order {order ? (order.billingType === "with_gst" ? `GST-#${order.sequenceNumber}` : `#${order.sequenceNumber}`) : `#${orderId}`}? This action will permanently remove the record from the database, restore the allocated product stock items, and clear the transactional sales logs. This action cannot be undone.
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
