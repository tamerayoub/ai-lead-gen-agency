import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";

export default function PrivacyNotice() {
  const [, setLocation] = useLocation();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
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
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Lead2Lease Privacy Notice</h1>
            <p className="text-gray-600 mb-8">Effective Date: 12/13/2025</p>

            <div className="prose prose-sm md:prose-base max-w-none">
              <p className="text-gray-700 mb-6">
                This Privacy Notice ("Privacy Notice" or "Notice") describes how Lead2Lease ("Lead2Lease," "we," "us," or "our") collects, uses, shares, and protects personal information from individuals located in the United States ("you" or "your") through our website, web application, platform, and other online services that link to this Privacy Notice (collectively, the "Services").
              </p>

              <p className="text-gray-700 mb-6">
                Lead2Lease provides software-as-a-service tools to property owners, property managers, and other business customers (collectively, "Property Managers") to help manage leasing workflows, including lead engagement, communications, scheduling, rental applications, and related automation (the "Platform"). The Platform may allow residents and prospective residents ("Applicants" or "Prospects") to submit information and interact with Property Managers.
              </p>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
                <h3 className="font-semibold text-blue-900 mb-2">Important Notice Regarding Property Managers:</h3>
                <p className="text-blue-800 text-sm">
                  This Privacy Notice describes Lead2Lease's privacy practices. It does not govern how Property Managers independently collect, use, or store your information. If you interact with a Property Manager through the Platform, you should contact that Property Manager directly to understand their privacy practices and to exercise any applicable rights.
                </p>
              </div>

              <p className="text-gray-700 mb-8">
                This Privacy Notice does not apply to information that is de-identified or aggregated such that it cannot reasonably be used to identify an individual or household.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Information We Collect</h2>
              <p className="text-gray-700 mb-4">
                We collect personal information from a variety of sources, including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Directly from you</li>
                <li>From or on behalf of Property Managers</li>
                <li>From third-party sources</li>
                <li>Automatically through your use of the Services</li>
              </ul>

              <h3 className="text-xl font-bold mt-6 mb-4">Information You Provide Directly</h3>
              <p className="text-gray-700 mb-4">
                Depending on how you use the Services, we may collect:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Name, email address, phone number, and mailing address</li>
                <li>Account credentials (such as username and password)</li>
                <li>Communications with us or through the Platform</li>
                <li>Scheduling preferences, messages, and form submissions</li>
                <li>Documents and content you upload through the Platform</li>
              </ul>

              <h3 className="text-xl font-bold mt-6 mb-4">Application and Verification Information</h3>
              <p className="text-gray-700 mb-4">
                When enabled by a Property Manager, the Platform allows Applicants to submit rental application information and supporting documentation. This may include:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Government-issued identification (e.g., driver's license or passport)</li>
                <li>Proof of income or financial records</li>
                <li>Employment and rental history</li>
                <li>Other documents required by a Property Manager for screening or leasing purposes</li>
              </ul>
              <p className="text-gray-700 mb-8">
                Documents and application materials are stored securely and made available to the applicable Property Manager and, where authorized, to third-party screening providers engaged by the Property Manager.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">Information Provided by Property Managers</h3>
              <p className="text-gray-700 mb-4">
                Property Managers may provide personal information to Lead2Lease in order to use the Platform. This may include:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Applicant or resident contact information</li>
                <li>Property and unit information</li>
                <li>Application status and leasing workflow data</li>
                <li>Communication metadata and messages</li>
                <li>Move-in timelines and related leasing information</li>
              </ul>

              <h3 className="text-xl font-bold mt-6 mb-4">Information from Third Parties</h3>
              <p className="text-gray-700 mb-4">
                We may receive information from third parties such as:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Background screening and credit reporting providers engaged by Property Managers</li>
                <li>Payment processors (e.g., Stripe) related to subscription billing events</li>
                <li>Integration partners (e.g., Google services) that you or Property Managers authorize</li>
                <li>Marketing and analytics partners</li>
              </ul>

              <h3 className="text-xl font-bold mt-6 mb-4">Information Collected Automatically</h3>
              <p className="text-gray-700 mb-4">
                When you use the Services, we may automatically collect:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>IP address</li>
                <li>Device identifiers</li>
                <li>Browser type and operating system</li>
                <li>Date and time of access</li>
                <li>Pages viewed and interactions</li>
                <li>Referring URLs and diagnostic logs</li>
              </ul>
              <p className="text-gray-700 mb-8">
                We collect this information using cookies, pixels, scripts, and similar technologies.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">How We Use Information</h2>
              <p className="text-gray-700 mb-4">
                We use personal information for purposes including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Providing, operating, and maintaining the Platform</li>
                <li>Facilitating leasing workflows, including application collection and scheduling</li>
                <li>Securely transmitting authorized application information to third-party screening providers</li>
                <li>Displaying screening results or status information to Applicants and Property Managers</li>
                <li>Communicating transactional messages (e.g., confirmations, security notices, billing notices)</li>
                <li>Providing customer support</li>
                <li>Improving and developing our Services, including analytics and automation features</li>
                <li>Conducting internal research, audits, and reporting</li>
                <li>Preventing fraud, abuse, and unauthorized access</li>
                <li>Enforcing our legal terms and policies</li>
                <li>Complying with applicable laws and legal obligations</li>
              </ul>

              <h3 className="text-xl font-bold mt-6 mb-4">AI and Automated Processing</h3>
              <p className="text-gray-700 mb-8">
                Lead2Lease may use automation and artificial intelligence technologies to assist with tasks such as message routing, drafting responses, scheduling follow-ups, classification, summarization, and workflow optimization. These systems may process information provided through the Platform in order to deliver the Services.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">Third-Party Screening and Background Checks</h3>
              <p className="text-gray-700 mb-4">
                Lead2Lease does not independently perform background checks, credit checks, criminal history searches, or tenant eligibility determinations.
              </p>
              <p className="text-gray-700 mb-4">
                When a Property Manager requests screening services, the Platform may facilitate the transmission of Applicant information to third-party consumer reporting agencies or screening providers selected by the Property Manager. These providers independently collect, process, and evaluate information in accordance with their own privacy policies and legal obligations, including the Fair Credit Reporting Act (FCRA), where applicable.
              </p>
              <p className="text-gray-700 mb-8">
                Lead2Lease may receive and display screening results or status information provided by these third parties solely to make such information accessible to the Applicant and Property Manager. Lead2Lease does not control, verify, or guarantee the accuracy of screening results and does not make leasing or eligibility decisions.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">How We Share Information</h2>
              <p className="text-gray-700 mb-4">
                We may share personal information as permitted by law and consistent with this Privacy Notice, including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>With Property Managers when information is collected on their behalf</li>
                <li>With third-party screening, identity verification, and background check providers engaged by Property Managers</li>
                <li>With service providers that help us operate the Services (e.g., hosting, analytics, communications, payment processing)</li>
                <li>With integration partners that you or Property Managers authorize</li>
                <li>With professional advisors such as legal, accounting, or compliance providers</li>
                <li>To comply with legal obligations, court orders, or lawful requests</li>
                <li>To protect the rights, safety, and security of users, Property Managers, Lead2Lease, or others</li>
                <li>In connection with a merger, acquisition, financing, or sale of assets</li>
                <li>With your consent or at your direction</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">Cookies and Similar Technologies</h2>
              <p className="text-gray-700 mb-4">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Enable core functionality and authentication</li>
                <li>Remember preferences</li>
                <li>Analyze usage and performance</li>
                <li>Prevent fraud and abuse</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Most browsers allow you to manage cookies through settings. If you disable cookies, some features of the Services may not function properly.
              </p>
              <p className="text-gray-700 mb-8">
                We do not currently respond to "Do Not Track" browser signals.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Your Choices and Rights</h2>
              <h3 className="text-xl font-bold mt-6 mb-4">Updating Your Information</h3>
              <p className="text-gray-700 mb-8">
                If you have a Lead2Lease account, you may update certain information through your account settings. Applicants or residents interacting with a Property Manager may need to contact the Property Manager to update information under their control.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">Marketing Communications</h3>
              <p className="text-gray-700 mb-8">
                You may opt out of marketing emails from Lead2Lease by using the unsubscribe link included in those emails. You may continue to receive non-marketing communications related to your use of the Services.
              </p>

              <h3 className="text-xl font-bold mt-6 mb-4">Data Rights</h3>
              <p className="text-gray-700 mb-8">
                Depending on your jurisdiction, you may have rights to access, correct, or delete personal information. If your data is controlled by a Property Manager, you should contact that Property Manager directly to exercise your rights.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">How We Secure Information</h2>
              <p className="text-gray-700 mb-8">
                We implement reasonable administrative, technical, and organizational safeguards designed to protect personal information. However, no system is completely secure, and we cannot guarantee absolute security.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Updates to This Privacy Notice</h2>
              <p className="text-gray-700 mb-8">
                We may update this Privacy Notice from time to time. If we make changes, we will update the Effective Date at the top of this page. Changes become effective when posted unless otherwise stated.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions or concerns about this Privacy Notice or our privacy practices, contact us at:
              </p>
              <p className="text-gray-700 mb-2">
                <strong>Lead2Lease</strong>
              </p>
              <p className="text-gray-700 mb-2">
                Email: <a href="mailto:support@lead2lease.ai" className="text-primary hover:underline">support@lead2lease.ai</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

