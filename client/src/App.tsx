import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { useBackgroundGmailSync } from "@/hooks/useBackgroundGmailSync";
import { useNotificationToasts } from "@/hooks/useNotificationToasts";
import { LeadSheetProvider } from "@/contexts/LeadSheetContext";
import { GlobalLeadDetailSheet } from "@/components/GlobalLeadDetailSheet";
// (blueprint:javascript_log_in_with_replit) Import useAuth hook
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import BookDemo from "@/pages/BookDemo";
import OnboardingFlow from "@/pages/OnboardingFlow";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import Properties from "@/pages/Properties";
import Analytics from "@/pages/Analytics";
import AITraining from "@/pages/AITraining";
import AIActivityCenter from "@/pages/AIActivityCenter";
import Schedule from "@/pages/Schedule";
import Integrations from "@/pages/Integrations";
import DemoRequests from "@/pages/DemoRequests";
import OnboardingIntakes from "@/pages/OnboardingIntakes";
import SalesPipeline from "@/pages/SalesPipeline";
import Settings from "@/pages/Settings";
import AdminLogin from "@/pages/AdminLogin";
import AdminAnalytics from "@/pages/AdminAnalytics";
import Appointments from "@/pages/Appointments";
import { AdminLayout } from "@/components/AdminLayout";
import NotFound from "@/pages/not-found";

function BackgroundSyncWrapper() {
  useBackgroundGmailSync();
  return null;
}

function Router() {
  // (blueprint:javascript_log_in_with_replit) Conditional routing based on auth status
  const { isAuthenticated, isLoading } = useAuth();

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

  // Show public routes for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/book-demo" component={BookDemo} />
        <Route path="/onboarding" component={OnboardingFlow} />
        <Route path="/admin" component={AdminLogin} />
        <Route component={Landing} /> {/* Catch-all: redirect to landing */}
      </Switch>
    );
  }

  // Show authenticated routes for main app
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/properties" component={Properties} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ai-training" component={AITraining} />
      <Route path="/ai-activity" component={AIActivityCenter} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/settings" component={Settings} />
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
          {() => <div className="p-6"><h1 className="text-2xl font-bold">Users Management</h1><p className="text-muted-foreground mt-2">Coming soon...</p></div>}
        </Route>
        <Route path="/admin/settings">
          {() => <div className="p-6"><h1 className="text-2xl font-bold">Admin Settings</h1><p className="text-muted-foreground mt-2">Coming soon...</p></div>}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <BackgroundSyncWrapper />
          <WouterRouter>
            <LayoutRouter style={style} />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// This component is inside the Router context and can use useLocation
function LayoutRouter({ style }: { style: Record<string, string> }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  
  // Check if current route is an admin route
  const isAdminRoute = location.startsWith('/admin');

  // Show loading or unauthenticated routes
  if (isLoading || !isAuthenticated) {
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
            <Router />
          </main>
        </div>
        <GlobalLeadDetailSheet />
      </div>
    </SidebarProvider>
  );
}

export default App;
