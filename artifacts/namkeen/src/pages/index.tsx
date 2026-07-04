import { useListProducts, useCreateInquiry } from "@workspace/api-client-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "wouter";

// Import generated images
import heroImg from "@/assets/hero.png";
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

const inquirySchema = z.object({
  name: z.string().min(2, "Name is required"),
  shopName: z.string().optional(),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required").or(z.literal("")),
  message: z.string().min(10, "Please provide some details"),
});

export default function Landing() {
  const { data: products, isLoading: productsLoading } = useListProducts();
  const createInquiry = useCreateInquiry();

  const form = useForm<z.infer<typeof inquirySchema>>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      name: "",
      shopName: "",
      phone: "",
      email: "",
      message: "",
    },
  });

  function onSubmit(values: z.infer<typeof inquirySchema>) {
    createInquiry.mutate({ data: values }, {
      onSuccess: () => {
        toast.success("Inquiry sent successfully. We will contact you soon.");
        form.reset();
      },
      onError: () => {
        toast.error("Failed to send inquiry. Please try again.");
      }
    });
  }



  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black/40 z-10"></div>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="SupplyGrid B2B Wholesale" className="w-full h-full object-cover" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 py-32 lg:py-48 flex flex-col items-start justify-center min-h-[80vh]">
          <span className="inline-block py-1 px-3 rounded-full bg-primary/90 text-primary-foreground font-medium text-sm mb-6 backdrop-blur-sm border border-primary/20">
            Premium Wholesale Distributer
          </span>
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-white max-w-3xl leading-tight mb-6 drop-shadow-lg">
            Authentic Taste.<br/>
            <span className="text-secondary">Wholesale Prices.</span>
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mb-10 text-shadow leading-relaxed">
            Partner with us to stock your retail shelves with premium wholesale inventory. Fresh, reliable, and direct from verified distributors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/login">
              <Button size="lg" className="text-lg h-14 px-8 shadow-xl shadow-primary/20">
                Retailer Login
              </Button>
            </Link>
            <a href="#catalog">
              <Button size="lg" variant="secondary" className="text-lg h-14 px-8 border-none bg-white text-foreground hover:bg-white/90">
                View Catalog
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col items-center text-center p-6 hover-elevate rounded-2xl transition-all">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-3">Premium Quality</h3>
              <p className="text-muted-foreground">Made with the finest ingredients and traditional recipes preserved over generations.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 hover-elevate rounded-2xl transition-all">
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary mb-6">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-3">Bulk Packaging</h3>
              <p className="text-muted-foreground">Available in 1KG, 5KG, and 10KG wholesale packs designed for retail freshness.</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 hover-elevate rounded-2xl transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-6">
                <Truck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-3">Reliable Supply</h3>
              <p className="text-muted-foreground">Consistent stock availability and fast dispatch for our registered retail partners.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Preview */}
      <section id="catalog" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Our Signature Selection</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Browse our popular wholesale items. Registered retailers receive specialized volume pricing.</p>
          </div>

          {productsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(Array.isArray(products) ? products : []).slice(0, 8).map((product, idx) => (
                <Card key={product.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow group cursor-pointer">
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img 
                      src={resolveImageSrc(product.imageUrl, product.name)} 
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                        <span className="bg-destructive text-destructive-foreground px-4 py-2 font-bold rounded-md">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-serif font-bold text-lg leading-tight">{product.name}</h3>
                    </div>
                    <div className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">
                      {product.description || "Traditional Indian savory snack."}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-lg font-bold text-primary">₹{product.basePrice} <span className="text-xs text-muted-foreground font-normal">/ {product.unit}</span></div>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link href="/login">
              <Button variant="outline" size="lg" className="rounded-full">
                View Full Catalog <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section id="contact" className="py-24 bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary/5 rounded-3xl p-8 md:p-12 border border-primary/10">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-serif font-bold text-foreground mb-4">Become a Partner</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Interested in stocking our products? Send us your details and our team will get in touch to set up your wholesale account.
              </p>
            </div>

            <Card className="border-none shadow-lg">
              <CardContent className="p-6 md:p-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="shopName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shop Name (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Krishna Sweets & Snacks" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 9999999999" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Tell us about your requirements..." 
                              className="min-h-[120px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" size="lg" className="w-full text-base" disabled={createInquiry.isPending}>
                      {createInquiry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Inquiry
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

// Need to import Package and Truck here since they weren't in lucide-react above
import { Package, Truck } from "lucide-react";
