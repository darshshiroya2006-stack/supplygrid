import { useState, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Loader2, Image as ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Product } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
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

const STORAGE_BASE = "/api/storage";

function productImageSrc(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${STORAGE_BASE}${imageUrl}`;
}

const productSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unit: z.string().min(1, "Unit is required"),
  basePrice: z.coerce.number().min(0, "Price must be positive"),
  imageUrl: z.string().optional().nullable(),
  inStock: z.boolean().default(true),
});

type ProductForm = z.infer<typeof productSchema>;

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "", description: "", category: "Snacks", unit: "1 KG",
      basePrice: 0, imageUrl: null, inStock: true,
    },
  });

  const currentImageUrl = form.watch("imageUrl");
  const imageSrc = productImageSrc(currentImageUrl);

  const { uploadFile, isUploading, progress } = useUpload({
    basePath: STORAGE_BASE,
    onSuccess: (res) => {
      form.setValue("imageUrl", res.objectPath, { shouldDirty: true });
      toast.success("Photo uploaded");
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    form.reset({ name: "", description: "", category: "Snacks", unit: "1 KG", basePrice: 0, imageUrl: null, inStock: true });
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    form.reset({
      name: product.name,
      description: product.description,
      category: product.category,
      unit: product.unit,
      basePrice: product.basePrice,
      imageUrl: product.imageUrl ?? null,
      inStock: product.inStock,
    });
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const onSubmit = (values: ProductForm) => {
    const payload = { ...values, imageUrl: values.imageUrl || null };
    if (editingProduct) {
      updateProduct.mutate(
        { id: editingProduct.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Product updated");
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            setIsDialogOpen(false);
          },
          onError: () => toast.error("Failed to update product"),
        }
      );
    } else {
      createProduct.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast.success("Product created");
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            setIsDialogOpen(false);
          },
          onError: () => toast.error("Failed to create product"),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    setDeletingProductId(id);
  };

  const handleConfirmDelete = () => {
    if (deletingProductId === null) return;
    deleteProduct.mutate(
      { id: deletingProductId },
      {
        onSuccess: () => {
          toast.success("Product deleted");
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setDeletingProductId(null);
        },
        onError: () => {
          toast.error("Failed to delete product");
          setDeletingProductId(null);
        },
      }
    );
  };

  const toggleStock = (product: Product) => {
    updateProduct.mutate(
      { id: product.id, data: { inStock: !product.inStock } },
      {
        onSuccess: () => {
          toast.success(`Marked as ${!product.inStock ? "In Stock" : "Out of Stock"}`);
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        },
        onError: () => toast.error("Failed to update stock status"),
      }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WebP, etc.)");
      return;
    }
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your catalog and inventory</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                  <TableHead className="w-14">Photo</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Available Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {filteredProducts?.map((product) => {
                  const src = productImageSrc(product.imageUrl);

                  // Extract packaging multiplier prefix (e.g. "1 KG" -> multiplier=1, metric="KG")
                  const match = product.unit.trim().match(/^(\d+)\s*(.*)$/);
                  let qty = 1;
                  let metric = product.unit;
                  if (match) {
                    qty = parseInt(match[1], 10);
                    metric = match[2];
                  }

                  const stock = product.availableStock ?? 0;
                  const isOutOfStock = stock <= 0;
                  const isLowStock = stock > 0 && stock < 15;

                  let badgeClass = "";
                  let statusLabel = "";

                  if (isOutOfStock) {
                    badgeClass = "bg-red-50 text-red-700 border-red-200 hover:bg-red-50";
                    statusLabel = "Out of Stock";
                  } else if (isLowStock) {
                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50";
                    statusLabel = `${stock} Left`;
                  } else {
                    badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50";
                    statusLabel = `${stock} Left`;
                  }

                  return (
                    <TableRow key={product.id} className={!product.inStock ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                          {src ? (
                            <img
                              src={src}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{product.description}</div>
                        )}
                      </TableCell>
                      <TableCell>{product.category || "—"}</TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell className="font-medium">₹{product.basePrice}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-start">
                          <Badge variant="outline" className={`${badgeClass} font-bold text-xs px-2.5 py-0.5 shadow-xs border`}>
                            {statusLabel}
                          </Badge>
                          {!isOutOfStock && (
                            <span className="text-xs text-muted-foreground font-medium pl-0.5">
                              {qty === 1 ? (
                                `${stock} ${metric}`
                              ) : (
                                `${stock} packs (${qty} per pack)`
                              )}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)} title="Edit">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(product.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredProducts?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Update the product details below." : "Fill in the details for the new product."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} placeholder="Short description…" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. Bhujia" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. 1 KG" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="basePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Price (₹)</FormLabel>
                      <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {editingProduct ? (
                  <div className="flex flex-row items-center justify-between rounded-lg border p-3 mt-8 h-[42px] bg-muted/30">
                    <span className="text-sm font-medium">Available Stock</span>
                    <span className={`text-sm font-bold ${
                      (editingProduct.availableStock ?? 0) <= 0 
                        ? "text-destructive" 
                        : (editingProduct.availableStock ?? 0) < 10 
                          ? "text-amber-600 font-bold" 
                          : "text-emerald-600"
                    }`}>
                      {editingProduct.availableStock ?? 0} {editingProduct.unit}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-row items-center justify-between rounded-lg border border-dashed p-3 mt-8 h-[42px] bg-muted/10 text-muted-foreground">
                    <span className="text-sm font-medium">Initial Stock</span>
                    <span className="text-xs italic">Set via Stock Ledger</span>
                  </div>
                )}
              </div>

              {/* Product Photo Upload */}
              <FormField
                control={form.control}
                name="imageUrl"
                render={() => (
                  <FormItem>
                    <FormLabel>Product Photo</FormLabel>

                    {/* Preview area */}
                    <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 overflow-hidden bg-muted/30">
                      {imageSrc ? (
                        <div className="relative group">
                          <img
                            src={imageSrc}
                            alt="Product preview"
                            className="w-full h-44 object-cover"
                            onError={(e) => {
                              (e.currentTarget.parentElement!.parentElement!).classList.add("no-img");
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              Change
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => form.setValue("imageUrl", null)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full py-8 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          ) : (
                            <ImageIcon className="w-8 h-8" />
                          )}
                          <span className="text-sm font-medium">
                            {isUploading ? "Uploading…" : "Click to upload photo"}
                          </span>
                          <span className="text-xs">JPG, PNG, WebP supported</span>
                        </button>
                      )}
                    </div>

                    {/* Progress bar */}
                    {isUploading && (
                      <Progress value={progress} className="h-1.5 mt-1" />
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending || isUploading}>
                  {(createProduct.isPending || updateProduct.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Save Product
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingProductId !== null} onOpenChange={(open) => { if (!open) setDeletingProductId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Catalog Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? Removing this item will permanently clear its pricing, current stock ledger history, and catalog data from the inventory logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingProductId !== null) {
                  deleteProduct.mutate(
                    { id: deletingProductId },
                    {
                      onSuccess: () => {
                        toast.success("Product deleted successfully");
                        setDeletingProductId(null);
                        // Force a clean cache invalidation using a generic query prefix or direct window state refresh
                        queryClient.invalidateQueries(); 
                        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
                        queryClient.invalidateQueries({ queryKey: ["analytics"] });
                      },
                      onError: () => {
                        toast.error("Failed to delete product");
                        setDeletingProductId(null);
                      },
                    }
                  );
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
