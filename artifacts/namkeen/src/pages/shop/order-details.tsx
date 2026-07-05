import { useRoute, Link } from "wouter";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Loader2, ArrowLeft, Printer, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/Logo";

const ADMIN_WHATSAPP = "+919999999999";

export default function ShopOrderDetails() {
  const [, params] = useRoute("/shop/orders/:id");
  const orderId = Number(params?.id);

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId) },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!order) return;
    
    const displayId = order.billingType === "with_gst" ? `GST-#${order.sequenceNumber}` : `#${order.sequenceNumber}`;
    let text = `*New Order: ${displayId}*\n`;
    text += `*Shop:* ${order.shopName}\n`;
    text += `*Date:* ${format(new Date(order.createdAt), "dd MMM yyyy")}\n\n`;
    text += `*Items:*\n`;
    
    order.items.forEach((item, index) => {
      text += `${index + 1}. ${item.productName} - ${item.quantity} ${item.unit} @ ₹${item.unitPrice}\n`;
    });
    
    text += `\n*Total Amount: ₹${order.totalAmount.toLocaleString()}*`;
    if (order.notes) {
      text += `\n\n*Notes:* ${order.notes}`;
    }

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodedText}`, '_blank');
  };

  return (
    <ShopLayout>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <Link href="/shop/orders">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Orders
          </Button>
        </Link>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button onClick={handleWhatsApp} className="bg-[#25D366] hover:bg-[#20bd5a] text-white flex-1 sm:flex-none">
            <MessageCircle className="w-4 h-4 mr-2" /> Send via WhatsApp
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center bg-card rounded-xl border shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : order ? (
        <div className="bg-card text-foreground p-6 sm:p-10 rounded-xl shadow-sm border max-w-4xl mx-auto print:shadow-none print:border-none print:p-0 print:bg-white print:text-black">
          {/* Status banner */}
          <div className={`print:hidden border rounded-lg p-4 mb-8 flex items-center justify-between ${
            order.status.toLowerCase() === 'processed'
              ? 'bg-green-500/10 border-green-500/20 text-green-700'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-700'
          }`}>
            <div>
              <p className="text-sm font-medium opacity-80">Order Status</p>
              <h2 className="text-lg font-bold uppercase">{order.status}</h2>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium opacity-80">Order Date</p>
              <p className="font-medium text-foreground">{format(new Date(order.createdAt), "dd MMM yyyy, hh:mm a")}</p>
            </div>
          </div>

          {/* Bill Header */}
          <div className="flex flex-col md:flex-row justify-between items-start border-b pb-8 mb-8 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Logo className="w-12 h-12" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-foreground">{order.sellerShopName || "Wholesaler"}</h1>
              {order.sellerName && <p className="text-muted-foreground mt-1 text-sm">{order.sellerName}</p>}
              <div className="text-sm text-muted-foreground mt-2">
                {order.sellerPhone && <p>📞 +91 {order.sellerPhone}</p>}
                {order.sellerAddress && <p>{order.sellerAddress}</p>}
                {order.sellerGstin && <p>GSTIN: {order.sellerGstin}</p>}
              </div>
            </div>
            <div className="text-left md:text-right bg-muted/30 p-4 rounded-lg border w-full md:w-auto print:bg-transparent print:border-none print:p-0">
              <h2 className="text-xl font-bold text-foreground mb-4">
                INVOICE {order.billingType === "with_gst" ? `GST-#${order.sequenceNumber}` : `#${order.sequenceNumber}`}
              </h2>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground mb-2">Billed To:</p>
                <p className="font-bold text-base text-foreground">{order.shopName}</p>
                <p className="text-foreground">{order.customerName}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-lg border overflow-hidden mb-8 print:border-gray-200">
            <Table>
              <TableHeader className="bg-muted/50 print:bg-gray-50">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="font-semibold text-foreground">Item Description</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Unit</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Qty</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Rate</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium text-foreground">{item.productName}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">₹{item.unitPrice}</TableCell>
                    <TableCell className="text-right font-medium">₹{item.lineTotal.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-end gap-8">
            <div className="w-full sm:w-1/2">
              {order.notes && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Your Notes:</h3>
                  <p className="text-sm text-foreground bg-muted/30 p-3 rounded border">{order.notes}</p>
                </div>
              )}
            </div>
            <div className="w-full sm:w-64 space-y-3 bg-muted/10 p-4 rounded-lg border print:bg-transparent print:border-none print:p-0">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{order.totalAmount.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold text-foreground">
                <span>Total</span>
                <span className="text-primary">₹{order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          {/* Print instructions */}
          <div className="mt-12 text-center text-sm text-muted-foreground print:hidden">
            <p>Please click "Send via WhatsApp" to share this order with the admin.</p>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-muted-foreground bg-card rounded-xl border">
          Order not found.
        </div>
      )}
    </ShopLayout>
  );
}
