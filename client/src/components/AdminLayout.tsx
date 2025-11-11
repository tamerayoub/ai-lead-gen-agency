import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/admin");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check if user is admin
  if (!user.isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Alert className="max-w-md" variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription className="mt-2">
            You do not have administrator privileges to access this area.
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-return-home"
              >
                Return to Dashboard
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b">
            <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
