import { Link } from "wouter";
import logoBlack from "@/assets/lead2lease-logo-black.svg";

export function Logo() {
  return (
    <Link href="/" className="flex items-center" data-testid="link-logo-v4">
      <img
        src={logoBlack}
        alt="Lead2Lease"
        className="h-8 w-auto object-contain"
      />
    </Link>
  );
}
