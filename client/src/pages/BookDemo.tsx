import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Calendar, Home } from "lucide-react";
import logoBlack from "@/assets/lead2lease-logo-black.svg";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: {
        url: string;
        parentElement: HTMLElement | null;
        prefill?: { name?: string; email?: string };
      }) => void;
    };
  }
}

const CALENDLY_URL = 'https://calendly.com/lead2leaseai/30min';

const demoRequestSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  countryCode: z.string().default("+1"),
  organization: z.string().min(1, "Organization is required"),
  unitsUnderManagement: z.string().min(1, "Units under management is required"),
  managedOrOwned: z.string().min(1, "Please select an option"),
  hqLocation: z.string().min(1, "HQ location is required"),
  currentTools: z.string().max(200, "Please limit to 200 characters").optional(),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms of use",
  }),
  agreeMarketing: z.boolean().refine((val) => val === true, {
    message: "You must agree to receive marketing communications",
  }),
});

type DemoRequestFormData = z.infer<typeof demoRequestSchema>;

function BookDemoContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<DemoRequestFormData | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const calendlyRef = useRef<HTMLDivElement>(null);
  const calendlyScriptLoaded = useRef(false);
  const calendlyInitialized = useRef(false);

  // Load Calendly script on component mount
  useEffect(() => {
    if (calendlyScriptLoaded.current) {
      return;
    }

    const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
    
    if (!existingScript && !window.Calendly) {
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      script.onerror = () => {
        console.error('Failed to load Calendly script');
      };
      document.head.appendChild(script);
      calendlyScriptLoaded.current = true;
    } else if (window.Calendly) {
      calendlyScriptLoaded.current = true;
    }
  }, []);

  // Initialize Calendly widget when form is submitted
  useEffect(() => {
    if (!formSubmitted || !formData) {
      return;
    }

    // Reset initialization flag when form is submitted
    if (calendlyInitialized.current) {
      calendlyInitialized.current = false;
    }

    const initCalendly = () => {
      // Check if already initialized or ref is not available
      if (calendlyInitialized.current || !calendlyRef.current || !window.Calendly) {
        return;
      }

      try {
        // Clear any existing content
        calendlyRef.current.innerHTML = '';
        
        window.Calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: calendlyRef.current,
          prefill: {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
          }
        });
        
        calendlyInitialized.current = true;
      } catch (error) {
        console.error('Error initializing Calendly:', error);
        calendlyInitialized.current = false;
        toast({
          title: "Error loading calendar",
          description: "Please refresh the page and try again.",
          variant: "destructive",
        });
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      // Wait for Calendly to be available
      if (window.Calendly) {
        // Small delay to ensure DOM is ready
        setTimeout(initCalendly, 300);
      } else {
        // Poll for Calendly to load
        const checkInterval = setInterval(() => {
          if (window.Calendly && calendlyRef.current) {
            clearInterval(checkInterval);
            setTimeout(initCalendly, 300);
          }
        }, 100);
        
        // Cleanup after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.Calendly) {
            toast({
              title: "Error loading calendar",
              description: "Please refresh the page and try again.",
              variant: "destructive",
            });
          }
        }, 10000);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [formSubmitted, formData, toast]);

  // Restore form data from sessionStorage on mount
  const savedFormData = typeof window !== 'undefined' ? sessionStorage.getItem('bookDemoFormData') : null;
  const initialValues = savedFormData ? (() => {
    try {
      return JSON.parse(savedFormData);
    } catch (error) {
      console.error('Failed to parse saved form data:', error);
      return undefined;
    }
  })() : undefined;

  const form = useForm<DemoRequestFormData>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: initialValues || {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      countryCode: "+1",
      organization: "",
      unitsUnderManagement: "",
      managedOrOwned: "",
      hqLocation: "",
      currentTools: "",
      agreeTerms: false,
      agreeMarketing: false,
    },
    mode: "onChange",
  });


  // Save form data to sessionStorage whenever form values change
  useEffect(() => {
    const subscription = form.watch((value) => {
      sessionStorage.setItem('bookDemoFormData', JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  async function onSubmit(values: DemoRequestFormData) {
    setIsLoading(true);
    // Clear saved form data on successful submission
    sessionStorage.removeItem('bookDemoFormData');
    
    try {
      // Save form data to backend first
      await apiRequest("POST", "/api/demo-requests", {
        ...values,
        company: values.organization,
        isCurrentCustomer: false,
      });
      
      // Store form data locally
      setFormData(values);
      
      // Mark form as submitted to show calendar
      setFormSubmitted(true);
      
      toast({
        title: "Form submitted successfully!",
        description: "Please select a time slot for your demo.",
      });
    } catch (error: any) {
      console.error('Form submission error:', error);
      toast({
        title: "Submission failed",
        description: error.message || "Unable to submit form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Smaller */}
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

      {/* Form and Calendar Section - Sequential Layout */}
      <div className="container mx-auto px-4 py-2">
        <div className={`${formSubmitted ? 'max-w-7xl' : 'max-w-3xl'} mx-auto`}>
          {!formSubmitted ? (
            /* Step 1: Form Only */
            <div>
              {/* Header Section with Gradient */}
              <div className="text-center mb-4">
                <h1 className="text-xl font-bold mb-1 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                  Schedule a Demo
                </h1>
                <p className="text-xs text-gray-600">
                  Tell us about yourself to get started.
                </p>
              </div>
              
              <Card className="border border-gray-200 shadow-lg bg-white">
              <CardContent className="pt-3 pb-3">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
                  {/* Row 1: Name Fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs mb-0.5">First Name*</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-first-name" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs mb-0.5">Last Name*</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-last-name" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 2: Email and Organization */}
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs mb-0.5">Email*</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-email" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="organization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs mb-0.5">Organization*</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Your Organization" data-testid="input-organization" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 3: Phone Number */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs mb-0.5">Phone Number*</FormLabel>
                        <div className="flex gap-2">
                          <FormField
                            control={form.control}
                            name="countryCode"
                            render={({ field: codeField }) => (
                              <Select
                                onValueChange={codeField.onChange}
                                defaultValue={codeField.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-24 bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs" data-testid="select-country-code">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="+1">🇺🇸 +1</SelectItem>
                                  <SelectItem value="+44">🇬🇧 +44</SelectItem>
                                  <SelectItem value="+971">🇦🇪 +971</SelectItem>
                                  <SelectItem value="+966">🇸🇦 +966</SelectItem>
                                  <SelectItem value="+20">🇪🇬 +20</SelectItem>
                                  <SelectItem value="+962">🇯🇴 +962</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <FormControl>
                            <Input {...field} placeholder="123456789" data-testid="input-phone" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs flex-1" />
                          </FormControl>
                        </div>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Row 4: Units, Managed/Owned, HQ Location */}
                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="unitsUnderManagement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs mb-0.5">Units*</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-units" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1-10">1-10</SelectItem>
                              <SelectItem value="11-50">11-50</SelectItem>
                              <SelectItem value="51-100">51-100</SelectItem>
                              <SelectItem value="101-500">101-500</SelectItem>
                              <SelectItem value="500+">500+</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="managedOrOwned"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs mb-0.5">Type*</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-managed-owned" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="managed">Managed</SelectItem>
                              <SelectItem value="owned">Owned</SelectItem>
                              <SelectItem value="both">Both</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hqLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs mb-0.5">HQ Location*</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="State" data-testid="input-hq-location" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 5: Current Tools */}
                  <FormField
                    control={form.control}
                    name="currentTools"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs mb-0.5">Tools Currently Using (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Yardi, Buildium, AppFolio" data-testid="input-current-tools" className="bg-gray-50 border-gray-300 text-gray-900 h-8 text-xs" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Row 6: Checkboxes */}
                  <div className="space-y-1">
                    <FormField
                      control={form.control}
                      name="agreeTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-terms"
                              className="mt-0.5 h-3.5 w-3.5"
                            />
                          </FormControl>
                          <div className="space-y-0 leading-tight">
                            <FormLabel className="text-xs font-normal">
                              You accept our{" "}
                              <Link 
                                href={`/privacy-notice?returnTo=${encodeURIComponent(window.location.pathname)}`} 
                                className="text-primary hover:underline"
                              >
                                Privacy Notice
                              </Link>
                              .*
                            </FormLabel>
                            <FormMessage className="text-xs" />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agreeMarketing"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-marketing"
                              className="mt-0.5 h-3.5 w-3.5"
                            />
                          </FormControl>
                          <div className="space-y-0 leading-tight">
                            <FormLabel className="text-xs font-normal">
                              I agree to receive marketing communications from Lead2Lease.*
                            </FormLabel>
                            <FormMessage className="text-xs" />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="w-full h-9 mt-1 text-sm"
                      disabled={isLoading}
                      data-testid="button-submit"
                    >
                      {isLoading ? "Submitting..." : "Continue to Calendar"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            </div>
          ) : (
            /* Step 2: Calendar with Side Panel */
            <div className="flex flex-col lg:flex-row gap-4" style={{ height: 'calc(100vh - 80px)', maxHeight: 'calc(100vh - 80px)' }}>
              {/* Left Side: Select Your Time Section */}
              <div className="lg:w-80 flex-shrink-0 flex flex-col">
                <Card className="border border-gray-200 shadow-lg bg-white h-full">
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-primary/10 text-primary mb-1.5 w-fit">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs font-semibold">Select Your Time</span>
                    </div>
                    <CardTitle className="text-base font-bold bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
                      Pick a time that works for you
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Select a time slot to book your personalized demo.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
              
              {/* Right Side: Calendly Widget */}
              <div className="flex-1 min-w-0 min-h-0">
                <Card className="border border-gray-200 shadow-lg bg-white overflow-hidden h-full flex flex-col">
                  <CardContent className="p-1 flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div 
                      ref={calendlyRef} 
                      style={{ 
                        minWidth: '320px', 
                        width: '100%',
                        height: '100%',
                        maxHeight: 'calc(100vh - 120px)',
                        position: 'relative',
                        flex: '1 1 auto',
                        overflow: 'hidden'
                      }} 
                      data-testid="calendly-embed"
                      className="calendly-inline-widget"
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrap the entire page in ThemeProvider forcing light mode for consistent branding
export default function BookDemo() {
  return (
    <ThemeProvider forcedTheme="light">
      <BookDemoContent />
    </ThemeProvider>
  );
}
