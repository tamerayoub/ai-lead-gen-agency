import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  useRouter,
} from "wouter";
import { useBrowserLocation } from "wouter/use-browser-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useBackgroundGmailSync } from "@/hooks/useBackgroundGmailSync";
import { useNotificationToasts } from "@/hooks/useNotificationToasts";
import { useMembershipRevocationHandler } from "@/hooks/useMembershipRevocationHandler";
import { LeadSheetProvider } from "@/contexts/LeadSheetContext";
import { GlobalLeadDetailSheet } from "@/components/GlobalLeadDetailSheet";
import ProfileSetupDialog from "@/components/ProfileSetupDialog";
import { MembershipGuard } from "@/components/MembershipGuard";
import type { User } from "@shared/schema";

// Domain routing configuration
const APP_HOSTS_RAW = import.meta.env.VITE_APP_HOSTS || "app.lead2lease.ai";
const APP_HOSTS = APP_HOSTS_RAW.split(",")
  .map((h: string) => h.trim().toLowerCase())
  .filter(Boolean);
const LOCAL_DEV_HOSTS = ["localhost", "127.0.0.1"];
const APP_PATH = "/app";

// Log configuration at startup
console.log("[App Routing] Configuration:", {
  APP_HOSTS_RAW,
  APP_HOSTS,
  VITE_APP_HOSTS: import.meta.env.VITE_APP_HOSTS,
  currentHostname:
    typeof window !== "undefined"
      ? window.location.hostname.toLowerCase()
      : "server-side",
});

function isLocalDev(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  // Check for localhost, 127.0.0.1, or Replit dev URLs
  return (
    LOCAL_DEV_HOSTS.includes(hostname) ||
    hostname.endsWith(".replit.dev") ||
    hostname.endsWith(".repl.co") ||
    hostname.includes(".riker.replit.dev")
  );
}

function isAppHost(): boolean {
  // Get hostname without port
  const fullHost = window.location.host.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();
  
  // Check if hostname matches any app host
  const isApp = APP_HOSTS.some((appHost: string) => {
    // Exact match
    if (hostname === appHost) return true;
    // Match without port (in case hostname includes port)
    if (hostname.split(":")[0] === appHost) return true;
    // Match if hostname ends with app host (for subdomains)
    if (hostname.endsWith("." + appHost) || hostname === appHost) return true;
    return false;
  });
  
  // Debug logging
  console.log("[App Routing] Hostname check:", {
    fullHost,
    hostname,
    protocol: window.location.protocol,
    href: window.location.href,
    APP_HOSTS,
    isApp,
    VITE_APP_HOSTS: import.meta.env.VITE_APP_HOSTS,
  });
  
  return isApp;
}

function isAppPath(): boolean {
  return window.location.pathname.startsWith(APP_PATH);
}

function shouldShowApp(): boolean {
  const isLocal = isLocalDev();
  const isApp = isAppHost();
  const isPath = isAppPath();
  
  let shouldShow = false;
  if (isLocal) {
    shouldShow = isPath;
  } else {
    shouldShow = isApp;
  }
  
  // Debug logging
  console.log("[App Routing] shouldShowApp:", {
    isLocal,
    isApp,
    isPath,
    shouldShow,
    hostname: window.location.hostname.toLowerCase(),
    pathname: window.location.pathname,
  });
  
  return shouldShow;
}

