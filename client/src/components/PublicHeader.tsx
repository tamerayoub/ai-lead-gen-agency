import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import {
  Bot,
  Users,
  Calendar,
  FileText,
  Shield,
  BarChart3,
  Crown,
  ChevronDown,
  Menu,
  Calculator,
} from "lucide-react";

interface PublicHeaderProps {
  onGetEarlyAccess?: () => void;
  scrollToSection?: (sectionId: string) => void;
  currentPage?: 'landing' | 'pricing';
}

export function PublicHeader({ 
  onGetEarlyAccess, 
  scrollToSection,
  currentPage = 'landing'
}: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll position for landing page flowing effect
  useEffect(() => {
    if (currentPage !== 'landing') {
      setIsScrolled(true); // Always show border on pricing page
      return;
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollPosition > 10);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPage]);

  const handleGetEarlyAccess = () => {
    if (onGetEarlyAccess) {
      onGetEarlyAccess();
    } else {
      // Redirect to app subdomain in production
      const hostname = window.location.hostname.toLowerCase();
      const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
      const returnTo = encodeURIComponent('/founding-partner-checkout');
      
      if (isProductionMarketing) {
        window.location.href = `https://app.lead2lease.ai/login?returnTo=${returnTo}`;
      } else {
        window.location.href = `/login?returnTo=${returnTo}`;
      }
    }
  };

  const handleSignIn = () => {
    // Redirect to app subdomain in production
    const hostname = window.location.hostname.toLowerCase();
    const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
    
    if (isProductionMarketing) {
      window.location.href = 'https://app.lead2lease.ai/login';
    } else {
      window.location.href = "/login";
    }
  };

  const handleProductClick = (sectionId: string) => {
    if (scrollToSection) {
      scrollToSection(sectionId);
      setMobileMenuOpen(false);
    } else {
      // If no scrollToSection function, navigate to landing page with hash
      window.location.href = `/#${sectionId}`;
      setMobileMenuOpen(false);
    }
  };

  // Determine header styles based on scroll position (only for landing page)
  const headerClasses = currentPage === 'landing' && !isScrolled
    ? "fixed top-0 left-0 z-50 bg-transparent backdrop-blur-none shadow-none w-screen transition-all duration-300"
    : "fixed top-0 left-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-sm md:backdrop-blur-md backdrop-saturate-150 shadow-sm w-screen transition-all duration-300";
  
  // Text color classes based on scroll position
  const textColorClass = currentPage === 'landing' && !isScrolled
    ? "text-white"
    : "text-gray-700 hover:text-gray-900";

  return (
    <header className={headerClasses}>
      <div className="container mx-auto px-4 md:px-6 py-2 flex items-center justify-between max-w-full overflow-x-hidden">
        {/* Mobile: Hamburger menu on left */}
        <div className="md:hidden flex items-center">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-700 hover:text-gray-900"
              >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                {/* Product Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between text-gray-700 hover:text-gray-900"
                    >
                      Product
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={() => handleProductClick('ai-leasing-agent')}>
                      <Bot className="mr-2 h-4 w-4" />
                      AI Leasing Agent
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleProductClick('crm')}>
                      <Users className="mr-2 h-4 w-4" />
                      CRM
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleProductClick('ai-smart-scheduling')}>
                      <Calendar className="mr-2 h-4 w-4" />
                      AI-Smart Scheduling
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleProductClick('ai-application-processing')}>
                      <FileText className="mr-2 h-4 w-4" />
                      AI-Powered Application Processing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleProductClick('ai-lease-drafting')}>
                      <Shield className="mr-2 h-4 w-4" />
                      AI Lease Drafting
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleProductClick('reporting')}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Reports
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* ROI Calculator */}
                <Link href="/roi-calculator" onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:text-gray-900"
                  >
                    ROI Calculator
                  </Button>
                </Link>
                <div className="border-t border-gray-200 my-2" />
                {/* Book a Demo */}
                <Link href="/demo-form" onClick={() => setMobileMenuOpen(false)}>
                  <Button 
                    variant="outline"
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 border-2 border-blue-600"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Book a Demo
                  </Button>
                </Link>
                {/* Get Early Access */}
                {/* <Button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleGetEarlyAccess();
                  }}
                  className="w-full text-white hover:opacity-90 rounded-lg shadow-md font-semibold"
                  style={{ backgroundColor: '#FFDF00' }}
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Get Early Access
                </Button> */}
                {/* Sign In */}
                <Button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignIn();
                  }}
                  className="w-full rounded-lg font-medium hover:bg-gray-100"
                >
                  Sign In
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {/* Logo - on the left */}
        <div className="flex items-center gap-2 flex-1 md:flex-1">
          <Link href="/" className="flex items-center">
            <img
              src={logoBlack}
              alt="Lead2Lease Logo"
              className="h-7 md:h-10 lg:h-11 w-auto object-contain cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105"
            />
          </Link>
        </div>
        {/* Desktop Navigation - centered */}
        <div className="hidden md:flex items-center justify-center flex-1 gap-2 absolute left-1/2 -translate-x-1/2">
          {/* Home Link */}
          <Link href="/">
            <Button
              variant="ghost"
              className="text-gray-700 hover:text-gray-900"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Home
            </Button>
          </Link>

          {/* Product Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                data-testid="button-product-header"
                className="text-gray-700 hover:text-gray-900"
              >
                <span className="mr-0.5">Product</span>
                <ChevronDown className="h-4 w-4 -ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              {scrollToSection ? (
                <>
                  <DropdownMenuItem onClick={() => scrollToSection('ai-leasing-agent')}>
                    <Bot className="mr-2 h-4 w-4" />
                    AI Leasing Agent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scrollToSection('crm')}>
                    <Users className="mr-2 h-4 w-4" />
                    CRM
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scrollToSection('ai-smart-scheduling')}>
                    <Calendar className="mr-2 h-4 w-4" />
                    AI-Smart Scheduling
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scrollToSection('ai-application-processing')}>
                    <FileText className="mr-2 h-4 w-4" />
                    AI-Powered Application Processing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scrollToSection('ai-lease-drafting')}>
                    <Shield className="mr-2 h-4 w-4" />
                    AI Lease Drafting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scrollToSection('reporting')}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Reports
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <Link href="/#ai-leasing-agent">
                    <DropdownMenuItem>
                      <Bot className="mr-2 h-4 w-4" />
                      AI Leasing Agent
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/#crm">
                    <DropdownMenuItem>
                      <Users className="mr-2 h-4 w-4" />
                      CRM
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/#ai-smart-scheduling">
                    <DropdownMenuItem>
                      <Calendar className="mr-2 h-4 w-4" />
                      AI-Smart Scheduling
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/#ai-application-processing">
                    <DropdownMenuItem>
                      <FileText className="mr-2 h-4 w-4" />
                      AI-Powered Application Processing
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/#ai-lease-drafting">
                    <DropdownMenuItem>
                      <Shield className="mr-2 h-4 w-4" />
                      AI Lease Drafting
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/#reporting">
                    <DropdownMenuItem>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Reports
                    </DropdownMenuItem>
                  </Link>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ROI Calculator Link */}
          <Link href="/roi-calculator">
            <Button
              variant="ghost"
              className="text-gray-700 hover:text-gray-900"
            >
              ROI Calculator
            </Button>
          </Link>
        </div>
        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
          <Link href="/demo-form">
            <Button 
              variant="outline"
              data-testid="button-book-demo-header"
              className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-2 border-blue-600 rounded-lg transition-all duration-200 font-medium"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Book a Demo
            </Button>
          </Link>
          {/* <Button 
            onClick={handleGetEarlyAccess}
            data-testid="button-founding-member-header"
            className="text-white hover:opacity-90 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
            style={{ backgroundColor: '#FFDF00' }}
          >
            <Crown className="mr-2 h-4 w-4" />
            Get Early Access
          </Button> */}
          <Button 
            onClick={handleSignIn} 
            data-testid="button-signin-header"
            className="rounded-lg font-medium hover:bg-gray-100 transition-all duration-200"
          >
            Sign In
          </Button>
        </div>
        {/* Mobile Buttons - on the right */}
        <div className="md:hidden flex items-center gap-2">
          <Link href="/demo-form">
            <Button 
              size="sm"
              variant="outline"
              className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-2 border-blue-600 rounded-lg text-xs px-3 py-1 h-8 font-semibold"
            >
              <Calendar className="mr-1 h-3 w-3" />
              Book a Demo
            </Button>
          </Link>
          {/* <Button 
            onClick={handleGetEarlyAccess}
            size="sm"
            className="text-white hover:opacity-90 rounded-lg shadow-md text-xs px-2 py-1 h-8 font-semibold"
            style={{ backgroundColor: '#FFDF00' }}
          >
            Get Early Access
          </Button> */}
        </div>
      </div>
    </header>
  );
}

