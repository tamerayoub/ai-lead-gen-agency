import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import logoBlack from "@/assets/lead2lease-logo-black.svg";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card py-12" data-testid="footer-v3">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href="/" className="flex items-center" data-testid="link-footer-logo-v3">
            <img
              src={logoBlack}
              alt="Lead2Lease"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Link href="/privacy-notice">
              <Button variant="ghost" size="sm" data-testid="link-footer-privacy-v3">Privacy</Button>
            </Link>
            <Link href="/terms-of-service">
              <Button variant="ghost" size="sm" data-testid="link-footer-terms-v3">Terms</Button>
            </Link>
            <Link href="/book-demo">
              <Button variant="ghost" size="sm" data-testid="link-footer-contact-v3">Contact</Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-footer-copyright">2026 Lead2Lease. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
