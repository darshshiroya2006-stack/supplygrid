import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRoute } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { 
  useGetCustomerPricing, 
  useSetCustomerPricing, 
  useGetCustomer,
  getGetCustomerPricingQueryKey,
  getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Save, IndianRupee, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Link } from "wouter";

export default function AdminCustomerPricing() {
  const [, params] = useRoute("/admin/customers/:id/pricing");
  const customerId = Number(params?.id);
  const queryClient = useQueryClient();

  const { data: customer, isLoading: customerLoading } = useGetCustomer(customerId, {
    query: { enabled: !!customerId, queryKey: getGetCustomerQueryKey(customerId) },
  });
  const { data: pricing, isLoading: pricingLoading } = useGetCustomerPricing(customerId, {
    query: { enabled: !!customerId, queryKey: getGetCustomerPricingQueryKey(customerId) },
  });
  const setPricing = useSetCustomerPricing();

  const [search, setSearch] = useState("");
  // Local state for edits
  const [edits, setEdits] = useState<Record<number, string>>({});

  const filteredPricing = useMemo(() => {
    if (!pricing) return [];
    return pricing.filter(item => 
      item.productName.toLowerCase().includes(search.toLowerCase())
    );
  }, [pricing, search]);
  
  // When a price is modified, save it
  const handlePriceChange = (productId: number, value: string) => {
    setEdits(prev => ({ ...prev, [productId]: value }));
  };

  const handlePriceSave = (productId: number) => {
    const value = edits[productId];
    if (value === undefined) return;
    
    // Parse value. Empty string means remove custom price
    const customPrice = value.trim() === "" ? null : Number(value);
    
    if (customPrice !== null && isNaN(customPrice)) {
      toast.error("Please enter a valid number");
      return;
    }

    setPricing.mutate(
      { id: customerId, data: { productId, customPrice } },
      {
        onSuccess: () => {
          toast.success("Price updated");
          // Remove from local edits since it's saved
          setEdits(prev => {
            const next = { ...prev };
            delete next[productId];
            return next;
          });
          queryClient.invalidateQueries({ queryKey: getGetCustomerPricingQueryKey(customerId) });
        },
        onError: () => toast.error("Failed to update price")
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, productId: number) => {
    if (e.key === "Enter") {
      handlePriceSave(productId);
      e.currentTarget.blur();
    }
  };

  const clearEdit = (productId: number) => {
    setEdits(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link href="/admin/customers">
          <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customers
          </Button>
        </Link>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Custom Pricing</h1>
            {customerLoading ? (
              <div className="h-5 w-48 bg-muted animate-pulse rounded mt-1"></div>
            ) : (
              <p className="text-muted-foreground mt-1">
                Pricing for <strong className="text-foreground">{customer?.shopName}</strong>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input 
              placeholder="Search product..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {pricingLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Product</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead className="w-1/3">Custom Price (₹)</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPricing?.map((item) => {
                  const hasEdit = edits[item.productId] !== undefined;
                  const displayValue = hasEdit ? edits[item.productId] : (item.customPrice ?? "");
                  
                  return (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                      <TableCell>₹{item.basePrice}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <Input 
                            type="number" 
                            min="0"
                            step="any"
                            placeholder="Same as base" 
                            className={`h-9 ${hasEdit ? "border-primary" : ""}`}
                            value={displayValue}
                            onChange={(e) => handlePriceChange(item.productId, e.target.value)}
                            onBlur={() => handlePriceSave(item.productId)}
                            onKeyDown={(e) => handleKeyDown(e, item.productId)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {hasEdit ? (
                          <span className="text-xs text-primary font-medium flex items-center justify-end gap-1">
                            <Save className="w-3 h-3" /> Unsaved
                          </span>
                        ) : item.customPrice !== null ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-secondary/20 text-secondary-foreground text-xs font-medium">
                            Custom
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Base</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPricing?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No products found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
        <IndianRupee className="w-4 h-4" /> 
        Leave custom price empty to use the product's base price. Edits auto-save when clicking away.
      </p>
    </AdminLayout>
  );
}
