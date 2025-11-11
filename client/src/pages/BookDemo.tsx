import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Building2, Calendar, CheckCircle2, Clock } from "lucide-react";
import { CalendarBooking } from "@/components/CalendarBooking";

const demoRequestSchema = z.object({
  isCurrentCustomer: z.boolean().default(false),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  countryCode: z.string().default("+962"),
  company: z.string().optional(),
  unitsUnderManagement: z.string().min(1, "Units under management is required"),
  managedOrOwned: z.string().min(1, "Please select an option"),
  hqLocation: z.string().min(1, "HQ location is required"),
  currentTools: z.string().max(200, "Please limit to 200 characters").optional(),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms of use",
  }),
  agreeMarketing: z.boolean().refine((val) => val === true, {
    message: "You must agree to receive communications from Lead2Lease",
  }),
});

type DemoRequestFormData = z.infer<typeof demoRequestSchema>;

export default function BookDemo() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<DemoRequestFormData>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: {
      isCurrentCustomer: false,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      countryCode: "+962",
      company: "",
      unitsUnderManagement: "",
      managedOrOwned: "",
      hqLocation: "",
      currentTools: "",
      agreeTerms: false,
      agreeMarketing: false,
    },
    mode: "onChange",
  });

  async function onSubmit(values: DemoRequestFormData) {
    try {
      setIsLoading(true);
      await apiRequest("POST", "/api/demo-requests", values);
      setIsSubmitted(true);
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Unable to submit demo request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircle2 className="h-16 w-16 text-primary" data-testid="icon-success" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Your demo request has been submitted successfully. Our team will contact you shortly to schedule your personalized demo.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => setLocation("/")} data-testid="button-back-home">
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200/50 sticky top-0 bg-gray-50/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-2 hover:opacity-80" data-testid="link-home">
                <Building2 className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">Lead2Lease</span>
              </a>
            </Link>
            <Link href="/">
              <a data-testid="link-back-to-home">
                <Button variant="secondary" className="gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </a>
            </Link>
          </div>
        </div>
      </header>

      {/* Form Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header Section with Gradient */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-semibold">Book Your Demo</span>
            </div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
              Schedule a Demo
            </h1>
            <p className="text-lg text-gray-600">
              Choose your preferred way to book a demo with our team.
            </p>
          </div>
          
          <Card className="border border-gray-200 shadow-2xl bg-white">
            <CardContent className="pt-6">
              <Tabs defaultValue="calendar" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="calendar" className="gap-2" data-testid="tab-calendar">
                    <Clock className="h-4 w-4" />
                    Schedule Now
                  </TabsTrigger>
                  <TabsTrigger value="form" className="gap-2" data-testid="tab-form">
                    <Calendar className="h-4 w-4" />
                    Request Callback
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="calendar" className="mt-0">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Pick a time that works for you</h3>
                    <p className="text-muted-foreground text-sm">
                      Select a time slot from our calendar below and book your personalized demo instantly.
                    </p>
                  </div>
                  <CalendarBooking />
                </TabsContent>
                
                <TabsContent value="form" className="mt-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Current Customer Checkbox */}
                  <FormField
                    control={form.control}
                    name="isCurrentCustomer"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-current-customer"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>I'm a current customer</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name*</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-first-name" className="bg-gray-50 border-gray-300 text-gray-900" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name*</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-last-name" className="bg-gray-50 border-gray-300 text-gray-900" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email*</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" className="bg-gray-50 border-gray-300 text-gray-900" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone Number */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Phone Number*</FormLabel>
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
                                  <SelectTrigger className="w-32 bg-gray-50 border-gray-300 text-gray-900" data-testid="select-country-code">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="+962">🇯🇴 +962</SelectItem>
                                  <SelectItem value="+1">🇺🇸 +1</SelectItem>
                                  <SelectItem value="+44">🇬🇧 +44</SelectItem>
                                  <SelectItem value="+971">🇦🇪 +971</SelectItem>
                                  <SelectItem value="+966">🇸🇦 +966</SelectItem>
                                  <SelectItem value="+20">🇪🇬 +20</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <FormControl>
                            <Input {...field} placeholder="123456789" data-testid="input-phone" className="bg-gray-50 border-gray-300 text-gray-900" />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Company Name */}
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Your Company" data-testid="input-company-name" className="bg-gray-50 border-gray-300 text-gray-900" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Units Under Management */}
                  <FormField
                    control={form.control}
                    name="unitsUnderManagement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Units Under Management*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-units" className="bg-gray-50 border-gray-300 text-gray-900">
                              <SelectValue placeholder="Select units range" />
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

                  {/* Managed or Owned */}
                  <FormField
                    control={form.control}
                    name="managedOrOwned"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Managed or Owned*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-managed-owned" className="bg-gray-50 border-gray-300 text-gray-900">
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="managed">Managed</SelectItem>
                            <SelectItem value="owned">Owned</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* HQ Location */}
                  <FormField
                    control={form.control}
                    name="hqLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HQ Location*</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Your Company's HQ State" data-testid="input-hq-location" className="bg-gray-50 border-gray-300 text-gray-900" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Current Tools */}
                  <FormField
                    control={form.control}
                    name="currentTools"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tools Currently Using</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Yardi, Buildium, AppFolio" data-testid="input-current-tools" className="bg-gray-50 border-gray-300 text-gray-900" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Terms Checkbox */}
                  <FormField
                    control={form.control}
                    name="agreeTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-terms"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            You accept our Terms of Use. As part of the terms of use, you agree to receive communications from Lead2Lease.*
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Marketing Checkbox */}
                  <FormField
                    control={form.control}
                    name="agreeMarketing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-marketing"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to receive other communications from Lead2Lease.*
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Privacy Notice */}
                  <p className="text-sm text-muted-foreground">
                    By clicking submit below, you consent to allow Lead2Lease to store and process the personal information submitted above to provide you the content requested.
                  </p>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-submit"
                  >
                    {isLoading ? "Submitting..." : "Submit Demo Request"}
                  </Button>
                </form>
              </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
