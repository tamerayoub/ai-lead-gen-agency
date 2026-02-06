import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl, getRegisterUrl } from "@/lib/appUrls";
import logoBlack from "@/assets/lead2lease-logo-black.svg";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "border-b border-border/50 bg-card/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
      data-testid="navbar-v3"
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center" data-testid="link-logo-v3">
          <img
            src={logoBlack}
            alt="Lead2Lease"
            className="h-8 w-auto object-contain"
          />
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <a href="#features" data-testid="link-nav-features-v3">
            <Button variant="ghost" size="sm">Features</Button>
          </a>
          <a href="#how-it-works" data-testid="link-nav-how-it-works-v3">
            <Button variant="ghost" size="sm">How It Works</Button>
          </a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href={getLoginUrl()}>
            <Button variant="ghost" size="sm" data-testid="button-login-v3">
              Log In
            </Button>
          </Link>
          <Link href={getRegisterUrl()}>
            <Button className="bg-gradient-brand shadow-brand" data-testid="button-get-started-v3">
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          data-testid="button-mobile-menu-v3"
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden py-4 border-t border-border bg-card rounded-b-2xl shadow-card">
          <div className="flex flex-col gap-1 px-4">
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} data-testid="link-mobile-features-v3">
              <Button variant="ghost" className="w-full justify-start">Features</Button>
            </a>
            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} data-testid="link-mobile-how-it-works-v3">
              <Button variant="ghost" className="w-full justify-start">How It Works</Button>
            </a>
            <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-border">
              <Link href={getLoginUrl()}>
                <Button variant="outline" className="w-full" data-testid="button-mobile-login-v3">Log In</Button>
              </Link>
              <Link href={getRegisterUrl()}>
                <Button className="w-full bg-gradient-brand" data-testid="button-mobile-get-started-v3">Get Started Free</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
