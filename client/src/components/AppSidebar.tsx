import { LayoutDashboard, Users, Building2, Settings, Bot, BarChart3, Activity, Calendar, LogOut, ChevronDown, Plus, Check, Plug } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "AI Training", url: "/ai-training", icon: Bot },
  { title: "AI Activity", url: "/ai-activity", icon: Activity },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch current organization
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
    enabled: !!user,
  });

  // Fetch all organizations
  const { data: organizations = [] } = useQuery<Array<{ orgId: string; orgName: string; role: string }>>({
    queryKey: ["/api/organizations"],
    enabled: !!user,
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/organizations", { name });
      return await res.json();
    },
    onSuccess: async (data) => {
      // Switch to the new organization
      const switchRes = await apiRequest("POST", "/api/organizations/switch", { orgId: data.id });
      await switchRes.json();
      
      setNewOrgName("");
      setIsCreateDialogOpen(false);
      toast({
        title: "Organization created",
        description: `${data.name} has been created and activated.`,
      });
      // Reload the page to refresh all data with new org context
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    },
  });

  // Switch organization mutation
  const switchOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await apiRequest("POST", "/api/organizations/switch", { orgId });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      toast({
        title: "Organization switched",
        description: "Successfully switched to selected organization.",
      });
      // Reload the page to refresh all data with new org context
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch organization",
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      // Force a full page reload to clear all state and redirect to login
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      // Still redirect to login even if the API call fails
      window.location.href = "/login";
    }
  };

  const handleCreateOrg = () => {
    if (newOrgName.trim()) {
      createOrgMutation.mutate(newOrgName.trim());
    }
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    return user?.email || "User";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">LeaseLoopAI</h2>
            <p className="text-xs text-muted-foreground">Property CRM</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        {/* Organization Switcher */}
        <div className="mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-between gap-2"
                data-testid="button-org-switcher"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">
                    {organizations.find(org => org.orgId === currentOrg?.orgId)?.orgName || "Select Organization"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.orgId}
                  onClick={() => {
                    if (org.orgId !== currentOrg?.orgId) {
                      switchOrgMutation.mutate(org.orgId);
                    }
                  }}
                  data-testid={`menu-item-org-${org.orgId}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{org.orgName}</span>
                    {org.orgId === currentOrg?.orgId && (
                      <Check className="h-4 w-4" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault();
                      setIsCreateDialogOpen(true);
                    }}
                    data-testid="menu-item-create-org"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Organization
                  </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription>
                      Create a new organization to manage your properties and leads separately.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        placeholder="My Property Business"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        data-testid="input-org-name"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel-create-org"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateOrg}
                      disabled={!newOrgName.trim() || createOrgMutation.isPending}
                      data-testid="button-confirm-create-org"
                    >
                      {createOrgMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">{getUserName()}</p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">{user?.email}</p>
          </div>
        </div>

        {/* Logout Button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start gap-2" 
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
