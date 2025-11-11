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
import { Building2, Mail, User } from "lucide-react";
import { SiGoogle, SiFacebook, SiApple } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingToken, setOnboardingToken] = useState<string | null>(null);

  // Check for onboarding token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("onboardingToken");
    if (token) {
      setOnboardingToken(token);
    }
  }, []);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    try {
      setIsLoading(true);
      const payload = {
        ...values,
        ...(onboardingToken && { onboardingToken }),
      };
      const response = await apiRequest("POST", "/api/auth/register", payload);
      
      toast({
        title: "Account created!",
        description: "Welcome to Lead2Lease. Your account has been created successfully.",
      });
      
      // Refresh user data and redirect
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleOAuthRegister(provider: string) {
    let url = `/api/auth/${provider}`;
    if (onboardingToken) {
      url += `?onboardingToken=${onboardingToken}`;
    }
    window.location.href = url;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Building2 className="h-12 w-12 text-primary" data-testid="icon-logo" />
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="text-register-title">
            Create your account
          </CardTitle>
          <CardDescription data-testid="text-register-subtitle">
            Get started with Lead2Lease today
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth Providers */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleOAuthRegister("google")}
              data-testid="button-google-register"
              className="w-full"
            >
              <SiGoogle className="mr-2 h-4 w-4" />
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthRegister("facebook")}
              data-testid="button-facebook-register"
              className="w-full"
            >
              <SiFacebook className="mr-2 h-4 w-4" />
              Facebook
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthRegister("microsoft")}
              data-testid="button-microsoft-register"
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Microsoft
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthRegister("apple")}
              data-testid="button-apple-register"
              className="w-full"
            >
              <SiApple className="mr-2 h-4 w-4" />
              Apple
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or register with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="John"
                            {...field}
                            className="pl-10"
                            data-testid="input-first-name"
                          />
                        </div>
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
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          {...field}
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="name@example.com"
                          {...field}
                          className="pl-10"
                          data-testid="input-email"
                        />
                      </div>
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
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
                data-testid="button-register"
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login">
              <a className="text-primary hover:underline" data-testid="link-login">
                Sign in
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
