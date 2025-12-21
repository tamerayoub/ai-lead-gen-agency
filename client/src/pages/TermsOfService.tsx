import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import logoBlack from "@/assets/lead2lease-logo-black.svg";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";

export default function TermsOfService() {
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
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
            <p className="text-gray-600 mb-8">Last Updated: December 13, 2025</p>

            <div className="prose prose-sm md:prose-base max-w-none">
              <p className="text-gray-700 mb-6">
                Please read these Terms of Service ("Terms") carefully before accessing or using the Lead2Lease website, application, and services (collectively, the "Service"), operated by Lead2Lease ("Lead2Lease," "we," "us," or "our").
              </p>

              <p className="text-gray-700 mb-8">
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you may not access or use the Service.
              </p>

              <p className="text-gray-700 mb-8">
                You must be at least 18 years old to use the Service. If you are using the Service on behalf of an organization, you represent and warrant that you have authority to bind that organization to these Terms.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">1. Description of the Service</h2>
              <p className="text-gray-700 mb-4">
                Lead2Lease is an AI-powered leasing automation platform that provides tools to assist property managers, housing providers, and real estate professionals with lead engagement, communication, scheduling, screening workflows, and operational automation.
              </p>
              <p className="text-gray-700 mb-8">
                The Service provides technology and automation tools only. Lead2Lease does not provide legal, financial, real estate, housing, or regulatory advice.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">2. Account Registration</h2>
              <p className="text-gray-700 mb-4">
                To access certain features, you must create an account.
              </p>
              <p className="text-gray-700 mb-4">
                You agree to provide accurate, complete, and current information and to keep your login credentials secure. You are responsible for all activity that occurs under your account.
              </p>
              <p className="text-gray-700 mb-8">
                You must notify us immediately of any unauthorized use or security breach.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">3. Communications & Consent</h2>
              <p className="text-gray-700 mb-4">
                By creating an account, you consent to receive electronic communications from Lead2Lease, including service notices, onboarding messages, billing notifications, system alerts, and product updates.
              </p>
              <p className="text-gray-700 mb-4">
                You may opt out of non-essential marketing communications at any time; however, service-related communications are required for account operation.
              </p>
              <p className="text-gray-700 mb-8">
                Electronic communications satisfy any legal requirement that such communications be in writing.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">4. AI & Automation Disclaimer</h2>
              <p className="text-gray-700 mb-4">
                Lead2Lease uses artificial intelligence and automation to assist with leasing workflows.
              </p>
              <p className="text-gray-700 mb-4">
                You acknowledge and agree that:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>AI-generated outputs are assistive only</li>
                <li>Lead2Lease does not guarantee outcomes, leasing decisions, approvals, or compliance</li>
                <li>Lead2Lease does not make leasing, screening, or housing decisions</li>
                <li>You remain solely responsible for Fair Housing compliance and all leasing decisions</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 mb-4">5. No Professional Advice</h2>
              <p className="text-gray-700 mb-4">
                The Service does not provide legal, financial, real estate, housing, or compliance advice. Any information generated by the Service is for general informational purposes only.
              </p>
              <p className="text-gray-700 mb-8">
                You are solely responsible for consulting qualified professionals regarding Fair Housing laws, tenant screening regulations, leasing decisions, and compliance obligations.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">6. Fair Housing & Screening Responsibility</h2>
              <p className="text-gray-700 mb-4">
                You acknowledge that Lead2Lease does not determine applicant eligibility, approval, denial, or screening criteria.
              </p>
              <p className="text-gray-700 mb-8">
                All screening questions, workflows, criteria, and decisions are configured and controlled by you. You are solely responsible for ensuring compliance with Fair Housing laws and applicable regulations.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">7. Messaging & Regulatory Compliance (TCPA, CAN-SPAM)</h2>
              <p className="text-gray-700 mb-4">
                You represent and warrant that you have obtained all necessary consents and authorizations to send communications using the Service, including SMS, email, automated, or AI-generated messages.
              </p>
              <p className="text-gray-700 mb-4">
                You agree that your use of the Service complies with all applicable laws, including but not limited to the Telephone Consumer Protection Act (TCPA), CAN-SPAM Act, and similar regulations.
              </p>
              <p className="text-gray-700 mb-8">
                Lead2Lease is not responsible for your failure to obtain required consents.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">8. Integrations & Third-Party Services</h2>
              <p className="text-gray-700 mb-4">
                The Service may integrate with third-party platforms such as email providers, messaging services, calendar tools, AI providers, and payment processors.
              </p>
              <p className="text-gray-700 mb-4">
                By enabling integrations, you authorize Lead2Lease to access and process data as required to provide the Service. You may revoke access at any time.
              </p>
              <p className="text-gray-700 mb-8">
                Lead2Lease is not responsible for third-party service availability, outages, data loss, or policy changes.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">9. Subscriptions & Billing</h2>
              <p className="text-gray-700 mb-4">
                Certain features require a paid subscription.
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Subscriptions are billed in advance on a recurring basis</li>
                <li>Subscriptions automatically renew unless canceled</li>
                <li>Cancellation must occur before the next billing cycle</li>
                <li>Inactivity does not constitute cancellation</li>
              </ul>
              <p className="text-gray-700 mb-4">
                <strong>Founding Partner Payment Transition</strong>
              </p>
              <p className="text-gray-700 mb-4">
                For Founding Partner memberships purchased prior to launch, you acknowledge and agree that your upfront payment may automatically convert to a recurring subscription payment model post-launch.
              </p>
              <p className="text-gray-700 mb-8">
                By purchasing a Founding Partner membership, you authorize Lead2Lease (or its payment processor) to charge your payment method on a recurring basis once the transition occurs. You will be notified of the transition date and may cancel at any time in accordance with these Terms.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">10. Free Trials & Promotions</h2>
              <p className="text-gray-700 mb-4">
                Lead2Lease may offer free trials or promotional pricing at its discretion.
              </p>
              <p className="text-gray-700 mb-8">
                Unless canceled before the trial ends, your subscription will automatically convert to a paid plan. We reserve the right to modify or discontinue promotional offers at any time.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">11. Fee Changes & Refunds</h2>
              <p className="text-gray-700 mb-4">
                We may modify subscription fees with reasonable prior notice. Continued use after the effective date constitutes acceptance.
              </p>
              <p className="text-gray-700 mb-8">
                Refunds, if any, are granted at our sole discretion unless required by law.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">12. Data Ownership & License</h2>
              <p className="text-gray-700 mb-4">
                You retain ownership of all data you submit through the Service ("User Data").
              </p>
              <p className="text-gray-700 mb-4">
                You grant Lead2Lease a limited, non-exclusive license to process User Data solely to operate, maintain, and improve the Service.
              </p>
              <p className="text-gray-700 mb-8">
                We may analyze anonymized or aggregated data to improve our AI systems and platform performance.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">13. Acceptable Use</h2>
              <p className="text-gray-700 mb-4">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
                <li>Use the Service for unlawful or deceptive purposes</li>
                <li>Send spam or unauthorized communications</li>
                <li>Violate privacy or third-party rights</li>
                <li>Attempt to reverse engineer, abuse, or disrupt the Service</li>
              </ul>
              <p className="text-gray-700 mb-8">
                We may suspend or terminate accounts that violate these Terms.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">14. Intellectual Property</h2>
              <p className="text-gray-700 mb-4">
                The Service and its content (excluding User Data) are the exclusive property of Lead2Lease and its licensors.
              </p>
              <p className="text-gray-700 mb-8">
                You are granted a limited, non-transferable, non-sublicensable license to use the Service solely for its intended business purposes.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">15. Feedback</h2>
              <p className="text-gray-700 mb-8">
                Any feedback, suggestions, or ideas you provide may be used by Lead2Lease without obligation, restriction, or compensation.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">16. Service Availability</h2>
              <p className="text-gray-700 mb-4">
                The Service is provided on an "as available" basis. Lead2Lease does not guarantee uninterrupted or error-free operation and may suspend access for maintenance, security, or updates.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">17. Disclaimer of Warranties</h2>
              <p className="text-gray-700 mb-4">
                <strong>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."</strong>
              </p>
              <p className="text-gray-700 mb-8">
                LEAD2LEASE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, RELIABILITY, AND NON-INFRINGEMENT.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">18. Limitation of Liability</h2>
              <p className="text-gray-700 mb-4">
                To the maximum extent permitted by law, Lead2Lease shall not be liable for indirect, incidental, consequential, special, or punitive damages.
              </p>
              <p className="text-gray-700 mb-8">
                Our total liability shall not exceed the amount paid by you in the twelve (12) months preceding the claim.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">19. Indemnification</h2>
              <p className="text-gray-700 mb-8">
                You agree to indemnify and hold harmless Lead2Lease and its affiliates from any claims arising from your use of the Service, violation of these Terms, or misuse of User Data.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">20. Arbitration & Class Action Waiver</h2>
              <p className="text-gray-700 mb-4">
                Any dispute arising out of or relating to these Terms shall be resolved through binding arbitration on an individual basis.
              </p>
              <p className="text-gray-700 mb-8">
                You waive any right to participate in a class action or jury trial.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">21. Force Majeure</h2>
              <p className="text-gray-700 mb-8">
                Lead2Lease shall not be liable for delays or failures caused by events beyond its reasonable control, including outages, natural disasters, governmental actions, or third-party service disruptions.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">22. Assignment</h2>
              <p className="text-gray-700 mb-8">
                Lead2Lease may assign these Terms in connection with a merger, acquisition, or sale of assets.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">23. Export Compliance</h2>
              <p className="text-gray-700 mb-8">
                You may not use the Service in violation of U.S. export control or sanctions laws.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">24. Termination</h2>
              <p className="text-gray-700 mb-4">
                We may suspend or terminate access for violations of these Terms or applicable law.
              </p>
              <p className="text-gray-700 mb-8">
                Upon termination, you remain responsible for outstanding fees. Sections relating to liability, indemnification, arbitration, and intellectual property survive termination.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">25. Governing Law</h2>
              <p className="text-gray-700 mb-8">
                These Terms are governed by the laws of the United States and the State in which Lead2Lease is registered, without regard to conflict of law principles.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">26. Changes to Terms</h2>
              <p className="text-gray-700 mb-8">
                We may update these Terms from time to time. Continued use after changes become effective constitutes acceptance.
              </p>

              <h2 className="text-2xl font-bold mt-8 mb-4">27. Contact</h2>
              <p className="text-gray-700 mb-8">
                Questions about these Terms may be sent to:
              </p>
              <p className="text-gray-700 mb-8">
                <a href="mailto:support@lead2lease.ai" className="text-primary hover:underline">
                  support@lead2lease.ai
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

