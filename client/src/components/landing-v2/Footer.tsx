import { Link } from "wouter";
import logoWhite from "@/assets/lead2lease-logo-white.svg";

export function Footer() {
  return (
    <footer className="py-12 bg-foreground">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center" data-testid="link-footer-logo">
            <img
              src={logoWhite}
              alt="Lead2Lease"
              className="h-8 w-auto object-contain"
            />
          </Link>

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            {[
              { label: "Privacy Policy", href: "/privacy-notice" },
              { label: "Terms of Service", href: "/terms-of-service" },
              { label: "Contact", href: "/book-demo" },
              { label: "Support", href: "/book-demo" },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="text-background/60 hover:text-background transition-colors" data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, '-')}`}>
                {link.label}
              </Link>
            ))}
          </div>

          <p className="text-sm text-background/60">
            &copy; {new Date().getFullYear()} Lead2Lease. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
