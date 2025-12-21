import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import { FileText, ArrowRight, Crown, Calendar } from "lucide-react";
import { useLocation } from "wouter";

function ProductApplicationLeasingContent() {
  const [, setLocation] = useLocation();

  const handleSignIn = () => {
    setLocation("/login");
  };

  const handleScrollToMembership = () => {
    setLocation("/");
    setTimeout(() => {
      const membershipSection = document.querySelector('[data-testid="section-founding-partner"]');
      if (membershipSection) {
        membershipSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200/50 sticky top-0 bg-white/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img 
              src={logoBlack} 
              alt="Logo" 
              className="h-12 w-auto object-contain cursor-pointer"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/book-demo">
              <Button variant="outline" className="border-2">
                <Calendar className="mr-2 h-4 w-4" />
                Book a Demo
              </Button>
            </Link>
            <Button 
              onClick={handleScrollToMembership}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              Become a Founding Partner
            </Button>
            <Button onClick={handleSignIn}>Sign In</Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">Application Leasing</h1>
          <p className="text-xl text-gray-600 mb-8">
            Coming soon - Learn about our automated application and leasing features
          </p>
          <Button 
            size="lg" 
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
            onClick={() => setLocation("/book-demo")}
          >
            Book a Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function ProductApplicationLeasing() {
  return (
    <ThemeProvider forcedTheme="light">
      <ProductApplicationLeasingContent />
    </ThemeProvider>
  );
}

