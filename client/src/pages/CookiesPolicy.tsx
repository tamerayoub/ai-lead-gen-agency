import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";

export default function CookiesPolicy() {
  const [, setLocation] = useLocation();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    const params = new URLSearchParams(window.location.search);
    const returnToParam = params.get("returnTo");
    if (returnToParam) {
      setReturnTo(returnToParam);
    }
  }, []);

  const handleBack = () => {
    if (returnTo) {
      setLocation(returnTo);
    } else {
      setLocation("/");
    }
  };

  return (
    <ThemeProvider forcedTheme="light">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200/50 sticky top-0 bg-gray-50/80 backdrop-blur-md z-50 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/">
                <a className="flex items-center gap-2 hover:opacity-80">
                  <img 
                    src={logoBlack} 
                    alt="Lead2Lease Logo" 
                    className="h-12 w-auto object-contain"
                  />
                </a>
              </Link>
              <Button 
                variant="secondary" 
                className="gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900"
                onClick={handleBack}
              >
                {returnTo ? <ArrowLeft className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                {returnTo ? "Back" : "Back to Home"}
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Lead2Lease Cookies Policy</h1>
            <p className="text-gray-600 mb-8">Effective Date: 12/13/2025</p>

            <div className="prose prose-sm md:prose-base max-w-none">
              <p className="text-gray-700 mb-6">
                This Cookies Policy explains how Lead2Lease ("Lead2Lease," "we," "us," or "our") uses cookies and similar technologies when you visit or interact with our website, platform, web application, and other online services that link to this Cookies Policy (collectively, the "Services").
              </p>

              <p className="text-gray-700 mb-8">
                This Cookies Policy should be read together with our Privacy Notice.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">What Are Cookies?</h2>
              <p className="text-gray-700 mb-4">
                Cookies are small text files that are placed on your device (computer, smartphone, tablet, or other device) when you visit a website. Cookies help websites recognize your device, store preferences, enable core functionality, and collect information about how users interact with the site.
              </p>
              <p className="text-gray-700 mb-8">
                We may also use similar technologies such as pixels, web beacons, local storage, SDKs, and scripts (collectively referred to as "cookies" in this policy).
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">How We Use Cookies</h2>
              <p className="text-gray-700 mb-4">
                Lead2Lease uses cookies and similar technologies for the following purposes:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>To operate and secure the Services</li>
                <li>To authenticate users and maintain sessions</li>
                <li>To remember preferences and settings</li>
                <li>To analyze usage and performance</li>
                <li>To improve features and user experience</li>
                <li>To support marketing and advertising efforts (where permitted by law)</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">Types of Cookies We Use</h2>

              <h3 className="text-xl font-bold mt-6 mb-4">1. Strictly Necessary Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies are required for the Services to function properly and cannot be disabled in our systems.
              </p>
              <p className="text-gray-700 mb-4">
                They are used to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Enable core site functionality</li>
                <li>Maintain user sessions and authentication</li>
                <li>Prevent fraud and abuse</li>
                <li>Ensure platform security</li>
              </ul>
              <p className="text-gray-700 mb-8">
                Without these cookies, certain parts of the Services would not work correctly.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">2. Functional Cookies</h3>
              <p className="text-gray-700 mb-4">
                Functional cookies allow the Services to remember choices you make and provide enhanced functionality and personalization.
              </p>
              <p className="text-gray-700 mb-4">
                These cookies may be used to:
              </p>
              <ul className="list-disc pl-6 mb-8 space-y-2 text-gray-700">
                <li>Remember language or region preferences</li>
                <li>Save form inputs or user settings</li>
                <li>Improve usability across sessions</li>
              </ul>

              <h3 className="text-xl font-bold mt-6 mb-4">3. Analytics and Performance Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies help us understand how users interact with our Services so we can measure performance and improve functionality.
              </p>
              <p className="text-gray-700 mb-4">
                They may collect information such as:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Pages visited</li>
                <li>Time spent on pages</li>
                <li>Navigation patterns</li>
                <li>Error or crash data</li>
              </ul>
              <p className="text-gray-700 mb-4">
                We may use third-party analytics providers such as:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Google Analytics</li>
                <li>Other analytics or monitoring tools used for product improvement</li>
              </ul>
              <p className="text-gray-700 mb-8">
                Information collected through analytics cookies is typically aggregated and used for statistical purposes.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">4. Marketing and Advertising Cookies</h3>
              <p className="text-gray-700 mb-4">
                Marketing cookies may be used to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Measure the effectiveness of marketing campaigns</li>
                <li>Deliver relevant advertisements or content</li>
                <li>Track interactions with emails or ads</li>
              </ul>
              <p className="text-gray-700 mb-4">
                These cookies may be set by Lead2Lease or by third-party advertising partners. They may track your activity across different websites and services.
              </p>
              <p className="text-gray-700 mb-8">
                Where required by law, we will obtain your consent before using marketing cookies.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Third-Party Cookies</h2>
              <p className="text-gray-700 mb-4">
                Some cookies on our Services are placed by third parties that provide services to us or integrate with our platform. These third parties may collect information about your online activities over time and across different websites.
              </p>
              <p className="text-gray-700 mb-4">
                Examples of third-party services that may place cookies include:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Analytics providers</li>
                <li>Payment processors</li>
                <li>Customer support tools</li>
                <li>Marketing and advertising platforms</li>
              </ul>
              <p className="text-gray-700 mb-8">
                We do not control how these third parties use cookies. Their use of cookies is governed by their own privacy and cookies policies.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Managing Cookies and Your Choices</h2>
              <p className="text-gray-700 mb-4">
                You have several options to control or manage cookies:
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">Browser Controls</h3>
              <p className="text-gray-700 mb-4">
                Most web browsers allow you to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>View cookies stored on your device</li>
                <li>Delete existing cookies</li>
                <li>Block cookies entirely</li>
                <li>Receive notifications when cookies are set</li>
              </ul>
              <p className="text-gray-700 mb-8">
                If you disable or block cookies, some features of the Services may not function properly.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">Cookie Consent Tools</h3>
              <p className="text-gray-700 mb-8">
                Where required by law, we may present a cookie banner or consent tool that allows you to manage your preferences for non-essential cookies.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">Do Not Track Signals</h3>
              <p className="text-gray-700 mb-8">
                Some browsers offer a "Do Not Track" ("DNT") setting. At this time, our Services do not respond to DNT signals or similar mechanisms.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Changes to This Cookies Policy</h2>
              <p className="text-gray-700 mb-8">
                We may update this Cookies Policy from time to time to reflect changes in our practices, technologies, or legal requirements. When we do, we will update the "Effective Date" at the top of this page. Changes are effective when posted unless otherwise stated.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about this Cookies Policy or our use of cookies, please contact us at:
              </p>
              <p className="text-gray-700 mb-2">
                <strong>Lead2Lease</strong>
              </p>
              <p className="text-gray-700 mb-8">
                Email: <a href="mailto:support@lead2lease.ai" className="text-primary hover:underline">support@lead2lease.ai</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

