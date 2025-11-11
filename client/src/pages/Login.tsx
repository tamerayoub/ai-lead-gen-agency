import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Building2, Mail, ArrowLeft } from "lucide-react";
import { SiGoogle, SiFacebook, SiApple } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);

  // Check for OAuth error and onboarding token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const token = params.get("onboardingToken");
    
    if (token) {
      setOnboardingToken(token);
    }
    
    if (error) {
      // Decode the error message (it's URL encoded)
      const decodedError = decodeURIComponent(error);
      
      toast({
        title: "Authentication failed",
        description: decodedError,
        variant: "destructive",
      });
      
      // Clear error from URL (but keep onboardingToken)
      const newUrl = token ? `/login?onboardingToken=${token}` : "/login";
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setIsLoading(true);
      const payload = {
        ...values,
        ...(onboardingToken && { onboardingToken }),
      };
      const response = await apiRequest("POST", "/api/auth/login", payload);
      
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      
      // Refresh user data and redirect
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Redirect admin users to admin area, regular users to main app
      if (response.isAdmin) {
        setLocation("/admin/demo-requests");
      } else {
        setLocation("/");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleOAuthLogin(provider: string) {
    let url = `/api/auth/${provider}`;
    if (onboardingToken) {
      url += `?onboardingToken=${onboardingToken}`;
    }
    window.location.href = url;
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
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-md">
          {/* Header Section with Gradient */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-lg text-gray-600">
              Sign in to access your automated property leasing software
            </p>
          </div>

          <Card className="border border-gray-200 shadow-2xl bg-white">
            <CardContent className="pt-8 space-y-4">
              {/* OAuth Providers */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("google")}
                  data-testid="button-google-login"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <SiGoogle className="mr-2 h-4 w-4 text-[#4285F4]" />
                  <span className="text-gray-900">Google</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("facebook")}
                  data-testid="button-facebook-login"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <SiFacebook className="mr-2 h-4 w-4 text-[#1877F2]" />
                  <span className="text-gray-900">Facebook</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("microsoft")}
                  data-testid="button-microsoft-login"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <Mail className="mr-2 h-4 w-4 text-[#00A4EF]" />
                  <span className="text-gray-900">Microsoft</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("apple")}
                  data-testid="button-apple-login"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <SiApple className="mr-2 h-4 w-4 text-gray-900" />
                  <span className="text-gray-900">Apple</span>
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              {/* Email/Password Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email*</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            {...field}
                            className="bg-gray-50 border-gray-300 text-gray-900"
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password*</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                            className="bg-gray-50 border-gray-300 text-gray-900"
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </Form>

              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
                  Create account
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
