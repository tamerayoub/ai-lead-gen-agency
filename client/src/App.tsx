import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useBackgroundGmailSync } from "@/hooks/useBackgroundGmailSync";
// (blueprint:javascript_log_in_with_replit) Import useAuth hook
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Leads from "@/pages/Leads";
import Properties from "@/pages/Properties";
import Analytics from "@/pages/Analytics";
import AITraining from "@/pages/AITraining";
import AIActivityCenter from "@/pages/AIActivityCenter";
import Schedule from "@/pages/Schedule";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function BackgroundSyncWrapper() {
  useBackgroundGmailSync();
  return null;
}

function Router() {
  // (blueprint:javascript_log_in_with_replit) Conditional routing based on auth status
  const { isAuthenticated, isLoading } = useAuth();

  // Show public routes for unauthenticated users
  if (!isLoading && !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={Landing} /> {/* Catch-all: redirect to landing */}
      </Switch>
    );
  }

  // Show authenticated routes
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/properties" component={Properties} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ai-training" component={AITraining} />
      <Route path="/ai-activity" component={AIActivityCenter} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
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
          <AuthenticatedLayout style={style} />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedLayout({ style }: { style: Record<string, string> }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Show Landing page without sidebar for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return <Router />;
  }

  // Show full app with sidebar for authenticated users
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default App;
