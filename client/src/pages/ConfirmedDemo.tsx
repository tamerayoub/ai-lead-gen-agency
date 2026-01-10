import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Home, Calendar, Mail } from "lucide-react";
import logoBlack from "@/assets/lead2lease-logo-black.svg";

function ConfirmedDemoContent() {
  // Get event details from URL params if available (Calendly can pass these)
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const eventDate = urlParams.get('event_date') || null;
  const inviteeEmail = urlParams.get('invitee_email') || null;
  const eventName = urlParams.get('event_name') || '30-minute Demo';

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200/50 sticky top-0 bg-gray-50/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-2 hover:opacity-80" data-testid="link-home">
                <img 
                  src={logoBlack} 
                  alt="Lead2Lease Logo" 
                  className="h-8 w-auto object-contain"
                />
              </a>
            </Link>
            <Link href="/">
              <a data-testid="link-back-to-home">
                <Button variant="secondary" size="sm" className="gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900 h-8 text-xs px-3">
                  <Home className="h-3 w-3" />
                  Back to Home
                </Button>
              </a>
            </Link>
          </div>
        </div>
      </header>

      {/* Confirmation Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="border border-gray-200 shadow-lg bg-white">
            <CardHeader className="text-center pb-4 pt-8">
              <div className="flex justify-center mb-4">
                <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                Demo Confirmed!
              </CardTitle>
              <CardDescription className="text-base mt-2">
                We're excited to show you how Lead2Lease can transform your leasing process.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              {/* Event Details */}
              {eventDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 mb-1">Your Scheduled Demo</h3>
                      <p className="text-sm text-blue-800">{eventName}</p>
                      <p className="text-sm font-medium text-blue-900 mt-1">
                        {formatDate(eventDate)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Message */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">What happens next?</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>You'll receive a confirmation email with calendar invite and meeting details{inviteeEmail && ` to ${inviteeEmail}`}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>Our team will prepare a personalized demo based on your needs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>We'll send you a reminder before your scheduled time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5">•</span>
                    <span>During the demo, we'll show you how Lead2Lease can streamline your entire leasing pipeline</span>
                  </li>
                </ul>
              </div>

              {/* Email Notice */}
              {inviteeEmail && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-900">
                        Please check your email <strong>{inviteeEmail}</strong> for the calendar invite and meeting link.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-center pt-4">
                <Link href="/" className="w-full sm:w-auto">
                  <Button className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:opacity-90 text-white">
                    Return to Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Wrap the entire page in ThemeProvider forcing light mode for consistent branding
export default function ConfirmedDemo() {
  return (
    <ThemeProvider forcedTheme="light">
      <ConfirmedDemoContent />
    </ThemeProvider>
  );
}
