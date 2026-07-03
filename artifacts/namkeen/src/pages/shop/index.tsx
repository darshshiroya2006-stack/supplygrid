import { useState } from "react";
import { ShopLayout } from "@/components/layout/ShopLayout";
import { useListProducts } from "@workspace/api-client-react";
import { Loader2, Search, Plus, Minus, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";

// Import generated images
import bhujiaImg from "@/assets/bhujia.png";
import sevImg from "@/assets/sev.png";
import chakliImg from "@/assets/chakli.png";
import mathriImg from "@/assets/mathri.png";
import moongDalImg from "@/assets/moong_dal.png";
import masalaPeanutsImg from "@/assets/masala_peanuts.png";
import alooBhujiaImg from "@/assets/aloo_bhujia.png";
import navratanMixImg from "@/assets/navratan_mix.png";
import khattaMeethaImg from "@/assets/khatta_meetha.png";
import placeholderImg from "@/assets/placeholder.png";

const seededProductImages: Record<string, string> = {
  "Aloo Bhujia": alooBhujiaImg,
  "Bikaneri Bhujia": bhujiaImg,
  "Moong Dal Namkeen": moongDalImg,
  "Masala Peanuts": masalaPeanutsImg,
  "Navratan Mix": navratanMixImg,
  "Khatta Meetha": khattaMeethaImg,
  "Chakli": chakliImg,
  "Mathri": mathriImg,
  "Sev": sevImg,
  "Cornflakes Mixture": navratanMixImg,
};

function resolveImageSrc(imageUrl: string | null | undefined, productName: string): string {
  if (imageUrl) {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
    return `/api/storage${imageUrl}`;
  }
  return seededProductImages[productName] || placeholderImg;
}

export default function ShopIndex() {
  const { data: products, isLoading } = useListProducts();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const addItem = useCart((state: { addItem: (item: import("@/hooks/use-cart").CartItem) => void }) => state.addItem);

  const categories = ["All", ...Array.from(new Set(products?.map(p => p.category || "Other") || []))].filter(Boolean);

  const filteredProducts = products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === "All" || (p.category || "Other") === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleQtyChange = (id: number, delta: number) => {
    setQuantities(prev => {
      const current = prev[id] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleQtySet = (id: number, value: string) => {
    const parsed = parseInt(value, 10);
    setQuantities(prev => ({ ...prev, [id]: isNaN(parsed) || parsed < 1 ? 1 : parsed }));
  };

  const handleAddToCart = (product: any, idx: number) => {
    const qty = quantities[product.id] || 1;
    const price = product.customerPrice !== null && product.customerPrice !== undefined 
      ? product.customerPrice 
      : product.basePrice;

    addItem({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      price: price,
      quantity: qty,
      imageUrl: resolveImageSrc(product.imageUrl, product.name)
    });

    toast.success(`Added ${qty} × ${product.name} to cart`);
    
    // Reset local quantity
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  return (
    <ShopLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Wholesale Catalog</h1>
        <p className="text-muted-foreground">Order premium snacks for your retail store. Prices shown are your specialized wholesale rates.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input 
            placeholder="Search products..." 
            className="pl-9 bg-card shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
          {categories.map(cat => (
            <Button 
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              className="whitespace-nowrap"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts?.map((product, idx) => {
            const hasCustomPrice = product.customerPrice !== null && product.customerPrice !== undefined;
            const price = hasCustomPrice ? product.customerPrice : product.basePrice;
            const currentQty = quantities[product.id] || 1;
            const isOutOfStock = (product.availableStock ?? 0) <= 0;

            return (
              <Card key={product.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all group flex flex-col">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  <img 
                    src={resolveImageSrc(product.imageUrl, product.name)} 
                    alt={product.name}
                    className={`w-full h-full object-cover transition-transform duration-500 ${isOutOfStock ? 'grayscale' : 'group-hover:scale-110'}`}
                  />
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center backdrop-blur-sm">
                      <span className="bg-destructive text-destructive-foreground px-4 py-2 font-bold rounded-md shadow-lg">
                        Out of Stock
                      </span>
                    </div>
                  )}
                  {hasCustomPrice && !isOutOfStock && (
                    <div className="absolute top-2 right-2 bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1 rounded shadow">
                      Special Rate
                    </div>
                  )}
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="font-serif font-bold text-lg leading-tight mb-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] mb-4">
                      {product.description || "Premium wholesale snack."}
                    </p>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <div className="text-xl font-bold text-primary">
                          ₹{price} <span className="text-sm font-normal text-muted-foreground">/ {product.unit}</span>
                        </div>
                        {hasCustomPrice && (
                          <div className="text-xs text-muted-foreground line-through">
                            Regular: ₹{product.basePrice}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center border rounded-md h-10 bg-background flex-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-full rounded-none rounded-l-md px-2 hover:bg-muted"
                          onClick={() => handleQtyChange(product.id, -1)}
                          disabled={isOutOfStock || currentQty <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <input
                          type="number"
                          min={1}
                          value={currentQty}
                          disabled={isOutOfStock}
                          onChange={(e) => handleQtySet(product.id, e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="flex-1 w-12 text-center font-medium text-sm bg-transparent focus:outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-full rounded-none rounded-r-md px-2 hover:bg-muted"
                          onClick={() => handleQtyChange(product.id, 1)}
                          disabled={isOutOfStock}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button 
                        className="h-10 px-4 flex-1 text-sm font-semibold" 
                        onClick={() => handleAddToCart(product, idx)}
                        disabled={isOutOfStock}
                      >
                        {isOutOfStock ? "Unavailable" : (
                          <>
                            <ShoppingCart className="w-4 h-4 mr-2 inline" />
                            Add to Cart
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredProducts?.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-card rounded-xl border">
              No products found matching your search.
            </div>
          )}
        </div>
      )}
    </ShopLayout>
  );
}
