import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListInquiries, getListInquiriesQueryKey, useDeleteInquiry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Search, Mail, Phone, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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

export default function AdminInquiries() {
  const [search, setSearch] = useState("");
  const [deletingInquiryId, setDeletingInquiryId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: inquiries, isLoading } = useListInquiries();
  const deleteInquiry = useDeleteInquiry();

  const filteredInquiries = inquiries?.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.shopName?.toLowerCase().includes(search.toLowerCase()) ||
    i.phone.includes(search) ||
    i.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: number) => {
    setDeletingInquiryId(id);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Inquiries</h1>
          <p className="text-muted-foreground mt-1">Manage partnership requests from the landing page</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input 
              placeholder="Search by name, shop, phone..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredInquiries?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground bg-card rounded-xl border">
              No inquiries found.
            </div>
          ) : (
            filteredInquiries?.map((inquiry) => (
              <Card key={inquiry.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r bg-muted/20">
                      <h3 className="font-serif font-bold text-lg text-foreground mb-1">{inquiry.name}</h3>
                      {inquiry.shopName && (
                        <div className="flex items-center text-sm text-muted-foreground mt-2">
                          <Building className="w-4 h-4 mr-2" />
                          {inquiry.shopName}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground mt-2">
                        <Phone className="w-4 h-4 mr-2" />
                        <a href={`tel:${inquiry.phone}`} className="hover:text-primary transition-colors">{inquiry.phone}</a>
                      </div>
                      {inquiry.email && (
                        <div className="flex items-center text-sm text-muted-foreground mt-2">
                          <Mail className="w-4 h-4 mr-2" />
                          <a href={`mailto:${inquiry.email}`} className="hover:text-primary transition-colors">{inquiry.email}</a>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                        Received: {format(new Date(inquiry.createdAt), "MMM d, yyyy h:mm a")}
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex-1">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Message</h4>
                        <p className="text-foreground whitespace-pre-wrap">{inquiry.message}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <Button 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10" 
                          onClick={() => handleDelete(inquiry.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <AlertDialog open={deletingInquiryId !== null} onOpenChange={(open) => { if (!open) setDeletingInquiryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this partnership inquiry? This will remove the request record from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingInquiryId !== null) {
                  deleteInquiry.mutate(
                    { id: deletingInquiryId },
                    {
                      onSuccess: () => {
                        toast.success("Inquiry deleted");
                        queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
                        setDeletingInquiryId(null);
                      },
                      onError: () => {
                        toast.error("Failed to delete inquiry");
                        setDeletingInquiryId(null);
                      }
                    }
                  );
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              disabled={deleteInquiry.isPending}
            >
              {deleteInquiry.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
