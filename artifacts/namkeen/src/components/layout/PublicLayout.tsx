import { ReactNode } from "react";
import { Link } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { data: user } = useGetCurrentUser();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              {/* DVS SupplyGrid branded logo — transparent PNG on white header */}
              <img
                src="/supplygrid-logo.png"
                alt="SupplyGrid"
                className="h-9 w-auto object-contain"
                style={{ filter: "invert(1) sepia(1) saturate(10) hue-rotate(5deg)", mixBlendMode: "multiply" }}
              />
            </div>
          </Link>

          <nav className="flex items-center gap-4">
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

      <footer className="bg-gray-900 border-t py-12 mt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <div className="flex items-center justify-center mb-4">
            {/* White logo on dark footer */}
            <img
              src="/supplygrid-logo.png"
              alt="SupplyGrid"
              className="h-14 w-auto object-contain opacity-90"
            />
          </div>
          <p className="text-sm font-semibold text-white mb-1 tracking-widest uppercase">SupplyGrid Network</p>
          <p className="text-sm max-w-md mx-auto">India's premier B2B wholesale supply chain network — connecting verified wholesalers with retailers nationwide.</p>
          <div className="mt-8 text-xs border-t border-gray-700 pt-8">
            &copy; {new Date().getFullYear()} SupplyGrid Wholesale. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