function getBasename(): string {
  if (isLocalDev() && isAppPath()) {
    return APP_PATH;
  }
  return "";
}
// (blueprint:javascript_log_in_with_replit) Import useAuth hook
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import LandingV2 from "@/pages/LandingV2";
import LandingV3 from "@/pages/LandingV3";
import LandingV4 from "@/pages/LandingV4";
import LandingV5 from "@/pages/LandingV5";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import BookDemo from "@/pages/BookDemo";
import OnboardingFlow from "@/pages/OnboardingFlow";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import LeadProfile from "@/pages/LeadProfile";
import Properties from "@/pages/Properties";
import PropertyEdit from "@/pages/PropertyEdit";
import UnitEdit from "@/pages/UnitEdit";
import Analytics from "@/pages/Analytics";
import AITraining from "@/pages/AITraining";
import AIAutoPilot from "@/pages/AIAutoPilot";
import AIActivityCenter from "@/pages/AIActivityCenter";
import Schedule from "@/pages/Schedule";
import Scheduling from "@/pages/Scheduling";
import Bookings from "@/pages/Bookings";
import AISuggestions from "@/pages/AISuggestions";
import { Schedules } from "@/pages/Schedules";
import Integrations from "@/pages/Integrations";
import ApiConnectorPage from "@/pages/ApiConnectorPage";
import DemoRequests from "@/pages/DemoRequests";
import OnboardingIntakes from "@/pages/OnboardingIntakes";
import SalesPipeline from "@/pages/SalesPipeline";
import Settings from "@/pages/Settings";
import AdminLogin from "@/pages/AdminLogin";
import AdminAnalytics from "@/pages/AdminAnalytics";
import Appointments from "@/pages/Appointments";
import PublicBooking from "@/pages/PublicBooking";
import PublicShowing from "@/pages/PublicShowing";
import TeamManagement from "@/pages/TeamManagement";
import AcceptInvitation from "@/pages/AcceptInvitation";
import Listings from "@/pages/Listings";
import PreQualification from "@/pages/PreQualification";
import Qualifications from "@/pages/Qualifications";
import FoundingPartnerCheckout from "@/pages/FoundingPartnerCheckout";
import FoundingPartnerSuccess from "@/pages/FoundingPartnerSuccess";
import FoundingPartnerOnboarding from "@/pages/FoundingPartnerOnboarding";
import Waitlist from "@/pages/Waitlist";
import ProductAIAgent from "@/pages/ProductAIAgent";
import AIMessages from "@/pages/AIMessages";
import ProductScheduling from "@/pages/ProductScheduling";
import ProductAICallingAgent from "@/pages/ProductAICallingAgent";
import ProductApplicationLeasing from "@/pages/ProductApplicationLeasing";
import Pricing from "@/pages/Pricing";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyNotice from "@/pages/PrivacyNotice";
import CookiesPolicy from "@/pages/CookiesPolicy";
import AIAgentSettings from "@/pages/AIAgentSettings";
import { AdminLayout } from "@/components/AdminLayout";
import NotFound from "@/pages/not-found";

function BackgroundSyncWrapper() {
  useBackgroundGmailSync();
  return null;
}

