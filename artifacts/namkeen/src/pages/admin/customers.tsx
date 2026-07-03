import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, getListCustomersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Loader2, IndianRupee, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Customer } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
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

const customerSchema = z.object({
  shopName: z.string().min(2, "Shop Name is required"),
  ownerName: z.string().optional().nullable(),
  username: z.string().min(3, "Username is required for login"),
  password: z.string().min(1, "Password is required for new accounts").optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  alwaysGst: z.boolean().default(false),
});

export default function AdminCustomers() {
  const queryClient = useQueryClient();
  const { data: customers, isLoading } = useListCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<number | null>(null);

  const filteredCustomers = customers?.filter(c => 
    c.shopName.toLowerCase().includes(search.toLowerCase()) || 
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      shopName: "", ownerName: "", username: "", password: "", phone: "", city: "", address: "", alwaysGst: false
    },
  });

  const openCreateDialog = () => {
    form.reset({ shopName: "", ownerName: "", username: "", password: "", phone: "", city: "", address: "", alwaysGst: false });
    setEditingCustomer(null);
    setIsCreateOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    form.reset({
      shopName: customer.shopName,
      ownerName: customer.ownerName,
      username: customer.username,
      password: "", // don't load password, leave empty
      phone: customer.phone,
      city: customer.city,
      address: customer.address,
      alwaysGst: customer.alwaysGst || false,
    });
    setEditingCustomer(customer);
    setIsCreateOpen(true);
  };

  const onSubmit = (values: z.infer<typeof customerSchema>) => {
    if (editingCustomer) {
      // Don't send empty password if updating
      const payload = { ...values };
      if (!payload.password) delete payload.password;
      
      updateCustomer.mutate(
        { id: editingCustomer.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Customer updated successfully");
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
            setIsCreateOpen(false);
          },
          onError: (e: unknown) => toast.error((e as { data?: { message?: string } })?.data?.message || "Failed to update customer")
        }
      );
    } else {
      if (!values.password) {
        form.setError("password", { message: "Password is required for new accounts" });
        return;
      }
      createCustomer.mutate(
        { data: values as any }, // casting because we checked password exists
        {
          onSuccess: () => {
            toast.success("Customer created successfully");
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
            setIsCreateOpen(false);
          },
          onError: (e: unknown) => toast.error((e as { data?: { message?: string } })?.data?.message || "Failed to create customer")
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    setDeletingCustomerId(id);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Retail Customers</h1>
          <p className="text-muted-foreground mt-1">Manage shop accounts and access</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input 
              placeholder="Search by shop name, username or city..." 
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
                  <TableHead>Shop Name</TableHead>
                  <TableHead>Login ID</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{customer.shopName}</div>
                      {customer.ownerName && <div className="text-xs text-muted-foreground">{customer.ownerName}</div>}
                    </TableCell>
                    <TableCell>
                      <span className="bg-muted px-2 py-1 rounded text-xs font-mono">{customer.username}</span>
                    </TableCell>
                    <TableCell>{customer.phone || "-"}</TableCell>
                    <TableCell>{customer.city || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/customers/${customer.id}/orders`}>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted mr-1">
                          <ShoppingBag className="w-4 h-4 mr-1" />
                          Orders
                        </Button>
                      </Link>
                      <Link href={`/admin/customers/${customer.id}/pricing`}>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 mr-2">
                          <IndianRupee className="w-4 h-4 mr-1" />
                          Pricing
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(customer)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(customer.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCustomers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No customers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? "Update customer details." : "Create a new retailer account. They can use these credentials to log in."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shopName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ownerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Name</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Login Username</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{editingCustomer ? "New Password (Optional)" : "Password"}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={editingCustomer ? "Leave blank to keep current" : ""} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Address</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="alwaysGst"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/30">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">Always Generate GST Bills for this Retailer</FormLabel>
                      <div className="text-xs text-muted-foreground">
                        All new orders placed by this customer will automatically default to GST bills.
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                  {(createCustomer.isPending || updateCustomer.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingCustomerId !== null} onOpenChange={(open) => { if (!open) setDeletingCustomerId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Customer Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer account? This will wipe out their client credentials, but historic order records will remain archived under transactional tracking constraints. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingCustomerId !== null) {
                  deleteCustomer.mutate(
                    { id: deletingCustomerId },
                    {
                      onSuccess: () => {
                        toast.success("Customer deleted successfully");
                        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
                        setDeletingCustomerId(null);
                      },
                      onError: () => {
                        toast.error("Failed to delete customer");
                        setDeletingCustomerId(null);
                      }
                    }
                  );
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              disabled={deleteCustomer.isPending}
            >
              {deleteCustomer.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
