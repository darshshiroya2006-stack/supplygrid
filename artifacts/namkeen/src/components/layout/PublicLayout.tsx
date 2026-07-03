import { ReactNode } from "react";
import { Link } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { data: user } = useGetCurrentUser();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <Logo className="w-10 h-10 shrink-0" />
              <h1 className="text-2xl font-serif font-bold text-foreground">
                Supply<span className="text-primary">Grid</span>
              </h1>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            <a href="#catalog" className="text-sm font-medium hover:text-primary transition-colors hidden sm:block">Catalog</a>
            <a href="#contact" className="text-sm font-medium hover:text-primary transition-colors hidden sm:block">Contact</a>
            
            <Link href="/login">
              <Button>
                {user?.authenticated ? "Go to Dashboard" : "Retailer Login"}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full">
        {children}
      </main>

      <footer className="bg-card border-t py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground">
          <div className="flex items-center justify-center mb-4">
            <Logo className="w-12 h-12" />
          </div>
          <p className="font-serif text-lg text-foreground mb-2">SupplyGrid</p>
          <p className="text-sm max-w-md mx-auto">Universal Wholesale Supply Chain Network. Premium chocolates, cakes, namkeens, agro, and grocery items for retailers nationwide.</p>
          <div className="mt-8 text-xs border-t pt-8">
            &copy; {new Date().getFullYear()} SupplyGrid Wholesale. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
