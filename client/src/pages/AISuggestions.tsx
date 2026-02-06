import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Clock, MapPin, Calendar, Navigation, RefreshCw } from "lucide-react";
import { format, parse } from "date-fns";
import type { Showing, Property, Lead } from "@shared/schema";
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
import { useState } from "react";

interface RouteOptimizationData {
  previousShowingId?: string;
  nextShowingId?: string;
  distanceFromPrevious?: number;
  distanceToNext?: number;
  travelTimeFromPrevious?: number;
  travelTimeToNext?: number;
  optimizationScore?: number;
}

interface ShowingWithDetails extends Showing {
  property?: Property;
  lead?: Lead;
  routeOptimizationData?: RouteOptimizationData | null;
  conflictFlags?: string[] | null;
  aiSuggestionScore?: number | null;
  aiSuggestionReason?: string | null;
}

export default function AISuggestions() {
  const { toast } = useToast();
  const [showingToApprove, setShowingToApprove] = useState<string | null>(null);
  const [showingToReject, setShowingToReject] = useState<string | null>(null);

  const { data: aiSuggestions, isLoading, error, refetch } = useQuery<ShowingWithDetails[]>({
    queryKey: ["/api/showings/ai-suggested"],
  });

  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const approveMutation = useMutation({
    mutationFn: async (showingId: string) => {
      return apiRequest("POST", `/api/showings/${showingId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/showings/ai-suggested"] });
      queryClient.invalidateQueries({ queryKey: ["/api/showings"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === "/api/showings"
      });
      setShowingToApprove(null);
      toast({
        title: "Showing approved",
        description: "The AI-suggested showing has been approved and added to your schedule.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to approve showing",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (showingId: string) => {
      return apiRequest("POST", `/api/showings/${showingId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/showings/ai-suggested"] });
      queryClient.invalidateQueries({ queryKey: ["/api/showings"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === "/api/showings"
      });
      setShowingToReject(null);
      toast({
        title: "Showing rejected",
        description: "The AI-suggested showing has been rejected and removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reject showing",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (showingId: string) => {
    setShowingToApprove(showingId);
  };

  const handleReject = (showingId: string) => {
    setShowingToReject(showingId);
  };

  const confirmApprove = () => {
    if (showingToApprove) {
      approveMutation.mutate(showingToApprove);
    }
  };

  const confirmReject = () => {
    if (showingToReject) {
      rejectMutation.mutate(showingToReject);
    }
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties?.find(p => p.id === propertyId);
    return property?.name || property?.address || "Unknown Property";
  };

  const getLeadName = (leadId: string) => {
    const lead = leads?.find(l => l.id === leadId);
    return lead?.name || lead?.email || lead?.phoneNumber || "Unknown Lead";
  };

  const getScoreBadgeVariant = (score: number | null | undefined) => {
    if (!score) return "secondary";
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "outline";
  };

  const suggestions = aiSuggestions ?? [];
  const hasData = !isLoading && !error;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-ai-suggestions">AI Scheduling Suggestions</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve AI-suggested property showings
          </p>
        </div>
        {hasData && suggestions.length > 0 && (
          <Badge variant="secondary" data-testid="badge-suggestion-count">
            {suggestions.length} pending
          </Badge>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-error-heading">Failed to load AI suggestions</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {error instanceof Error ? error.message : "An unexpected error occurred while loading AI suggestions."}
            </p>
            <Button onClick={() => refetch()} variant="outline" data-testid="button-retry">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-ai-suggestions" />
            <p className="text-sm text-muted-foreground mt-4">Loading AI suggestions...</p>
          </CardContent>
        </Card>
      )}

      {hasData && suggestions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-suggestions">No pending AI suggestions</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              All AI-suggested showings have been reviewed. New suggestions will appear here when the AI identifies optimal scheduling opportunities.
            </p>
          </CardContent>
        </Card>
      )}

      {hasData && suggestions.length > 0 && (
        <div className="grid gap-4" data-testid="list-ai-suggestions">
          {suggestions.map((showing) => {
            const showingDateTime = parse(
              `${showing.scheduledDate} ${showing.scheduledTime}`,
              'yyyy-MM-dd HH:mm',
              new Date()
            );
            const routeData = showing.routeOptimizationData as RouteOptimizationData | null;

            return (
              <Card key={showing.id} data-testid={`card-suggestion-${showing.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-xl">{showing.title}</CardTitle>
                        {showing.aiSuggestionScore && (
                          <Badge variant={getScoreBadgeVariant(showing.aiSuggestionScore)} data-testid={`badge-score-${showing.id}`}>
                            {showing.aiSuggestionScore}% confidence
                          </Badge>
                        )}
                      </div>
                      {showing.aiSuggestionReason && (
                        <CardDescription data-testid={`text-reason-${showing.id}`}>
                          {showing.aiSuggestionReason}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprove(showing.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-approve-${showing.id}`}
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(showing.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-reject-${showing.id}`}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Date & Time:</span>
                        <span data-testid={`text-datetime-${showing.id}`}>
                          {format(showingDateTime, 'MMM d, yyyy • h:mm a')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Property:</span>
                        <span data-testid={`text-property-${showing.id}`}>
                          {getPropertyName(showing.propertyId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Duration:</span>
                        <span>{showing.durationMinutes} minutes</span>
                      </div>
                    </div>

                    {routeData && (routeData.optimizationScore !== undefined || routeData.distanceFromPrevious || routeData.distanceToNext) && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Navigation className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Route Optimization:</span>
                          {routeData.optimizationScore !== undefined && (
                            <Badge variant={routeData.optimizationScore >= 70 ? "default" : "secondary"} data-testid={`badge-route-score-${showing.id}`}>
                              {routeData.optimizationScore}% efficient
                            </Badge>
                          )}
                        </div>
                        {routeData.distanceFromPrevious !== undefined && routeData.travelTimeFromPrevious !== undefined && (
                          <div className="text-sm text-muted-foreground pl-6">
                            From previous: {routeData.distanceFromPrevious.toFixed(1)} mi ({routeData.travelTimeFromPrevious} min)
                          </div>
                        )}
                        {routeData.distanceToNext !== undefined && routeData.travelTimeToNext !== undefined && (
                          <div className="text-sm text-muted-foreground pl-6">
                            To next: {routeData.distanceToNext.toFixed(1)} mi ({routeData.travelTimeToNext} min)
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {showing.description && (
                    <div className="text-sm">
                      <span className="font-medium">Notes:</span> {showing.description}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!showingToApprove} onOpenChange={(open) => !open && setShowingToApprove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve AI Suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add the showing to your schedule with "approved" status. You can still modify or cancel it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-approve">Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button 
                onClick={confirmApprove} 
                disabled={approveMutation.isPending || rejectMutation.isPending}
                data-testid="button-confirm-approve"
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve Showing"
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!showingToReject} onOpenChange={(open) => !open && setShowingToReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject AI Suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this AI-suggested showing. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reject">Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button 
                onClick={confirmReject} 
                variant="destructive"
                disabled={approveMutation.isPending || rejectMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  "Reject Showing"
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
