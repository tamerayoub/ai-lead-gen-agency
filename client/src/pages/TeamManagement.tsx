import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, MoreVertical, Mail, Shield, Trash2, LogOut } from "lucide-react";
import { InviteMemberDialog } from "@/components/InviteMemberDialog";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Membership = {
  id: string;
  userId: string;
  orgId: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
};

const ROLE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "Admin", variant: "default" },
  property_manager: { label: "Property Manager", variant: "secondary" },
  leasing_agent: { label: "Leasing Agent", variant: "outline" },
  owner_portal: { label: "Owner Portal", variant: "outline" },
  owner: { label: "Owner", variant: "default" },
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Active", variant: "default" },
  pending: { label: "Pending", variant: "secondary" },
  suspended: { label: "Suspended", variant: "destructive" },
};

export default function TeamManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Membership | null>(null);
  const [memberToMakeOwner, setMemberToMakeOwner] = useState<Membership | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>("");
  const [orgNameConfirmation, setOrgNameConfirmation] = useState<string>("");

  // Get current user's organization and role for RBAC
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ['/api/organizations/current'],
  });

  // Get organization details to fetch name for confirmation
  const { data: orgDetails } = useQuery<{ id: string; name: string } | null>({
    queryKey: ['/api/organizations'],
    enabled: !!currentOrg?.orgId,
    select: (data: any) => {
      // Find the current org in the list
      if (!data || !Array.isArray(data)) return null;
      const org = data.find((o: any) => o.orgId === currentOrg?.orgId);
      return org ? { id: org.orgId, name: org.orgName } : null;
    },
  });

  const isAdmin = currentOrg?.role === 'admin';
  const isOwner = currentOrg?.role === 'owner';

  const { data: members = [], isLoading: loadingMembers } = useQuery<Membership[]>({
    queryKey: ["/api/team/members"],
  });

  const { data: invitations = [], isLoading: loadingInvitations } = useQuery<Invitation[]>({
    queryKey: ["/api/team/invitations"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiRequest("PATCH", `/api/team/members/${userId}/role`, { role }),
    onSuccess: () => {
      toast({ title: "Role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest("DELETE", `/api/team/invitations/${invitationId}`),
    onSuccess: () => {
      toast({ title: "Invitation revoked successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team/invitations"] });
    },
    onError: () => {
      toast({ title: "Failed to revoke invitation", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("DELETE", `/api/team/members/${userId}`),
    onSuccess: () => {
      toast({ title: "Member removed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to remove member", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const leaveOrganizationMutation = useMutation({
    mutationFn: (newOwnerId?: string) =>
      apiRequest("POST", "/api/team/leave", newOwnerId ? { newOwnerId } : {}).then(res => res.json()),
    onSuccess: (data) => {
      console.log('[Team Management] Leave organization success:', data);
      
      if (data.wasOnlyMember && data.organizationDeleted) {
        // Organization has been permanently deleted immediately
        let message = "You have successfully left the organization. ";
        if (data.permanentlyDeleted) {
          message += "The organization has been permanently deleted immediately and your subscription has been cancelled immediately.";
        } else {
          message += "The organization has been permanently deleted immediately. ";
          if (data.subscriptionPeriodEnd) {
            const periodEndDate = new Date(data.subscriptionPeriodEnd);
            const formattedDate = periodEndDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            message += `Your membership will remain active until the end of your billing period (${formattedDate}).`;
          } else {
            message += "Your subscription has been cancelled immediately.";
          }
        }
        toast({ 
          title: "Left organization", 
          description: message,
          duration: 10000,
        });
      } else {
        toast({ 
          title: "Left organization", 
          description: "You have successfully left the organization"
        });
      }
      
      // Clear all cached queries to ensure fresh data
      console.log('[Team Management] Clearing all cached queries');
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.removeQueries({ queryKey: ["/api/organizations/current"] });
      queryClient.removeQueries({ queryKey: ["/api/organizations"] });
      
      setShowLeaveDialog(false);
      setSelectedNewOwner("");
      setOrgNameConfirmation("");
      
      // Add a small delay to ensure backend operations complete
      setTimeout(() => {
        // If user has other orgs, switch to one of them and stay in the app
        if (data.hasOtherOrgs && data.switchedToOrgId) {
          console.log('[Team Management] User has other orgs, reloading page');
          // Backend has already switched the user's currentOrgId, just reload to refresh context
          window.location.href = "/app";
        } else if (!data.hasOtherOrgs) {
          console.log('[Team Management] User has no other orgs, redirecting to landing page');
          // No other orgs - redirect to landing page and clear any cached auth state
          window.location.href = "/";
        } else {
          console.log('[Team Management] Fallback: reloading page');
          // Fallback: reload to refresh context
          window.location.href = "/app";
        }
      }, 500); // 500ms delay to ensure backend operations complete
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to leave organization", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold" data-testid="text-team-title">Team Management</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm md:text-base">
            Manage your organization members and invitations
          </p>
        </div>
        {(isOwner || isAdmin) && (
          <Button 
            onClick={() => setInviteDialogOpen(true)} 
            data-testid="button-invite-member"
            className="w-full sm:w-auto text-sm sm:text-base"
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:gap-6">
        {/* Active Members */}
        <Card>
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">Team Members</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {members.length} member{members.length !== 1 ? "s" : ""} in your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {loadingMembers ? (
              <div className="flex justify-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No team members yet
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id} data-testid={`row-member-${member.userId}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={member.user.avatarUrl} />
                                <AvatarFallback>
                                  {getInitials(member.user.fullName, member.user.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium" data-testid={`text-member-name-${member.userId}`}>
                                  {member.user.fullName || "No name set"}
                                </div>
                                <div className="text-sm text-muted-foreground" data-testid={`text-member-email-${member.userId}`}>
                                  {member.user.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ROLE_LABELS[member.role]?.variant || "outline"} data-testid={`badge-role-${member.userId}`}>
                              {ROLE_LABELS[member.role]?.label || member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_LABELS[member.status]?.variant || "outline"} data-testid={`badge-status-${member.userId}`}>
                              {STATUS_LABELS[member.status]?.label || member.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(member.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {(isAdmin || isOwner) ? (
                              !(isAdmin && !isOwner && member.role === 'owner') ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-actions-${member.userId}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  
                                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                    Change Role
                                  </DropdownMenuLabel>
                                  {Object.entries(ROLE_LABELS)
                                    .filter(([role]) => {
                                      if (role === 'owner_portal') {
                                        return false;
                                      }
                                      if (role === 'owner' && !isOwner) {
                                        return false;
                                      }
                                      return true;
                                    })
                                    .map(([role, { label }]) => {
                                      const isChangingSelf = user?.id === member.userId;
                                      const isRemovingOwner = member.role === 'owner' && role !== 'owner';
                                      const isChangingOwnerRole = member.role === 'owner';
                                      const isChangingToAdmin = role === 'admin';
                                      const currentUserRole = currentOrg?.role;
                                      const ownerCount = members.filter(m => m.role === 'owner').length;
                                      
                                      const isDisabledByRole = isAdmin && !isOwner && isChangingOwnerRole;
                                      
                                      const isDisabledBySelfRoleChange = isChangingSelf && 
                                        isChangingToAdmin && 
                                        (currentUserRole === 'property_manager' || currentUserRole === 'leasing_agent');
                                      
                                      const isDisabled = member.role === role || 
                                        (isChangingSelf && isRemovingOwner && ownerCount <= 1) ||
                                        isDisabledByRole ||
                                        isDisabledBySelfRoleChange;
                                      
                                      return (
                                        <DropdownMenuItem
                                          key={role}
                                          onClick={() => {
                                            if (role === 'owner') {
                                              setMemberToMakeOwner(member);
                                            } else {
                                              updateRoleMutation.mutate({ userId: member.userId, role });
                                            }
                                          }}
                                          disabled={isDisabled}
                                          data-testid={`menuitem-role-${role}-${member.userId}`}
                                        >
                                          <Shield className="h-4 w-4 mr-2" />
                                          {label}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  
                                  <DropdownMenuSeparator />
                                  
                                  {user?.id !== member.userId && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setMemberToRemove(member)}
                                        className="text-destructive focus:text-destructive"
                                        disabled={member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1}
                                        data-testid={`menuitem-remove-${member.userId}`}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Remove Member
                                        {member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1 && (
                                          <span className="ml-2 text-xs">(Cannot remove only owner)</span>
                                        )}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {members.map((member) => (
                    <div 
                      key={member.id} 
                      className="border rounded-lg p-3 sm:p-4 space-y-2.5 sm:space-y-3"
                      data-testid={`row-member-${member.userId}`}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                            <AvatarImage src={member.user.avatarUrl} />
                            <AvatarFallback className="text-xs sm:text-sm">
                              {getInitials(member.user.fullName, member.user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm sm:text-base truncate" data-testid={`text-member-name-${member.userId}`}>
                              {member.user.fullName || "No name set"}
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate" data-testid={`text-member-email-${member.userId}`}>
                              {member.user.email}
                            </div>
                          </div>
                        </div>
                        {(isAdmin || isOwner) && !(isAdmin && !isOwner && member.role === 'owner') && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9" data-testid={`button-actions-${member.userId}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                Change Role
                              </DropdownMenuLabel>
                              {Object.entries(ROLE_LABELS)
                                .filter(([role]) => {
                                  if (role === 'owner_portal') {
                                    return false;
                                  }
                                  if (role === 'owner' && !isOwner) {
                                    return false;
                                  }
                                  return true;
                                })
                                .map(([role, { label }]) => {
                                  const isChangingSelf = user?.id === member.userId;
                                  const isRemovingOwner = member.role === 'owner' && role !== 'owner';
                                  const isChangingOwnerRole = member.role === 'owner';
                                  const isChangingToAdmin = role === 'admin';
                                  const currentUserRole = currentOrg?.role;
                                  const ownerCount = members.filter(m => m.role === 'owner').length;
                                  
                                  const isDisabledByRole = isAdmin && !isOwner && isChangingOwnerRole;
                                  
                                  const isDisabledBySelfRoleChange = isChangingSelf && 
                                    isChangingToAdmin && 
                                    (currentUserRole === 'property_manager' || currentUserRole === 'leasing_agent');
                                  
                                  const isDisabled = member.role === role || 
                                    (isChangingSelf && isRemovingOwner && ownerCount <= 1) ||
                                    isDisabledByRole ||
                                    isDisabledBySelfRoleChange;
                                  
                                  return (
                                    <DropdownMenuItem
                                      key={role}
                                      onClick={() => {
                                        if (role === 'owner') {
                                          setMemberToMakeOwner(member);
                                        } else {
                                          updateRoleMutation.mutate({ userId: member.userId, role });
                                        }
                                      }}
                                      disabled={isDisabled}
                                      data-testid={`menuitem-role-${role}-${member.userId}`}
                                    >
                                      <Shield className="h-4 w-4 mr-2" />
                                      {label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              
                              <DropdownMenuSeparator />
                              
                              {user?.id !== member.userId && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setMemberToRemove(member)}
                                    className="text-destructive focus:text-destructive"
                                    disabled={member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1}
                                    data-testid={`menuitem-remove-${member.userId}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove Member
                                    {member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1 && (
                                      <span className="ml-2 text-xs">(Cannot remove only owner)</span>
                                    )}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge variant={ROLE_LABELS[member.role]?.variant || "outline"} className="text-xs" data-testid={`badge-role-${member.userId}`}>
                          {ROLE_LABELS[member.role]?.label || member.role}
                        </Badge>
                        <Badge variant={STATUS_LABELS[member.status]?.variant || "outline"} className="text-xs" data-testid={`badge-status-${member.userId}`}>
                          {STATUS_LABELS[member.status]?.label || member.status}
                        </Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Joined {format(new Date(member.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card>
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl">Pending Invitations</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {invitations.filter(i => i.status === 'pending').length} pending invitation{invitations.filter(i => i.status === 'pending').length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {loadingInvitations ? (
              <div className="flex justify-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]"></div>
              </div>
            ) : invitations.filter(i => i.status === 'pending').length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No pending invitations
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations
                        .filter(i => i.status === 'pending')
                        .map((invitation) => (
                          <TableRow key={invitation.id} data-testid={`row-invitation-${invitation.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="font-medium" data-testid={`text-invitation-email-${invitation.id}`}>
                                  {invitation.email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={ROLE_LABELS[invitation.role]?.variant || "outline"} data-testid={`badge-invitation-role-${invitation.id}`}>
                                {ROLE_LABELS[invitation.role]?.label || invitation.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(invitation.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(invitation.expiresAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              {(isAdmin || isOwner) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                                  data-testid={`button-revoke-${invitation.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {invitations
                    .filter(i => i.status === 'pending')
                    .map((invitation) => (
                      <div 
                        key={invitation.id} 
                        className="border rounded-lg p-3 sm:p-4 space-y-2.5 sm:space-y-3"
                        data-testid={`row-invitation-${invitation.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 sm:gap-3">
                          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm sm:text-base truncate" data-testid={`text-invitation-email-${invitation.id}`}>
                                {invitation.email}
                              </div>
                            </div>
                          </div>
                          {(isAdmin || isOwner) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                              data-testid={`button-revoke-${invitation.id}`}
                              className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <Badge variant={ROLE_LABELS[invitation.role]?.variant || "outline"} className="text-xs" data-testid={`badge-invitation-role-${invitation.id}`}>
                            {ROLE_LABELS[invitation.role]?.label || invitation.role}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                          <div>Sent {format(new Date(invitation.createdAt), "MMM d, yyyy")}</div>
                          <div>Expires {format(new Date(invitation.expiresAt), "MMM d, yyyy")}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Leave Organization Section */}
        <Card className="border-destructive/20">
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-4">
            <CardTitle className="text-destructive text-lg sm:text-xl">Leave Organization</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Leave this organization and remove yourself from all team activities
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <Button
              variant="destructive"
              onClick={() => setShowLeaveDialog(true)}
              data-testid="button-leave-organization"
              className="w-full sm:w-auto text-sm sm:text-base"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave Organization
            </Button>
          </CardContent>
        </Card>
      </div>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent className="mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to remove{" "}
              <strong>{memberToRemove?.user.fullName || memberToRemove?.user.email}</strong> from the organization?
              This action cannot be undone and they will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={removeMemberMutation.isPending}
              data-testid="button-cancel-remove"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (memberToRemove) {
                  removeMemberMutation.mutate(memberToRemove.userId);
                  setMemberToRemove(null);
                }
              }}
              disabled={removeMemberMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Organization Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              Leave Organization
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 sm:space-y-4 text-sm">
              {members.length === 1 ? (
                <>
                  <p className="font-semibold">
                    You are the only member of this organization.
                  </p>
                  <p>
                    If you leave, your organization will be <strong>permanently deleted immediately</strong>. Your membership will be cancelled immediately and your subscription will end.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. All organization data will be permanently deleted immediately.
                  </p>
                  {orgDetails?.name && (
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="org-name-confirmation" className="text-sm font-medium">
                        To confirm, type your organization name: <strong>{orgDetails.name}</strong>
                      </Label>
                      <Input
                        id="org-name-confirmation"
                        type="text"
                        value={orgNameConfirmation}
                        onChange={(e) => setOrgNameConfirmation(e.target.value)}
                        placeholder={orgDetails.name}
                        disabled={leaveOrganizationMutation.isPending}
                        className="mt-1"
                      />
                    </div>
                  )}
                </>
              ) : isOwner && members.filter(m => m.role === 'owner').length <= 1 ? (
                <>
                  <p>
                    You are the only owner of this organization. You must transfer ownership to another member before leaving.
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select New Owner</label>
                    <Select value={selectedNewOwner} onValueChange={setSelectedNewOwner}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a member to transfer ownership to" />
                      </SelectTrigger>
                      <SelectContent>
                        {members
                          .filter(m => m.userId !== user?.id && m.role !== 'owner')
                          .map((member) => (
                            <SelectItem key={member.userId} value={member.userId}>
                              {member.user.fullName || member.user.email} ({ROLE_LABELS[member.role]?.label || member.role})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      After transferring ownership, you will be removed from the organization.
                    </p>
                  </div>
                </>
              ) : (
                <p>
                  Are you sure you want to leave this organization? You will lose access to all organization data and features immediately. This action cannot be undone.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={leaveOrganizationMutation.isPending}
              onClick={() => {
                setSelectedNewOwner("");
                setOrgNameConfirmation("");
                setShowLeaveDialog(false);
              }}
              data-testid="button-cancel-leave"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // If user is the only member, require organization name confirmation
                if (members.length === 1) {
                  if (!orgDetails?.name) {
                    toast({
                      title: "Error",
                      description: "Unable to load organization name. Please try again.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (orgNameConfirmation.trim() !== orgDetails.name.trim()) {
                    toast({
                      title: "Confirmation required",
                      description: `Please type your organization name exactly as shown: "${orgDetails.name}"`,
                      variant: "destructive",
                    });
                    return;
                  }
                  leaveOrganizationMutation.mutate();
                } else if (isOwner && members.filter(m => m.role === 'owner').length <= 1) {
                  // Only owner but there are other members - require transfer
                  if (!selectedNewOwner) {
                    toast({
                      title: "New owner required",
                      description: "Please select a member to transfer ownership to",
                      variant: "destructive",
                    });
                    return;
                  }
                  leaveOrganizationMutation.mutate(selectedNewOwner);
                } else {
                  // Not owner or multiple owners - allow leaving
                  leaveOrganizationMutation.mutate();
                }
              }}
              disabled={leaveOrganizationMutation.isPending || (members.length > 1 && isOwner && members.filter(m => m.role === 'owner').length <= 1 && !selectedNewOwner) || (members.length === 1 && orgNameConfirmation.trim() !== (orgDetails?.name || "").trim())}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-leave"
            >
              {leaveOrganizationMutation.isPending ? "Leaving..." : "Leave Organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Make Owner Confirmation Dialog */}
      <AlertDialog open={!!memberToMakeOwner} onOpenChange={(open) => !open && setMemberToMakeOwner(null)}>
        <AlertDialogContent className="mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
              Assign Owner Role
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to make{" "}
              <strong>{memberToMakeOwner?.user.fullName || memberToMakeOwner?.user.email}</strong> an owner?
              <br /><br />
              Owners have full control over the organization, including:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Managing billing and subscriptions</li>
                <li>Assigning owner roles to other members</li>
                <li>Deleting the organization</li>
                <li>All administrative functions</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={updateRoleMutation.isPending}
              data-testid="button-cancel-make-owner"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (memberToMakeOwner) {
                  updateRoleMutation.mutate({ userId: memberToMakeOwner.userId, role: 'owner' });
                  setMemberToMakeOwner(null);
                }
              }}
              disabled={updateRoleMutation.isPending}
              data-testid="button-confirm-make-owner"
            >
              {updateRoleMutation.isPending ? "Assigning..." : "Assign Owner Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
