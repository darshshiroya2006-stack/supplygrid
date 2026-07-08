import { useState, useMemo, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useGetSupplier,
  useListSupplierEntries,
  useCreateStockEntry,
  useUpdateStockEntry,
  useDeleteStockEntry,
  useRecordStockPayment,
  useListProducts,
  getListSupplierEntriesQueryKey,
  getGetSupplierQueryKey,
  getListProductsQueryKey,
  getListStockEntriesQueryKey,
  StockEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Loader2, Calendar, IndianRupee,
  ArrowLeft, Search, Building2, Phone, Package, ChevronsUpDown, Check, X,
} from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
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
import { format } from "date-fns";
import { Link, useParams } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

const entrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  supplierName: z.string().min(2, "Supplier is required"),
  productName: z.string().min(2, "Product name is required"),
  quantityKg: z.coerce.number().min(0.1, "Quantity must be positive"),
  totalPrice: z.coerce.number().min(0, "Total price must be non-negative"),
  notes: z.string().optional().nullable(),
  unit: z.string().default("KG"),
  boxesPurchased: z.coerce.number().optional().nullable(),
  packetsPurchased: z.coerce.number().optional().nullable(),
});

export default function AdminSupplierLedger() {
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);
  const queryClient = useQueryClient();
  const inrFmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v);

  const { data: supplier, isLoading: supplierLoading } = useGetSupplier(supplierId);
  const { data: products, isLoading: productsLoading } = useListProducts();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(currentMonthIndex + 1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedDate(undefined);
    if (year === currentYear && selectedMonth !== "all" && selectedMonth > currentMonthIndex + 1) {
      setSelectedMonth(currentMonthIndex + 1);
    }
  };

  const queryParams = {
    year: selectedDate ? selectedDate.getFullYear() : selectedYear,
    month: String(selectedDate ? selectedDate.getMonth() + 1 : selectedMonth),
    day: String(selectedDate ? selectedDate.getDate() : "all"),
  };

  const { data: entries, isLoading: entriesLoading } = useListSupplierEntries(supplierId, queryParams);

  const createEntry = useCreateStockEntry();
  const updateEntry = useUpdateStockEntry();
  const deleteEntry = useDeleteStockEntry();
  const recordPayment = useRecordStockPayment();

  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [editingEntry, setEditingEntry] = useState<StockEntry | null>(null);
  const [paymentEntry, setPaymentEntry] = useState<StockEntry | null>(null);
  const [paymentInput, setPaymentInput] = useState("");
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [productComboOpen, setProductComboOpen] = useState(false);

  const filteredEntries = useMemo(() =>
    entries?.filter((e) =>
      e.productName.toLowerCase().includes(search.toLowerCase()) ||
      e.date.includes(search)
    ), [entries, search]);

  const form = useForm<z.infer<typeof entrySchema>>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      supplierName: supplier?.name ?? "",
      productName: "",
      quantityKg: 0,
      totalPrice: 0,
      notes: "",
      unit: "KG",
      boxesPurchased: null,
      packetsPurchased: null,
    },
  });

  const selectedProductName = form.watch("productName");
  const selectedProduct = useMemo(() => {
    return products?.find(p => p.name === selectedProductName);
  }, [products, selectedProductName]);

  const selectedUnit = form.watch("unit") || "KG";

  // If catalog product is selected, auto-select unit type in dropdown and pre-populate Sub-Unit conversion factor
  useEffect(() => {
    if (selectedProduct) {
      const isUnit = selectedProduct.unit && !selectedProduct.unit.toLowerCase().includes("kg");
      const unitVal = isUnit ? "Unit" : "KG";
      form.setValue("unit", unitVal);
      if (isUnit && selectedProduct.conversionFactor) {
        form.setValue("packetsPurchased", selectedProduct.conversionFactor);
      }
    }
  }, [selectedProduct, form]);

  const boxes = form.watch("boxesPurchased");
  const packets = form.watch("packetsPurchased");

  useEffect(() => {
    if (selectedUnit === "Unit") {
      const total = (Number(boxes) || 0) * (Number(packets) || 0);
      form.setValue("quantityKg", total);
    }
  }, [boxes, packets, selectedUnit, form]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListSupplierEntriesQueryKey(supplierId) });
    queryClient.invalidateQueries({ queryKey: getGetSupplierQueryKey(supplierId) });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListStockEntriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["stock_ledger"] });
    queryClient.invalidateQueries({ queryKey: ["customer_catalog"] });
    queryClient.invalidateQueries({ queryKey: ["shop_catalog"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });

    // Force immediate visual cache refetch
    queryClient.refetchQueries({ queryKey: getListProductsQueryKey() });
    queryClient.refetchQueries({ queryKey: getListStockEntriesQueryKey() });
    queryClient.refetchQueries({ queryKey: ["products"] });
    queryClient.refetchQueries({ queryKey: ["stock_ledger"] });
    queryClient.refetchQueries({ queryKey: ["customer_catalog"] });
    queryClient.refetchQueries({ queryKey: ["shop_catalog"] });
    queryClient.refetchQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.refetchQueries({ queryKey: ["analytics"] });
  };

  const openCreateDialog = () => {
    form.reset({
      date: new Date().toISOString().split("T")[0],
      supplierName: supplier?.name ?? "",
      productName: "",
      quantityKg: 0,
      totalPrice: 0,
      notes: "",
      unit: "KG",
      boxesPurchased: null,
      packetsPurchased: null,
    });
    setEditingEntry(null);
    setIsCustomProduct(false);
    setIsFormOpen(true);
  };

  const openEditDialog = (entry: StockEntry) => {
    const isCatalog = products?.some(p => p.name.trim().toLowerCase() === entry.productName.trim().toLowerCase()) ?? false;
    const prod = products?.find(p => p.name.trim().toLowerCase() === entry.productName.trim().toLowerCase());
    
    const isUnit = prod ? (prod.unit && !prod.unit.toLowerCase().includes("kg")) : false;
    const unitVal = isUnit ? "Unit" : "KG";

    let initialBoxes = null;
    let initialPackets = null;
    if (isUnit && prod?.conversionFactor && prod.conversionFactor > 0) {
      initialBoxes = Math.floor(entry.quantityKg / prod.conversionFactor);
      initialPackets = prod.conversionFactor;
    }

    form.reset({
      date: entry.date,
      supplierName: entry.supplierName,
      productName: entry.productName,
      quantityKg: entry.quantityKg,
      totalPrice: entry.totalPrice,
      notes: entry.notes,
      unit: unitVal,
      boxesPurchased: initialBoxes,
      packetsPurchased: initialPackets,
    });
    setEditingEntry(entry);
    setIsCustomProduct(!isCatalog);
    setIsFormOpen(true);
  };

  const onSubmit = (values: z.infer<typeof entrySchema>) => {
    const { boxesPurchased, packetsPurchased, unit, ...data } = values;
    const payload = {
      ...data,
      unit,
      mainUnit: unit === "Unit" ? "Main Unit" : null,
      subUnit: unit === "Unit" ? "Sub-Unit" : null,
      conversionFactor: unit === "Unit" ? Number(packetsPurchased) : null,
    };
    if (editingEntry) {
      updateEntry.mutate(
        { id: editingEntry.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Entry updated");
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["stock_ledger"] });
            queryClient.invalidateQueries({ queryKey: ["shop_catalog"] });
            invalidate();
            setIsFormOpen(false);
            queryClient.refetchQueries({ queryKey: ["products"] });
            queryClient.refetchQueries({ queryKey: ["stock_ledger"] });
            queryClient.refetchQueries({ queryKey: ["shop_catalog"] });
          },
          onError: () => toast.error("Failed to update entry"),
        }
      );
    } else {
      createEntry.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast.success("Purchase entry added");
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["stock_ledger"] });
            queryClient.invalidateQueries({ queryKey: ["shop_catalog"] });
            invalidate();
            setIsFormOpen(false);
            queryClient.refetchQueries({ queryKey: ["products"] });
            queryClient.refetchQueries({ queryKey: ["stock_ledger"] });
            queryClient.refetchQueries({ queryKey: ["shop_catalog"] });
          },
          onError: () => toast.error("Failed to add entry"),
        }
      );
    }
  };

  const handleDelete = (entryId: number) => {
    setDeletingEntryId(entryId);
  };

  const openPaymentModal = (entry: StockEntry) => {
    setPaymentEntry(entry);
    setPaymentInput(String(entry.amountPaidToSupplier || 0));
  };

  const handleRecordPayment = () => {
    if (!paymentEntry) return;
    const amount = parseFloat(paymentInput);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    recordPayment.mutate(
      { id: paymentEntry.id, data: { amountPaidToSupplier: amount } },
      {
        onSuccess: () => {
          toast.success("Supplier payment recorded");
          invalidate();
          setPaymentEntry(null);
        },
        onError: () => toast.error("Failed to record payment"),
      }
    );
  };

  const renderPaymentStatus = (entry: StockEntry) => {
    const { purchasePaymentStatus, amountPaidToSupplier, totalPrice } = entry;
    const due = totalPrice - amountPaidToSupplier;
    switch (purchasePaymentStatus) {
      case "fully_paid":
        return (
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
            Paid
          </span>
        );
      case "partially_paid":
        return (
          <div className="flex flex-col gap-0.5">
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
              Partial
            </span>
            <span className="text-xs text-destructive font-medium">Due ₹{due.toLocaleString()}</span>
          </div>
        );
      default:
        return (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
            Pending
          </span>
        );
    }
  };

  // Compute totals
  const totalPurchased = entries?.reduce((sum, e) => sum + e.totalPrice, 0) ?? 0;
  const totalPaid = entries?.reduce((sum, e) => sum + e.amountPaidToSupplier, 0) ?? 0;
  const totalDue = totalPurchased - totalPaid;

  if (supplierLoading) {
    return (
      <AdminLayout>
        <div className="p-8 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!supplier) {
    return (
      <AdminLayout>
        <div className="text-center py-20 text-muted-foreground">Supplier not found.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Back + Header */}
      <div className="mb-6">
        <Link href="/admin/stock">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Suppliers
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">{supplier.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground text-sm">
                {supplier.mobile && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {supplier.mobile}
                  </span>
                )}
                {supplier.mainProducts && (
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> {supplier.mainProducts}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Purchase Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-sm mb-1">Total Purchased</p>
          <p className="text-2xl font-bold text-foreground">₹{totalPurchased.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-sm mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-sm mb-1">Balance Due</p>
          <p className={`text-2xl font-bold ${totalDue > 0 ? "text-destructive" : "text-green-600"}`}>
            ₹{totalDue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Year</span>
              <Select value={String(selectedYear)} onValueChange={(val) => handleYearChange(Number(val))}>
                <SelectTrigger className="w-[110px] bg-background">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Month</span>
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => {
                  setSelectedMonth(val === "all" ? "all" : Number(val));
                  setSelectedDate(undefined);
                }}
              >
                <SelectTrigger className="w-[150px] bg-background">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((m) => {
                    const isFutureMonth = selectedYear === currentYear && m.value > currentMonthIndex + 1;
                    return (
                      <SelectItem key={m.value} value={String(m.value)} disabled={isFutureMonth}>
                        {m.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day / Date</span>
              <div className="flex items-center gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-[180px] justify-start text-left font-normal bg-background ${
                        !selectedDate && "text-muted-foreground"
                      }`}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a day</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (date) {
                          setSelectedYear(date.getFullYear());
                          setSelectedMonth(date.getMonth() + 1);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedDate(undefined)}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    title="Clear day filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="relative w-full lg:w-64 self-end lg:self-center">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search products or date..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {entriesLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries?.map((entry) => {
                  const prod = products?.find(p => p.name.trim().toLowerCase() === entry.productName.trim().toLowerCase());
                  const isUnit = prod ? (prod.unit && !prod.unit.toLowerCase().includes("kg")) : false;
                  const cf = prod?.conversionFactor || 30;
                  const boxes = Math.floor(entry.quantityKg / cf);
                  
                  let mainUnitName = prod?.mainUnit || "Main Unit";
                  if (mainUnitName === "Boxes" || mainUnitName === "Box") mainUnitName = "Main Unit";
                  
                  const displayQty = isUnit ? `${boxes} ${mainUnitName}` : `${entry.quantityKg} KG`;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-3 h-3 mr-2 text-muted-foreground" />
                          {entry.date}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{entry.productName}</TableCell>
                      <TableCell className="text-right font-medium">{displayQty}</TableCell>
                      <TableCell className="text-right font-medium">₹{entry.totalPrice.toLocaleString()}</TableCell>
                      <TableCell>{renderPaymentStatus(entry)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Record Payment"
                        onClick={() => openPaymentModal(entry)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <IndianRupee className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(entry)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {filteredEntries?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search
                        ? "No entries match your search."
                        : "No purchase entries yet. Click 'Add Purchase Entry' to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add / Edit Entry Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Purchase Entry" : "Add Purchase Entry"}</DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update purchase details."
                : `Record a new purchase from ${supplier.name}.`}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="supplierName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-muted/50 cursor-not-allowed" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => {
                  if (isCustomProduct) {
                    return (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Product / Material (Custom)</FormLabel>
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-xs text-primary"
                            onClick={() => {
                              setIsCustomProduct(false);
                              field.onChange(products && products.length > 0 ? products[0].name : "");
                            }}
                          >
                            Select from Catalog
                          </Button>
                        </div>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Raw Peanuts, Maida" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }
                  return (
                    <FormItem>
                      <FormLabel>Product / Material</FormLabel>
                      <FormControl>
                        <Popover open={productComboOpen} onOpenChange={setProductComboOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={productComboOpen}
                              className="w-full justify-between font-normal"
                            >
                              {field.value
                                ? products?.find((p) => p.name === field.value)?.name ?? field.value
                                : "Select catalog product..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                            <Command>
                              <CommandInput placeholder="Search product..." />
                              <CommandList
                                className="max-h-[260px] overflow-y-auto"
                                onWheel={(e) => e.stopPropagation()}
                              >
                                <CommandEmpty>No product found.</CommandEmpty>
                                <CommandGroup>
                                  {productsLoading ? (
                                    <div className="p-2 text-xs text-muted-foreground">Loading products...</div>
                                  ) : (
                                    products?.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={p.name}
                                        onSelect={(val) => {
                                          field.onChange(val);
                                          setProductComboOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${field.value === p.name ? "opacity-100" : "opacity-0"}`}
                                        />
                                        {p.name}
                                      </CommandItem>
                                    ))
                                  )}
                                  <CommandItem
                                    value="__custom__"
                                    onSelect={() => {
                                      setIsCustomProduct(true);
                                      field.onChange("");
                                      setProductComboOpen(false);
                                    }}
                                    className="text-muted-foreground font-medium italic"
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Other / Raw Material...
                                  </CommandItem>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                   control={form.control}
                   name="unit"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Unit Type</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value || "KG"}>
                         <FormControl>
                           <SelectTrigger>
                             <SelectValue placeholder="Select unit" />
                           </SelectTrigger>
                         </FormControl>
                         <SelectContent>
                           <SelectItem value="KG">KG</SelectItem>
                           <SelectItem value="Unit">Unit</SelectItem>
                         </SelectContent>
                       </Select>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
                 <FormField
                   control={form.control}
                   name="totalPrice"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Total Amount (₹)</FormLabel>
                       <FormControl><Input type="number" {...field} /></FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
              </div>

              {selectedUnit === "Unit" ? (
                <div className="grid grid-cols-3 gap-4 border-t pt-4 mt-4">
                  <FormField
                    control={form.control}
                    name="boxesPurchased"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main Unit</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} placeholder="e.g. 5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="packetsPurchased"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub-Unit</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} placeholder="e.g. 30" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantityKg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Sub-Unit</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} value={field.value ?? ""} disabled className="bg-muted/50 cursor-not-allowed" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                  <FormField
                    control={form.control}
                    name="quantityKg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity (KG)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createEntry.isPending || updateEntry.isPending}>
                  {(createEntry.isPending || updateEntry.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Save Entry
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!paymentEntry} onOpenChange={(open) => { if (!open) setPaymentEntry(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Pay Supplier — {paymentEntry?.supplierName}</DialogTitle>
            <DialogDescription>
              Record the amount paid for <strong>{paymentEntry?.productName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {paymentEntry && (
            <form onSubmit={(e) => { e.preventDefault(); handleRecordPayment(); }} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Purchase Total</p>
                  <p className="font-bold text-lg">₹{paymentEntry.totalPrice.toLocaleString()}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs mb-1">Balance Due</p>
                  <p className={`font-bold text-lg ${(paymentEntry.totalPrice - paymentEntry.amountPaidToSupplier) > 0 ? "text-destructive" : "text-green-600"}`}>
                    ₹{(paymentEntry.totalPrice - paymentEntry.amountPaidToSupplier).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Total Paid to Supplier (₹)</label>
                <Input
                  type="number"
                  min={0}
                  max={paymentEntry.totalPrice}
                  step={0.01}
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Enter the cumulative total amount paid so far.</p>
              </div>

              <DialogFooter className="pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={() => setPaymentEntry(null)}>Cancel</Button>
                <Button type="submit" disabled={recordPayment.isPending}>
                  {recordPayment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingEntryId !== null} onOpenChange={(open) => { if (!open) setDeletingEntryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase entry? This will permanently remove the log from the supplier's ledger history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingEntryId !== null) {
                  deleteEntry.mutate(
                    { id: deletingEntryId },
                    {
                      onSuccess: () => {
                        toast.success("Entry deleted");
                        invalidate();
                        setDeletingEntryId(null);
                      },
                      onError: () => {
                        toast.error("Failed to delete entry");
                        setDeletingEntryId(null);
                      }
                    }
                  );
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              disabled={deleteEntry.isPending}
            >
              {deleteEntry.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
