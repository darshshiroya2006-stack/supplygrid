import { useState } from "react";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { useListOrders } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Loader2, Calendar, ChevronRight, PackageCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ListOrdersRange } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { useWholesalerStore } from "@/hooks/use-wholesaler";

export default function ShopOrders() {
  const [range, setRange] = useState<ListOrdersRange>("30d");
  const { selectedWholesalerId } = useWholesalerStore();
  const { data: orders, isLoading } = useListOrders({
    range,
    wholesalerId: selectedWholesalerId || undefined,
  } as any);
  const [, setLocation] = useLocation();

  const renderStatusBadge = (status: string) => {
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

  return (
    <ShopLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">My Orders</h1>
          <p className="text-muted-foreground mt-1">Track your wholesale order history</p>
        </div>
      </div>

      <div className="flex gap-2 bg-card p-1 rounded-lg border w-full sm:w-auto inline-flex mb-6 shadow-sm overflow-x-auto">
        {(["7d", "30d", "90d", "all"] as ListOrdersRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              range === r 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : r === "90d" ? "Last 3 Months" : "All Time"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order, index) => {
            const displaySeq = orders.length - index;
            return (
            <Card 
              key={order.id} 
              className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setLocation(`/shop/orders/${order.id}`)}
            >
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <PackageCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg text-foreground">
                          Order {order.billingType === "with_gst" ? `GST-#${displaySeq}` : `#${displaySeq}`}
                        </h3>
                        {renderStatusBadge(order.status)}
                      </div>
                      <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-x-4 gap-y-1">
                        <span className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1.5" />
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span>{order.itemCount} items</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-0 pt-4 sm:pt-0">
                    <div className="text-left sm:text-right mr-6">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total Amount</div>
                      <div className="font-bold text-lg text-primary">₹{order.totalAmount.toLocaleString()}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      ) : (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center bg-card rounded-xl border border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground mb-2">No orders found</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            You haven't placed any orders in this time period.
          </p>
          <Link href="/shop">
            <Button>Start Shopping</Button>
          </Link>
        </div>
      )}
    </ShopLayout>
  );
}
