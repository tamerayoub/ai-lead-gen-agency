import { LayoutDashboard, Users, Building2, Settings, Bot, BarChart3, Activity, Calendar, LogOut, ChevronDown, Plus, Check, Plug, Sparkles, ChevronRight, FileText, ClipboardCheck, Lock, Rocket, RotateCcw } from "lucide-react";
import logo from "@/assets/lead2lease-logo-white.svg";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import ProfileEditDialog from "@/components/ProfileEditDialog";
import OrganizationEditDialog from "@/components/OrganizationEditDialog";
import { FoundingMemberBadge } from "@/components/FoundingMemberBadge";

const ALLOWED_ROUTES_WITHOUT_MEMBERSHIP = ['/settings', '/team', '/'];

type MenuItem = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  url?: string;
  subItems?: Array<{ title: string; url: string }>;
};

const menuItems: MenuItem[] = [
  { title: "Countdown", url: "/", icon: Rocket },
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Portfolio", url: "/properties", icon: Building2 },
  { 
    title: "Leasing", 
    icon: FileText,
    subItems: [
      { title: "Listings", url: "/leasing/listings" },
      { title: "Qualification Requirement", url: "/leasing/qualifications" }
    ]
  },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "AI Training", url: "/ai-training", icon: Bot },
  { title: "AI Activity", url: "/ai-activity", icon: Activity },
  { 
    title: "Schedule", 
    icon: Calendar,
    subItems: [
      { title: "Scheduling", url: "/schedule/scheduling" },
      { title: "Bookings", url: "/schedule/bookings" },
      { title: "Calendar", url: "/schedule" },
      { title: "Pre-Showing Qualification", url: "/leasing/pre-qualification" }
    ]
  },
  { title: "AI Suggestions", url: "/ai-suggestions", icon: Sparkles },
  { title: "Schedules", url: "/schedules", icon: Calendar },
  { title: "Integrations", url: "/integrations", icon: Plug },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isFoundingPartner, isCancelled, currentPeriodEnd, refetch: refetchMembership, isLoading: membershipLoading, status: membershipStatus } = useMembership();
  
  // Check if organization has a membership (active, cancelled but not expired, or past_due)
  const hasMembership = membershipStatus === 'active' || membershipStatus === 'cancelled' || membershipStatus === 'past_due';
  
  // Debug logging
  useEffect(() => {
    console.log('[AppSidebar] Membership status:', { isFoundingPartner, membershipStatus, hasMembership, membershipLoading });
  }, [isFoundingPartner, membershipStatus, hasMembership, membershipLoading]);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isOrgEditOpen, setIsOrgEditOpen] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  const [manuallyOpenItems, setManuallyOpenItems] = useState<Set<string>>(new Set());

  const isMenuItemAllowed = (url?: string, title?: string) => {
    // Only Countdown, Settings, and Team are allowed
    if (title === "Countdown" || title === "Settings" || title === "Team") return true;
    // All other features are locked - show "coming soon"
    return false;
  };

  // Fetch current organization
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
    enabled: !!user,
  });
  
  // Refetch membership status on mount and when org changes to ensure it's up to date
  useEffect(() => {
    if (user && currentOrg) {
      // Small delay to ensure org context is set
      const timer = setTimeout(() => {
        refetchMembership();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, currentOrg?.orgId, refetchMembership]);
  
  // Also refetch when location changes (user navigates)
  useEffect(() => {
    if (user && currentOrg) {
      refetchMembership();
    }
  }, [location, user, currentOrg?.orgId, refetchMembership]);

  // Fetch all organizations (including deleted ones)
  const { data: organizations = [] } = useQuery<Array<{ orgId: string; orgName: string; role: string; profileImage?: string | null; deletedAt?: string | null }>>({
    queryKey: ["/api/organizations"],
    enabled: !!user,
  });

  // Fetch AI-suggested showings for pending count badge
  const { data: aiPending } = useQuery<any[]>({
    queryKey: ["/api/showings/ai-suggested"],
    staleTime: 30_000,
    enabled: !!user,
  });

  const pendingCount = aiPending?.length ?? 0;

  // Switch organization mutation
  const switchOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await apiRequest("POST", "/api/organizations/switch", { orgId });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
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

  // Reactivate organization mutation
  const reactivateOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await apiRequest("POST", `/api/organizations/${orgId}/restore`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      toast({
        title: "Organization reactivated",
        description: "Your organization has been successfully reactivated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reactivate organization",
        description: error.message || "An error occurred while reactivating the organization.",
        variant: "destructive",
      });
    },
  });

  // Helper function to check if org can be reactivated (within 30 days)
  const canReactivate = (deletedAt: string | null | undefined): boolean => {
    if (!deletedAt) return false;
    const deletedDate = new Date(deletedAt);
    const daysSinceDeletion = (Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceDeletion <= 30;
  };

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

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      // Return first letter of first name and first letter of last name, like organization previews
      return `${user.firstName.trim()[0]}${user.lastName.trim()[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName.trim()[0].toUpperCase();
    }
    if (user?.lastName) {
      return user.lastName.trim()[0].toUpperCase();
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
          <div className="flex flex-col items-center gap-2">
            <img 
              src={logo} 
              alt="Logo" 
              className="h-10 w-auto object-contain"
            />
            <p className="text-xs text-muted-foreground text-center">AI-Powered Automation Leasing Software</p>
          </div>
        </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const itemUrl = item.url || item.subItems?.[0]?.url;
                const isAllowed = isMenuItemAllowed(itemUrl, item.title);
                // Check if any subItem URL matches the current location for proper active state
                const isSubItemActive = item.subItems?.some(sub => location.startsWith(sub.url)) || false;
                const isGroupActive = item.subItems 
                  ? isSubItemActive || (item.url && location === item.url)
                  : location === item.url;
                
                if (item.subItems && item.subItems.length > 0) {
                  if (!isAllowed) {
                    // All features except settings and team are locked - show "coming soon"
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          disabled
                          className="opacity-70 cursor-not-allowed"
                          data-testid={`link-${item.title.toLowerCase()}-coming-soon`}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{item.title}</span>
                            <span className="text-xs text-muted-foreground ml-auto">Coming Soon</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  const isHovered = hoveredMenuItem === item.title;
                  const isManuallyOpen = manuallyOpenItems.has(item.title);
                  const shouldBeOpen = isSubItemActive || isHovered || isManuallyOpen;
                  
                  return (
                    <div
                      key={item.title}
                      onMouseEnter={() => setHoveredMenuItem(item.title)}
                      onMouseLeave={() => setHoveredMenuItem(null)}
                      onFocus={() => setManuallyOpenItems(prev => new Set(prev).add(item.title))}
                      onBlur={(e) => {
                        // Only close if focus is leaving the entire container
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setManuallyOpenItems(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(item.title);
                            return newSet;
                          });
                        }
                      }}
                    >
                      <Collapsible 
                        open={shouldBeOpen}
                        onOpenChange={(open) => {
                          setManuallyOpenItems(prev => {
                            const newSet = new Set(prev);
                            if (open) {
                              newSet.add(item.title);
                            } else {
                              newSet.delete(item.title);
                            }
                            return newSet;
                          });
                        }}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <div className="flex items-center gap-1 w-full">
                            {item.url ? (
                              <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase()}`} className="flex-1 min-w-0">
                                <Link href={item.url} className="flex items-center gap-2">
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            ) : (
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton isActive={isSubItemActive} data-testid={`link-${item.title.toLowerCase()}`} className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 w-full">
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{item.title}</span>
                                    <ChevronRight className="h-4 w-4 ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                  </div>
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                            )}
                            {item.url && (
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0"
                                  data-testid={`button-toggle-${item.title.toLowerCase()}`}
                                  aria-label={`Toggle ${item.title} submenu`}
                                >
                                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </div>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.subItems.map((subItem) => {
                                const isSubItemAllowed = isMenuItemAllowed(subItem.url);
                                if (!isSubItemAllowed) {
                                  // All features except settings and team are locked - show "coming soon"
                                  return (
                                    <SidebarMenuSubItem key={subItem.title}>
                                      <SidebarMenuSubButton 
                                        asChild={false}
                                        className="opacity-70 cursor-not-allowed"
                                        onClick={(e) => e.preventDefault()}
                                      >
                                        <div className="flex items-center gap-2 w-full">
                                          <span className="text-muted-foreground">{subItem.title}</span>
                                          <span className="text-xs text-muted-foreground ml-auto">Coming Soon</span>
                                        </div>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                }
                                return (
                                  <SidebarMenuSubItem key={subItem.title}>
                                    <SidebarMenuSubButton asChild isActive={location === subItem.url}>
                                      <Link href={subItem.url} data-testid={`link-${subItem.title.toLowerCase()}`}>
                                        <span>{subItem.title}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                );
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    </div>
                  );
                }
                
                if (!isAllowed) {
                  // All features except settings and team are locked - show "coming soon"
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        disabled
                        className="opacity-70 cursor-not-allowed"
                        data-testid={`link-${item.title.toLowerCase()}-coming-soon`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{item.title}</span>
                          <span className="text-xs text-muted-foreground ml-auto">Coming Soon</span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url}
                      className={item.title === "Countdown" ? "text-white hover:text-white hover:bg-white/10" : ""}
                    >
                      <Link href={item.url!} data-testid={`link-${item.title.toLowerCase()}`} className={`flex items-center gap-2 ${item.title === "Countdown" ? "text-white" : ""}`}>
                        <item.icon className={`h-4 w-4 ${item.title === "Countdown" ? "text-white" : ""}`} />
                        <span className={item.title === "Countdown" ? "text-white font-medium" : ""}>{item.title}</span>
                        {item.title === "AI Suggestions" && pendingCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="ml-auto"
                            data-testid="badge-ai-suggestions-pending"
                          >
                            {pendingCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(() => {
                    const currentOrgData = organizations.find(org => org.orgId === currentOrg?.orgId);
                    const orgInitials = currentOrgData?.orgName
                      ? currentOrgData.orgName.split(' ').map((word: string) => word[0]).join('').substring(0, 2).toUpperCase()
                      : 'PM';
                    return currentOrgData?.profileImage ? (
                      <Avatar className="h-5 w-5 flex-shrink-0">
                        <AvatarImage src={currentOrgData.profileImage} />
                        <AvatarFallback className="text-[10px]">{orgInitials}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-5 w-5 rounded bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold flex-shrink-0">
                        {orgInitials}
                      </div>
                    );
                  })()}
                  <span className="truncate">
                    {(() => {
                      const activeOrgs = organizations.filter(org => !org.deletedAt);
                      if (activeOrgs.length === 0) {
                        return "No Organization";
                      }
                      return activeOrgs.find(org => org.orgId === currentOrg?.orgId)?.orgName || activeOrgs[0]?.orgName || "Select Organization";
                    })()}
                  </span>
                  {isFoundingPartner && <FoundingMemberBadge size="sm" showText={false} />}
                </div>
                <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => {
                const orgInitials = org.orgName
                  ? org.orgName.split(' ').map((word: string) => word[0]).join('').substring(0, 2).toUpperCase()
                  : 'PM';
                const isDeleted = !!org.deletedAt;
                const canReactivateOrg = isDeleted && canReactivate(org.deletedAt);
                const isOwner = org.role === 'owner';
                
                return (
                  <DropdownMenuItem
                    key={org.orgId}
                    onClick={() => {
                      if (!isDeleted && org.orgId !== currentOrg?.orgId) {
                        switchOrgMutation.mutate(org.orgId);
                      }
                    }}
                    disabled={isDeleted && !canReactivateOrg}
                    data-testid={`menu-item-org-${org.orgId}`}
                    className={isDeleted ? "opacity-60" : ""}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {org.profileImage ? (
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarImage src={org.profileImage} />
                            <AvatarFallback className="text-xs">{orgInitials}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
                            {orgInitials}
                          </div>
                        )}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="truncate">{org.orgName}</span>
                          {isDeleted && canReactivateOrg && isOwner && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                reactivateOrgMutation.mutate(org.orgId);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 transition-colors flex-shrink-0"
                              data-testid={`button-reactivate-org-${org.orgId}`}
                              title="Reactivate organization"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </div>
                      {!isDeleted && org.orgId === currentOrg?.orgId && (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              {/* Edit Organization - Only for owners and admins */}
              {(currentOrg?.role === 'owner' || currentOrg?.role === 'admin') && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentOrg?.orgId) {
                      setEditingOrgId(currentOrg.orgId);
                      setIsOrgEditOpen(true);
                    }
                  }}
                  disabled={!currentOrg?.orgId}
                  data-testid="menu-item-edit-org"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Organization
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* User Info - Clickable to edit profile */}
        <button
          onClick={() => setIsProfileEditOpen(true)}
          className="flex items-center gap-3 mb-3 w-full p-2 rounded-md hover-elevate active-elevate-2"
          data-testid="button-user-profile"
        >
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={user?.profileImageUrl && user.profileImageUrl.trim() ? user.profileImageUrl : undefined} />
            <AvatarFallback className="text-xs font-semibold text-black dark:text-white">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden text-left">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">{getUserName()}</p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">{user?.email}</p>
          </div>
        </button>

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
      
      {/* Profile Edit Dialog */}
      <ProfileEditDialog 
        open={isProfileEditOpen} 
        onOpenChange={setIsProfileEditOpen} 
      />
      
      {/* Organization Edit Dialog */}
      {editingOrgId && (
        <OrganizationEditDialog
          open={isOrgEditOpen}
          onOpenChange={(open) => {
            setIsOrgEditOpen(open);
            if (!open) {
              setEditingOrgId(null);
            }
          }}
          organizationId={editingOrgId}
        />
      )}
    </Sidebar>
  );
}