function Router() {
  // (blueprint:javascript_log_in_with_replit) Conditional routing based on auth status
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Check if we're on the app domain (app.lead2lease.ai or /app path in dev)
  // On app domain, unauthenticated users should see Login, not Landing
  const onAppDomain = shouldShowApp();

  // Public standalone pages that should be accessible even when authenticated (no sidebar)
  const publicStandaloneRoutes = [
    "/founding-partner-checkout",
    "/founding-partner-success",
    "/founding-partner-onboarding",
    "/onboarding",
    "/book-showing",
    "/showing",
    "/accept-invitation",
    "/product",
    "/login",
    "/register",
    "/waitlist",
    "/terms-of-service",
    "/privacy-notice",
    "/cookies-policy",
  ];
  const isPublicStandaloneRoute = publicStandaloneRoutes.some((route) =>
    location.startsWith(route)
  );

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show public routes for unauthenticated users OR public standalone routes (even when authenticated)
  if (!isAuthenticated || isPublicStandaloneRoute) {
    // On app domain (app.lead2lease.ai), show Login/Register pages for unauthenticated users
    // On marketing domain (lead2lease.ai or dev), show Landing page
    if (onAppDomain && !isAuthenticated && !isPublicStandaloneRoute) {
      console.log(
        "[Router] On app domain, unauthenticated user - showing Login/Register"
      );
      return (
        <Switch>
          <Route path="/waitlist" component={Waitlist} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/book-showing/unit/:unitId" component={PublicBooking} />
          <Route
            path="/book-showing/property/:propertyId"
            component={PublicBooking}
          />
          <Route path="/showing/:showingId" component={PublicShowing} />
          <Route
            path="/accept-invitation/:token"
            component={AcceptInvitation}
          />
          <Route
            path="/founding-partner-checkout"
            component={FoundingPartnerCheckout}
          />
          <Route
            path="/founding-partner-success"
            component={FoundingPartnerSuccess}
          />
          <Route
            path="/founding-partner-onboarding"
            component={FoundingPartnerOnboarding}
          />
          <Route component={Login} />{" "}
          {/* Catch-all: redirect to login on app domain */}
        </Switch>
      );
    }
    
    // Marketing domain - show full marketing routes
    return (
      <Switch>
        <Route path="/" component={LandingV5} />
        <Route path="/landing" component={LandingV5} />
        <Route path="/fb-integration" component={LandingV5} />
        <Route path="/landing-v1" component={Landing} />
        <Route path="/landing-v2" component={LandingV2} />
        <Route path="/landing-v3" component={LandingV3} />
        <Route path="/fb-ai-leasing-agent" component={LandingV4} />
        <Route path="/login" component={Login} />
        <Route path="/product/ai-leasing-agent" component={ProductAIAgent} />
        <Route path="/product/scheduling" component={ProductScheduling} />
        <Route
          path="/product/ai-calling-agent"
          component={ProductAICallingAgent}
        />
        <Route
          path="/product/application-leasing"
          component={ProductApplicationLeasing}
        />
        <Route path="/pricing" component={Pricing} />
        <Route path="/register" component={Register} />
        <Route path="/waitlist" component={Waitlist} />
        <Route path="/book-demo" component={BookDemo} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/privacy-notice" component={PrivacyNotice} />
        <Route path="/cookies-policy" component={CookiesPolicy} />
        <Route path="/onboarding" component={OnboardingFlow} />
        <Route path="/book-showing/unit/:unitId" component={PublicBooking} />
        <Route
          path="/book-showing/property/:propertyId"
          component={PublicBooking}
        />{" "}
        {/* Legacy support */}
        <Route path="/showing/:showingId" component={PublicShowing} />
        <Route path="/accept-invitation/:token" component={AcceptInvitation} />
        <Route
          path="/founding-partner-checkout"
          component={FoundingPartnerCheckout}
        />
        <Route
          path="/founding-partner-success"
          component={FoundingPartnerSuccess}
        />
        <Route
          path="/founding-partner-onboarding"
          component={FoundingPartnerOnboarding}
        />
        <Route path="/admin" component={AdminLogin} />
        <Route component={LandingV5} /> {/* Catch-all: redirect to landing */}
      </Switch>
    );
  }

  // Show authenticated routes for main app
  return (
    <Switch>
      <Route path="/landing" component={LandingV5} />
      <Route path="/fb-integration" component={LandingV5} />
      <Route path="/landing-v1" component={Landing} />
      <Route path="/landing-v2" component={LandingV2} />
      <Route path="/landing-v3" component={LandingV3} />
      <Route path="/fb-ai-leasing-agent" component={LandingV4} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/privacy-notice" component={PrivacyNotice} />
      <Route path="/cookies-policy" component={CookiesPolicy} />
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/leads/:leadId" component={LeadProfile} />
      <Route path="/properties" component={Properties} />
      <Route path="/properties/new" component={PropertyEdit} />
      {/* Unit routes - must come before /properties/:id routes to avoid route conflicts */}
      <Route path="/properties/:propertyId/units/new" component={UnitEdit} />
      <Route path="/units/:id/edit" component={UnitEdit} />
      {/* Property detail view - must come after unit routes */}
      <Route path="/properties/:id" component={Properties} />
      <Route path="/properties/:id/edit" component={PropertyEdit} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ai-training" component={AITraining} />
      <Route path="/ai-autopilot" component={AIAutoPilot} />
      <Route path="/ai-activity" component={AIActivityCenter} />
      <Route path="/ai/messages" component={AIMessages} />
      <Route path="/ai/settings" component={AIAgentSettings} />
      <Route path="/leasing/listings" component={Listings} />
      <Route path="/leasing/pre-qualification" component={PreQualification} />
      <Route path="/leasing/qualifications" component={Qualifications} />
      <Route path="/schedule/scheduling" component={Scheduling} />
      <Route path="/schedule/bookings" component={Bookings} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/ai-suggestions" component={AISuggestions} />
      <Route path="/schedules" component={Schedules} />
      <Route path="/integrations/api" component={ApiConnectorPage} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/settings" component={Settings} />
      <Route path="/team" component={TeamManagement} />
      <Route path="/accept-invitation/:token" component={AcceptInvitation} />
      <Route path="/waitlist" component={Waitlist} />
      <Route path="/book-showing/unit/:unitId" component={PublicBooking} />
      <Route
        path="/book-showing/property/:propertyId"
        component={PublicBooking}
      />{" "}
      {/* Legacy support */}
      <Route path="/showing/:showingId" component={PublicShowing} />{" "}
      {/* Public showing management page */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={SalesPipeline} />
        <Route path="/admin/pipeline" component={SalesPipeline} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/appointments" component={Appointments} />
        <Route path="/admin/demo-requests" component={DemoRequests} />
        <Route path="/admin/onboarding" component={OnboardingIntakes} />
        <Route path="/admin/users">
          {() => (
            <div className="p-6">
              <h1 className="text-2xl font-bold">Users Management</h1>
              <p className="text-muted-foreground mt-2">Coming soon...</p>
            </div>
          )}
        </Route>
        <Route path="/admin/settings">
          {() => (
            <div className="p-6">
              <h1 className="text-2xl font-bold">Admin Settings</h1>
              <p className="text-muted-foreground mt-2">Coming soon...</p>
            </div>
          )}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function useHashLocation(): [string, (to: string) => void] {
  const [location, setLocation] = useBrowserLocation();
  const basename = getBasename();
  
  const locationWithoutBase =
    basename && location.startsWith(basename)
    ? location.slice(basename.length) || "/" 
    : location;
  
  const navigate = (to: string) => {
    setLocation(basename + to);
  };
  
  return [locationWithoutBase, navigate];
}

function MarketingRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingV5} />
      <Route path="/landing" component={LandingV5} />
      <Route path="/fb-integration" component={LandingV5} />
      <Route path="/landing-v1" component={Landing} />
      <Route path="/landing-v2" component={LandingV2} />
      <Route path="/landing-v3" component={LandingV3} />
      <Route path="/fb-ai-leasing-agent" component={LandingV4} />
      <Route path="/login" component={Login} />
      <Route path="/product/ai-leasing-agent" component={ProductAIAgent} />
      <Route path="/product/scheduling" component={ProductScheduling} />
      <Route
        path="/product/ai-calling-agent"
        component={ProductAICallingAgent}
      />
      <Route
        path="/product/application-leasing"
        component={ProductApplicationLeasing}
      />
      <Route path="/pricing" component={Pricing} />
      <Route path="/register" component={Register} />
      <Route path="/waitlist" component={Waitlist} />
      <Route path="/book-demo" component={BookDemo} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/privacy-notice" component={PrivacyNotice} />
      <Route path="/cookies-policy" component={CookiesPolicy} />
      <Route path="/onboarding" component={OnboardingFlow} />
      <Route path="/book-showing/unit/:unitId" component={PublicBooking} />
      <Route
        path="/book-showing/property/:propertyId"
        component={PublicBooking}
      />
      <Route path="/showing/:showingId" component={PublicShowing} />
      <Route path="/accept-invitation/:token" component={AcceptInvitation} />
      <Route
        path="/founding-partner-checkout"
        component={FoundingPartnerCheckout}
      />
      <Route
        path="/founding-partner-success"
        component={FoundingPartnerSuccess}
      />
      <Route
        path="/founding-partner-onboarding"
        component={FoundingPartnerOnboarding}
      />
      <Route path="/admin" component={AdminLogin} />
      <Route component={LandingV5} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const showAppByHost = shouldShowApp();
  
  // Marketing pages (landing, login, register, etc.) should always be light mode
  // App pages (/app or app.lead2lease.ai) can use user's theme preference
  const themeConfig = showAppByHost 
    ? { defaultTheme: "dark" as const } 
    : { forcedTheme: "light" as const };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider {...themeConfig}>
        <TooltipProvider>
          <BackgroundSyncWrapper />
          <AppRouter style={style} showAppByHost={showAppByHost} />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Inner component that can use QueryClient hooks (like useAuth)
function AppRouter({
  style,
  showAppByHost,
}: {
  style: Record<string, string>;
  showAppByHost: boolean;
}) {
  const { isAuthenticated } = useAuth();
  
  // Fallback: If user is authenticated and hostname looks like app domain, show app
  const hostname =
    typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const isReplitDev = hostname.endsWith(".replit.dev") || hostname.endsWith(".repl.co") || hostname.includes(".riker.replit.dev");
  const looksLikeAppDomain =
    hostname.includes("app.lead2lease.ai") || hostname.startsWith("app.") || isReplitDev;
  const showApp = showAppByHost || (isAuthenticated && looksLikeAppDomain);
  
  // Debug logging
  console.log("[App Routing] AppRouter render:", {
    showAppByHost,
    isAuthenticated,
    looksLikeAppDomain,
    hostname,
    finalShowApp: showApp,
  });

  return (
    <WouterRouter hook={useHashLocation}>
      {showApp ? <LayoutRouter style={style} /> : <MarketingRouter />}
    </WouterRouter>
  );
}

// This component is inside the Router context and can use useLocation
function LayoutRouter({ style }: { style: Record<string, string> }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  
  // Check if current route is an admin route
  const isAdminRoute = location.startsWith("/admin");
  
  // Public standalone pages that should not have sidebar even when authenticated
  const publicStandaloneRoutes = [
    "/founding-partner-checkout",
    "/founding-partner-success",
    "/founding-partner-onboarding",
    "/onboarding",
    "/book-showing",
    "/showing",
    "/accept-invitation",
    "/pricing",
    "/login",
    "/register",
    "/waitlist",
    "/terms-of-service",
    "/privacy-notice",
    "/cookies-policy",
  ];
  const isPublicStandaloneRoute = publicStandaloneRoutes.some((route) =>
    location.startsWith(route)
  );

  // Show loading, unauthenticated routes, or public standalone routes (no sidebar)
  if (isLoading || !isAuthenticated || isPublicStandaloneRoute) {
    return <Router />;
  }

  // Show admin area for admin routes
  if (isAdminRoute) {
    return <AdminRouter />;
  }

  // Show full app with sidebar for authenticated users
  return (
    <LeadSheetProvider>
      <AuthenticatedApp style={style} />
    </LeadSheetProvider>
  );
}

function AuthenticatedApp({ style }: { style: Record<string, string> }) {
  // Show toast notifications for new unreplied messages
  useNotificationToasts();
  
  // Handle membership revocation detection
  useMembershipRevocationHandler();

  // Fetch current user to check profile completion
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Fetch all organizations to check if user has any
  const { data: organizations = [], isLoading: orgsLoading } = useQuery<
    Array<{
      orgId: string;
      orgName: string;
      role: string;
      deletedAt?: string | null;
    }>
  >({
    queryKey: ["/api/organizations"],
    enabled: !!user,
  });

  // Fetch current organization
  const {
    data: currentOrg,
    isLoading: currentOrgLoading,
    error: currentOrgError,
  } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
    enabled: !!user,
    retry: false, // Don't retry on 404
  });

  // Filter out deleted organizations
  const activeOrganizations = organizations.filter((org) => !org.deletedAt);

  // Auto-select organization or redirect to checkout
  useEffect(() => {
    if (!user || orgsLoading || currentOrgLoading) return;

    // If user has no active organizations, redirect to waitlist
    if (activeOrganizations.length === 0) {
      console.log(
        "[AuthenticatedApp] User has no organizations, redirecting to waitlist"
      );
      window.location.href = "/waitlist";
      return;
    }

    // Only platform admins (users.is_admin) can access the app - set manually in DB
    if (!user.isAdmin) {
      console.log(
        "[AuthenticatedApp] User is not a platform admin, redirecting to waitlist"
      );
      window.location.href = "/waitlist";
      return;
    }

    // If user has organizations but no currentOrg selected, auto-select the first one
    if (!currentOrg && activeOrganizations.length > 0) {
      const firstOrg = activeOrganizations[0];
      console.log(
        "[AuthenticatedApp] Auto-selecting first organization:",
        firstOrg.orgId
      );
      
      // Switch to the first organization
      fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId: firstOrg.orgId }),
      })
        .then((res) => res.json())
        .then(() => {
          // CRITICAL: Clear ALL cached queries before reloading
          // This ensures no data from previous org (if any) is shown
          queryClient.clear();
          // Reload to refresh with new org context
          window.location.reload();
        })
        .catch((error) => {
          console.error(
            "[AuthenticatedApp] Error switching organization:",
            error
          );
        });
    }
  }, [
    user,
    organizations,
    activeOrganizations.length,
    currentOrg,
    orgsLoading,
    currentOrgLoading,
  ]);

  // Profile setup dialog disabled - all users must complete onboarding questions before accessing the app
  const showProfileSetup = false;

  // Show loading state while checking organizations
  if (orgsLoading || currentOrgLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render app if redirecting (user has no orgs)
  if (activeOrganizations.length === 0) {
    return null;
  }

  // Only platform admins (users.is_admin) can access the app - block render for others (useEffect redirects to waitlist)
  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <MembershipGuard>
              <Router />
            </MembershipGuard>
          </main>
        </div>
        <GlobalLeadDetailSheet />
      </div>
      
      {/* Profile Setup Dialog - shown on first login */}
      {showProfileSetup && (
        <ProfileSetupDialog open={true} defaultEmail={user?.email ?? ""} />
      )}
    </SidebarProvider>
  );
}

export default App;
