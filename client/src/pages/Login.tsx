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
import { Building2, Mail } from "lucide-react";
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

  // Check for OAuth error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      // Decode the error message (it's URL encoded)
      const decodedError = decodeURIComponent(error);
      
      toast({
        title: "Authentication failed",
        description: decodedError,
        variant: "destructive",
      });
      
      // Clear error from URL
      window.history.replaceState({}, "", "/login");
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
      const response = await apiRequest("POST", "/api/auth/login", values);
      
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      
      // Refresh user data and redirect
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
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
    window.location.href = `/api/auth/${provider}`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Building2 className="h-12 w-12 text-primary" data-testid="icon-logo" />
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="text-login-title">
            Welcome to LeadGenAI
          </CardTitle>
          <CardDescription data-testid="text-login-subtitle">
            Sign in to access your property management CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth Providers */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin("google")}
              data-testid="button-google-login"
              className="w-full"
            >
              <SiGoogle className="mr-2 h-4 w-4" />
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin("facebook")}
              data-testid="button-facebook-login"
              className="w-full"
            >
              <SiFacebook className="mr-2 h-4 w-4" />
              Facebook
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin("microsoft")}
              data-testid="button-microsoft-login"
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Microsoft
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin("apple")}
              data-testid="button-apple-login"
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
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register">
              <a className="text-primary hover:underline" data-testid="link-register">
                Create account
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
