import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  getListSuppliersQueryKey,
  Supplier,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Loader2, BookOpen, Building2, Phone, Package, Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Link } from "wouter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format } from "date-fns";

const supplierSchema = z.object({
  name: z.string().min(2, "Company/Supplier name is required"),
  mobile: z.string().optional().nullable(),
  mainProducts: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export default function AdminStock() {
  const queryClient = useQueryClient();
  const { data: suppliers, isLoading } = useListSuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplierId, setDeletingSupplierId] = useState<number | null>(null);

  const filteredSuppliers = useMemo(() =>
    suppliers?.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.mobile?.toLowerCase().includes(search.toLowerCase()) ||
      s.mainProducts?.toLowerCase().includes(search.toLowerCase())
    ), [suppliers, search]);

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", mobile: "", mainProducts: "", notes: "" },
  });

  const openCreateDialog = () => {
    form.reset({ name: "", mobile: "", mainProducts: "", notes: "" });
    setEditingSupplier(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    form.reset({
      name: supplier.name,
      mobile: supplier.mobile ?? "",
      mainProducts: supplier.mainProducts ?? "",
      notes: supplier.notes ?? "",
    });
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const onSubmit = (values: z.infer<typeof supplierSchema>) => {
    if (editingSupplier) {
      updateSupplier.mutate(
        { id: editingSupplier.id, data: values },
        {
          onSuccess: () => {
            toast.success("Supplier updated");
            queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
            setIsFormOpen(false);
          },
          onError: () => toast.error("Failed to update supplier"),
        }
      );
    } else {
      createSupplier.mutate(
        { data: values },
        {
          onSuccess: () => {
            toast.success("Supplier added");
            queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
            setIsFormOpen(false);
          },
          onError: () => toast.error("Failed to add supplier"),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    setDeletingSupplierId(id);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Stock Ledger</h1>
          <p className="text-muted-foreground mt-1">Manage wholesale suppliers and their purchase ledgers</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col lg:flex-row items-start lg:items-center justify-end gap-4">
          <div className="relative w-full lg:w-64 self-end lg:self-center">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search supplier or products..."
              className="pl-9 bg-background"
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
                  <TableHead className="w-12">Sr.</TableHead>
                  <TableHead>Company / Supplier Name</TableHead>
                  <TableHead>Mobile Number</TableHead>
                  <TableHead>Main Products Supplied</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers?.map((supplier, idx) => (
                  <TableRow key={supplier.id} className="hover:bg-muted/40 cursor-pointer group">
                    <TableCell className="text-muted-foreground font-medium">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{supplier.name}</div>
                          {supplier.notes && (
                            <div className="text-xs text-muted-foreground">{supplier.notes}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.mobile ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          {supplier.mobile}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.mainProducts ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-foreground">{supplier.mainProducts}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/admin/stock/supplier/${supplier.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary hover:bg-primary/10 mr-1"
                        >
                          <BookOpen className="w-4 h-4 mr-1" />
                          Ledger
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(supplier)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSuppliers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {search ? "No suppliers match your search." : "No suppliers yet. Add your first supplier!"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create / Edit Supplier Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? "Update supplier details."
                : "Add a new wholesale supplier to your directory."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company / Supplier Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Marwar Foods Pvt Ltd" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 9876543210" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mainProducts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Products Supplied</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Raw Peanuts, Maida, Besan" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Any additional info..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSupplier.isPending || updateSupplier.isPending}>
                  {(createSupplier.isPending || updateSupplier.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingSupplierId !== null} onOpenChange={(open) => { if (!open) setDeletingSupplierId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier? Their main profile will be removed, but all historic purchase ledger logs and entries will remain archived. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingSupplierId !== null) {
                  deleteSupplier.mutate(
                    { id: deletingSupplierId },
                    {
                      onSuccess: () => {
                        toast.success("Supplier deleted");
                        queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
                        setDeletingSupplierId(null);
                      },
                      onError: () => {
                        toast.error("Failed to delete supplier");
                        setDeletingSupplierId(null);
                      }
                    }
                  );
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              disabled={deleteSupplier.isPending}
            >
              {deleteSupplier.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
