import { useState } from "react";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { useCart } from "@/hooks/use-cart";
import { useCreateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useWholesalerStore } from "@/hooks/use-wholesaler";

export default function ShopCart() {
  const { items, removeItem, updateQuantity, getCartTotal, clearCart } = useCart();
  const { selectedWholesalerId } = useWholesalerStore();
  const total = getCartTotal();
  const createOrder = useCreateOrder();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const handleCheckout = () => {
    if (items.length === 0) return;

    const orderItems = items.map((item: import("@/hooks/use-cart").CartItem) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    createOrder.mutate(
      {
        data: {
          items: orderItems,
          notes: notes || null,
          wholesalerId: selectedWholesalerId || undefined,
          wholesaler_id: selectedWholesalerId || undefined,
        } as any
      },
      {
        onSuccess: (order) => {
          toast.success("Order placed successfully!");
          clearCart();
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          setLocation(`/shop/orders/${order.id}`);
        },
        onError: () => {
          toast.error("Failed to place order. Please try again.");
        }
      }
    );
  };

  if (items.length === 0) {
    return (
      <ShopLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground max-w-md mb-8">
            Looks like you haven't added any products to your wholesale cart yet.
          </p>
          <Link href="/shop">
            <Button size="lg">Browse Products</Button>
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Review Order</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-4">
          {items.map((item: import("@/hooks/use-cart").CartItem) => (
            <Card key={item.productId} className="border-none shadow-sm">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-foreground truncate">{item.productName}</h3>
                  <div className="text-primary font-bold">
                    ₹{item.price} <span className="text-sm font-normal text-muted-foreground">/ {item.unit}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-6 mt-2 sm:mt-0">
                  <div className="flex items-center border rounded-md h-10 bg-background">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-full rounded-none rounded-l-md px-3 hover:bg-muted"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <div className="w-12 text-center font-medium text-sm">
                      {item.quantity}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-full rounded-none rounded-r-md px-3 hover:bg-muted"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="text-right w-24">
                    <div className="font-bold">₹{(item.price * item.quantity).toLocaleString()}</div>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-none shadow-sm mt-6">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-3">Order Notes</h3>
              <Textarea 
                placeholder="Any special instructions for packaging or delivery? (Optional)"
                className="min-h-[100px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <Card className="border-none shadow-md sticky top-24">
            <CardContent className="p-6">
              <h3 className="font-serif font-bold text-xl mb-6">Order Summary</h3>
              
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items ({items.length})</span>
                  <span>₹{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery</span>
                  <span>Calculated later</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>Calculated later</span>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between text-lg font-bold text-foreground">
                  <span>Estimated Total</span>
                  <span className="text-primary">₹{total.toLocaleString()}</span>
                </div>
              </div>

              <Button 
                className="w-full text-base h-12" 
                size="lg" 
                onClick={handleCheckout}
                disabled={createOrder.isPending}
              >
                {createOrder.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <>Place Order <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                You can send this bill via WhatsApp after placing the order.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ShopLayout>
  );
}
