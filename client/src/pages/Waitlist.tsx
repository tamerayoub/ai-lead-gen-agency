import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Mail } from "lucide-react";
import logo from "@/assets/lead2lease-logo-black.svg";
import { getLoginUrl } from "@/lib/appUrls";

function getHomeUrl(): string {
  if (typeof window === "undefined") return "/";
  const hostname = window.location.hostname.toLowerCase();
  const isAppSubdomain =
    hostname === "app.lead2lease.ai" || hostname.startsWith("app.");
  if (isAppSubdomain && hostname.includes("lead2lease")) {
    return "https://lead2lease.ai";
  }
  return "/";
}

export default function Waitlist() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200/50 sticky top-0 bg-gray-50/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a href={getHomeUrl()} className="flex items-center gap-2 hover:opacity-80">
              <img src={logo} alt="Logo" className="h-12 w-auto object-contain" />
            </a>
            <a href={getLoginUrl()}>
              <Button variant="secondary" className="gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900">
                <Mail className="h-4 w-4" />
                Log In
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border border-gray-200 shadow-lg bg-white">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                You&apos;re on the Waitlist
              </h1>
              <p className="text-gray-600 leading-relaxed">
                Thank you for registering! A team member will reach out soon to get you started with Lead2Lease.
              </p>
              <p className="text-sm text-gray-500">
                In the meantime, feel free to explore our website or reach out at{" "}
                <a
                  href="mailto:support@lead2lease.ai"
                  className="text-primary hover:underline"
                >
                  support@lead2lease.ai
                </a>{" "}
                if you have any questions.
              </p>
              <div className="pt-4">
                <a href={getHomeUrl()}>
                  <Button variant="outline" className="gap-2 w-full">
                    <Home className="h-4 w-4" />
                    Back to Home
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
