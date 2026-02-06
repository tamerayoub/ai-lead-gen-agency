import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { nanoid } from "nanoid";

// Generate a unique session token for this onboarding session
const getSessionToken = () => {
  const stored = localStorage.getItem("onboarding_token");
  if (stored) return stored;
  const newToken = nanoid();
  localStorage.setItem("onboarding_token", newToken);
  return newToken;
};

const steps = [
  {
    id: 1,
    title: "Property Portfolio",
    description: "Tell us about your properties",
    fields: ["unitsOwned", "portfolioLocation"],
  },
  {
    id: 2,
    title: "Current Operations",
    description: "How do you manage your properties?",
    fields: ["currentLeaseHandling", "leaseHandlingToolName", "teamSize"],
  },
  {
    id: 3,
    title: "Contact Information",
    description: "How can we reach you?",
    fields: ["fullName", "phoneNumber"],
  },
  {
    id: 4,
    title: "Demo Booking",
    description: "Would you like to see Lead2Lease in action?",
    fields: ["wantsDemo"],
  },
];

const onboardingSchema = z.object({
  unitsOwned: z.string().min(1, "Please select how many units you manage or own"),
  portfolioLocation: z.string().min(1, "Please enter your portfolio location"),
  currentLeaseHandling: z.string().min(1, "Please tell us how you handle leases"),
  leaseHandlingToolName: z.string().optional(),
  teamSize: z.string().min(1, "Please select your team size"),
  fullName: z.string().min(2, "Please enter your full name"),
  organizationName: z.string().optional(), // Optional - will be collected during founding partner setup
  phoneNumber: z.string().min(1, "Please enter your phone number"),
  wantsDemo: z.boolean(),
}).refine((data) => {
  // If they selected property-management-software or other, require tool name
  if (data.currentLeaseHandling === "property-management-software" || data.currentLeaseHandling === "other") {
    return data.leaseHandlingToolName && data.leaseHandlingToolName.length > 0;
  }
  return true;
}, {
  message: "Please specify which tool you're using",
  path: ["leaseHandlingToolName"],
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

function OnboardingFlowContent() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionToken] = useState(getSessionToken());
  const { isAuthenticated } = useAuth();

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      unitsOwned: "",
      portfolioLocation: "",
      currentLeaseHandling: "",
      leaseHandlingToolName: "",
      teamSize: "",
      fullName: "",
      organizationName: undefined,
      phoneNumber: "",
      wantsDemo: false,
    },
    mode: "onChange",
  });

  // Load existing onboarding data if resuming
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        const response = await fetch(`/api/onboarding/${sessionToken}`);
        if (response.ok) {
          const data = await response.json();
          
          // If this onboarding is already completed/linked, clear the token
          // The page will start fresh on next mount with a new token
          if (data.status === 'completed' || data.status === 'linked') {
            localStorage.removeItem("onboarding_token");
            return;
          }
          
          // Otherwise, resume the in-progress onboarding
          if (data.unitsOwned) form.setValue("unitsOwned", data.unitsOwned);
          if (data.portfolioLocation) form.setValue("portfolioLocation", data.portfolioLocation);
          if (data.currentLeaseHandling) form.setValue("currentLeaseHandling", data.currentLeaseHandling);
          if (data.leaseHandlingToolName) form.setValue("leaseHandlingToolName", data.leaseHandlingToolName);
          if (data.teamSize) form.setValue("teamSize", data.teamSize);
          if (data.fullName) form.setValue("fullName", data.fullName);
          // organizationName removed from onboarding - collected during founding partner setup
          if (data.phoneNumber) form.setValue("phoneNumber", data.phoneNumber);
          if (data.wantsDemo !== null) form.setValue("wantsDemo", data.wantsDemo);
        }
      } catch (error) {
        console.log("No existing onboarding data found");
      }
    };
    loadExistingData();
  }, [sessionToken, form]);

  const saveOnboarding = useMutation({
    mutationFn: async (data: Partial<OnboardingFormData>) => {
      return await apiRequest("POST", "/api/onboarding", {
        sessionToken,
        ...data,
      });
    },
  });

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/onboarding/${sessionToken}/complete`);
    },
    onSuccess: async () => {
      const { getAcquisitionContext } = await import("@/lib/acquisition");
      const { trackOnboardingCompleted } = await import("@/lib/analytics");
      const ctx = getAcquisitionContext();
      if (ctx) {
        trackOnboardingCompleted({
          offer: ctx.offer,
          source: ctx.source,
          campaign: ctx.campaign ?? undefined,
          landing_page: ctx.landing_page,
        });
      }
      // If user is authenticated, redirect to app (intake will be auto-linked)
      // Otherwise, redirect to login with onboarding token
      if (isAuthenticated) {
        // Check if on marketing domain - if so, redirect to app subdomain
        const hostname = window.location.hostname.toLowerCase();
        const isMarketingDomain = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
        
        if (isMarketingDomain) {
          console.log('[Onboarding] On marketing domain, redirecting to app subdomain');
          window.location.href = 'https://app.lead2lease.ai';
        } else {
          // On app domain or local dev - use relative path
          window.location.href = '/app';
        }
      } else {
        // If on marketing domain, redirect to app subdomain for login
        const hostname = window.location.hostname.toLowerCase();
        const isMarketingDomain = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
        
        if (isMarketingDomain) {
          window.location.href = `https://app.lead2lease.ai/login?onboardingToken=${sessionToken}`;
        } else {
          setLocation(`/login?onboardingToken=${sessionToken}`);
        }
      }
    },
  });

  const handleNext = async () => {
    const currentStepData = steps[currentStep - 1];
    const fieldsToValidate = currentStepData.fields as (keyof OnboardingFormData)[];
    
    // Trigger validation for current step fields
    const isValid = await form.trigger(fieldsToValidate);
    
    if (!isValid) {
      return;
    }

    // Save current step data
    const formData = form.getValues();
    const dataToSave: Partial<OnboardingFormData> = {};
    fieldsToValidate.forEach((field) => {
      (dataToSave as any)[field] = formData[field];
    });

    await saveOnboarding.mutateAsync(dataToSave);

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete the onboarding flow
      await completeOnboarding.mutateAsync();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      // First step - go back to landing page
      setLocation("/");
    }
  };

  const progress = (currentStep / steps.length) * 100;
  const currentStepData = steps[currentStep - 1];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-semibold">Step {currentStep} of {steps.length}</span>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
            {currentStepData.title}
          </h1>
          <p className="text-lg text-gray-600">
            {currentStepData.description}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <Progress value={progress} className="h-3" data-testid="progress-onboarding" />
        </div>

        <Card className="border border-gray-200 shadow-2xl bg-white">
        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {currentStep === 1 && (
                <>
                  <FormField
                    control={form.control}
                    name="unitsOwned"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How many units do you manage or own?*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-units-owned" className="bg-gray-50 border-gray-300 text-gray-900">
                              <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 units</SelectItem>
                            <SelectItem value="11-50">11-50 units</SelectItem>
                            <SelectItem value="51-100">51-100 units</SelectItem>
                            <SelectItem value="101-500">101-500 units</SelectItem>
                            <SelectItem value="500+">500+ units</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="portfolioLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Where is your portfolio?*</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Minneapolis, MN"
                            {...field}
                            data-testid="input-portfolio-location"
                            className="bg-gray-50 border-gray-300 text-gray-900"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 2 && (
                <>
                  <FormField
                    control={form.control}
                    name="currentLeaseHandling"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How are you handling leases right now?*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lease-handling" className="bg-gray-50 border-gray-300 text-gray-900">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Manual / Spreadsheets</SelectItem>
                            <SelectItem value="property-management-software">Property Management Software</SelectItem>
                            <SelectItem value="property-manager">Hire Property Manager</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Conditionally show tool name input */}
                  {(form.watch("currentLeaseHandling") === "property-management-software" || 
                    form.watch("currentLeaseHandling") === "other") && (
                    <FormField
                      control={form.control}
                      name="leaseHandlingToolName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {form.watch("currentLeaseHandling") === "property-management-software" 
                              ? "Which property management software are you using?" 
                              : "Please specify what you're using"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={form.watch("currentLeaseHandling") === "property-management-software" 
                                ? "e.g., Buildium, AppFolio, Yardi" 
                                : "Please describe"}
                              {...field}
                              data-testid="input-tool-name"
                              className="bg-gray-50 border-gray-300 text-gray-900"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="teamSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What's your team size?*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-team-size" className="bg-gray-50 border-gray-300 text-gray-900">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="just-me">Just me</SelectItem>
                            <SelectItem value="2-5">2-5 people</SelectItem>
                            <SelectItem value="6-10">6-10 people</SelectItem>
                            <SelectItem value="11-25">11-25 people</SelectItem>
                            <SelectItem value="25+">25+ people</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 3 && (
                <>
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What is your name?*</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            {...field}
                            data-testid="input-full-name"
                            className="bg-gray-50 border-gray-300 text-gray-900"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone number*</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="(555) 123-4567"
                            {...field}
                            data-testid="input-phone-number"
                            className="bg-gray-50 border-gray-300 text-gray-900"
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          For contact purposes only - not for verification
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card overflow-hidden">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1">Would you like to book a demo?</h3>
                      <p className="text-sm text-muted-foreground mb-4 break-words">
                        See how Lead2Lease can automate your rental property management with AI-powered lead qualification, email automation, and intelligent scheduling.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          type="button"
                          variant={form.watch("wantsDemo") === true ? "default" : "outline"}
                          onClick={() => form.setValue("wantsDemo", true)}
                          data-testid="button-yes-demo"
                          className="flex-1 sm:flex-initial"
                        >
                          Yes, I'd like a demo
                        </Button>
                        <Button
                          type="button"
                          variant={form.watch("wantsDemo") === false ? "default" : "outline"}
                          onClick={() => form.setValue("wantsDemo", false)}
                          data-testid="button-no-demo"
                          className="flex-1 sm:flex-initial"
                        >
                          No, skip for now
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBack}
                  data-testid="button-back"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={saveOnboarding.isPending || completeOnboarding.isPending}
                  data-testid="button-next"
                >
                  {currentStep === steps.length ? (
                    completeOnboarding.isPending ? (
                      "Completing..."
                    ) : (
                      "Complete & Sign Up"
                    )
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// Wrap the entire page in ThemeProvider forcing light mode for consistent branding
export default function OnboardingFlow() {
  return (
    <ThemeProvider forcedTheme="light">
      <OnboardingFlowContent />
    </ThemeProvider>
  );
}
