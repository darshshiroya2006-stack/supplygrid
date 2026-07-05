import { useCreateInquiry } from "@workspace/api-client-react";
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
import { Loader2, CheckCircle2, Users, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "wouter";

// Hero background image
import heroImg from "@/assets/hero.png";

const inquirySchema = z.object({
  name: z.string().min(2, "Name is required"),
  shopName: z.string().optional(),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required").or(z.literal("")),
  message: z.string().min(10, "Please provide some details"),
});

export default function Landing() {
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
        {/* Multi-layer glassmorphism tint for premium readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/45 backdrop-blur-[3px] z-10"></div>
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="SupplyGrid B2B Wholesale Platform" className="w-full h-full object-cover" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 py-32 lg:py-52 flex flex-col items-start justify-center min-h-[85vh]">
          <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-primary/95 text-white font-semibold text-sm mb-8 backdrop-blur-sm border border-primary/30 shadow-lg">
            <ShieldCheck className="w-4 h-4" /> India's Verified B2B Wholesale Network
          </span>
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-white max-w-4xl leading-tight mb-6 drop-shadow-2xl">
            Multiple Wholesalers.<br/>
            <span className="text-amber-400 font-sans">One Unified Platform.</span>
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mb-4 leading-relaxed drop-shadow-md font-sans">
            SupplyGrid connects verified regional wholesalers and manufacturers — spanning namkeens, groceries, agro commodities, and FMCG — with retail partners nationwide.
          </p>
          <p className="text-base text-white/70 max-w-xl mb-10 leading-relaxed font-sans">
            Unlock direct manufacturer bulk pricing, consolidated multi-vendor ordering, and a highly reliable supply chain network — all through a single point of billing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/login">
              <Button size="lg" className="text-lg h-14 px-8 shadow-xl shadow-primary/30 bg-primary hover:bg-primary/90 cursor-pointer">
                Retailer Login
              </Button>
            </Link>
            <a href="#contact">
              <Button size="lg" variant="secondary" className="text-lg h-14 px-8 border border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 hover:border-white/30 cursor-pointer">
                Become a Partner
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Platform Features — B2B Multi-Vendor Positioning */}
      <section className="py-20 bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Why Retailers Choose SupplyGrid</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">We're not just a single supplier — we're an entire network of verified wholesalers working under one platform.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col items-center text-center p-8 hover:shadow-lg rounded-2xl transition-all border border-border/50">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-3">Verified Wholesalers</h3>
              <p className="text-muted-foreground">Every supplier on SupplyGrid is onboarded through a verification process — ensuring quality, reliability, and compliance.</p>
            </div>
            <div className="flex flex-col items-center text-center p-8 hover:shadow-lg rounded-2xl transition-all border border-border/50">
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 mb-6">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-3">Multi-Vendor Network</h3>
              <p className="text-muted-foreground">Access products across namkeens, FMCG, agro, groceries, and more — from multiple wholesalers in your region, all in one order.</p>
            </div>
            <div className="flex flex-col items-center text-center p-8 hover:shadow-lg rounded-2xl transition-all border border-border/50">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-600 mb-6">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-3">Grow Your Retail Business</h3>
              <p className="text-muted-foreground">Competitive bulk pricing, centralized invoicing, and streamlined restocking help you maximize margins and never go out of stock.</p>
            </div>
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


