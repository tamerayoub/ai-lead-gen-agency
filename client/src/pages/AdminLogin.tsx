import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Building2, Lock, Mail, ArrowLeft, Shield } from "lucide-react";
import { SiGoogle, SiFacebook, SiApple } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check for OAuth error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      const decodedError = decodeURIComponent(error);
      
      toast({
        title: "Authentication failed",
        description: decodedError,
        variant: "destructive",
      });
      
      // Clear error from URL
      window.history.replaceState({}, "", "/admin");
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        // Check if user has admin privileges
        if (data.user?.isAdmin) {
          setLocation("/admin/demo-requests");
        } else {
          toast({
            title: "Access Denied",
            description: "You do not have admin privileges.",
            variant: "destructive",
          });
        }
      } else {
        const error = await res.json();
        toast({
          title: "Login failed",
          description: error.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  function handleOAuthLogin(provider: string) {
    // Redirect to OAuth provider with admin callback
    window.location.href = `/api/auth/${provider}?redirect=/admin/demo-requests`;
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-semibold">Admin Access</span>
            </div>
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent">
              Admin Portal
            </h1>
            <p className="text-lg text-gray-600">
              Sign in to access the admin dashboard
            </p>
          </div>

          <Card className="border border-gray-200 shadow-2xl bg-white">
            <CardContent className="pt-8 space-y-4">
              {/* OAuth Providers */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("google")}
                  data-testid="button-google-admin-login"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <SiGoogle className="mr-2 h-4 w-4 text-[#4285F4]" />
                  <span className="text-gray-900">Google</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("facebook")}
                  data-testid="button-facebook-admin-login"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <SiFacebook className="mr-2 h-4 w-4 text-[#1877F2]" />
                  <span className="text-gray-900">Facebook</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("microsoft")}
                  data-testid="button-microsoft-admin-login"
                  className="w-full border-gray-300 hover:bg-gray-50"
                >
                  <Mail className="mr-2 h-4 w-4 text-[#00A4EF]" />
                  <span className="text-gray-900">Microsoft</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin("apple")}
                  data-testid="button-apple-admin-login"
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
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-900">Email*</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@lead2lease.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-gray-50 border-gray-300 text-gray-900"
                    data-testid="input-admin-email"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-900">Password*</label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-gray-50 border-gray-300 text-gray-900"
                    data-testid="input-admin-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-admin-login"
                >
                  {isLoading ? (
                    "Signing in..."
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
