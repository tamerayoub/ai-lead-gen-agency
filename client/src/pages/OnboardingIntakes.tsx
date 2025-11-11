import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

interface OnboardingIntake {
  id: string;
  sessionToken: string;
  status: string;
  unitsOwned: string | null;
  currentLeaseHandling: string | null;
  portfolioLocation: string | null;
  teamSize: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  wantsDemo: boolean | null;
  linkedUserId: string | null;
  userEmail?: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface SalesProspect {
  id: string;
  email: string;
  pipelineStage: string;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  discovery: { label: "Discovery", color: "bg-blue-500" },
  evaluation: { label: "Evaluation", color: "bg-blue-600" },
  probing: { label: "Probing", color: "bg-yellow-500" },
  offer: { label: "Offer", color: "bg-orange-500" },
  sale: { label: "Sale", color: "bg-green-500" },
  onboard: { label: "Onboard", color: "bg-teal-500" },
};

export default function OnboardingIntakes() {
  const { data: allIntakes, isLoading } = useQuery<OnboardingIntake[]>({
    queryKey: ["/api/onboarding-intakes"],
  });

  const { data: prospects } = useQuery<SalesProspect[]>({
    queryKey: ["/api/sales-prospects"],
  });

  // Filter to only show completed or linked submissions (no drafts/in-progress)
  const intakes = allIntakes?.filter((i) => i.status === "completed" || i.status === "linked") || [];

  const completedCount = allIntakes?.filter((i) => i.status === "completed").length || 0;
  const pendingCount = allIntakes?.filter((i) => i.status === "draft" || i.status === "in_progress").length || 0;
  const convertedCount = allIntakes?.filter((i) => i.linkedUserId).length || 0;

  // Helper function to get pipeline stage for an intake
  const getPipelineStage = (intake: OnboardingIntake): string | null => {
    if (!prospects || !intake.userEmail) return null;
    const normalizedEmail = intake.userEmail.trim().toLowerCase();
    const prospect = prospects.find(p => p.email.toLowerCase() === normalizedEmail);
    return prospect?.pipelineStage || null;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-onboarding-title">
          Onboarding Responses
        </h1>
        <p className="text-muted-foreground mt-2">
          View all prospects who have started or completed the onboarding questionnaire
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total">
              {allIntakes?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-completed">
              {completedCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-pending">
              {pendingCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Converted to Users</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="stat-converted">
              {convertedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Onboarding Submissions</CardTitle>
          <CardDescription>
            Detailed information about each prospect who has gone through the onboarding process
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]"></div>
            </div>
          ) : !intakes || intakes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No onboarding responses yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Pipeline Stage</TableHead>
                    <TableHead>User Account</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Units Owned</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Lease Management</TableHead>
                    <TableHead>Team Size</TableHead>
                    <TableHead>Demo Requested</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intakes.map((intake) => {
                    const pipelineStage = getPipelineStage(intake);
                    const stageInfo = pipelineStage ? STAGE_LABELS[pipelineStage] : null;
                    
                    return (
                    <TableRow key={intake.id} data-testid={`row-onboarding-${intake.id}`}>
                      <TableCell>
                        {intake.linkedUserId ? (
                          <Badge variant="default" data-testid={`badge-status-${intake.id}`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Converted
                          </Badge>
                        ) : intake.status === "completed" ? (
                          <Badge variant="secondary" data-testid={`badge-status-${intake.id}`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="outline" data-testid={`badge-status-${intake.id}`}>
                            <Clock className="w-3 h-3 mr-1" />
                            In Progress
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-pipeline-stage-${intake.id}`}>
                        {stageInfo ? (
                          <Badge className={`${stageInfo.color} text-white`}>
                            {stageInfo.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-user-email-${intake.id}`}>
                        {intake.userEmail ? (
                          <a href={`mailto:${intake.userEmail}`} className="text-primary hover:underline">
                            {intake.userEmail}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-name-${intake.id}`}>
                        {intake.fullName || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-phone-${intake.id}`}>
                        {intake.phoneNumber ? (
                          <a href={`tel:${intake.phoneNumber}`} className="text-primary hover:underline">
                            {intake.phoneNumber}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-units-${intake.id}`}>
                        {intake.unitsOwned || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-location-${intake.id}`}>
                        {intake.portfolioLocation || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-tool-${intake.id}`}>
                        {(() => {
                          if (!intake.currentLeaseHandling) return "—";
                          
                          const methodLabels: Record<string, string> = {
                            "manual": "Manual / Spreadsheets",
                            "property-management-software": "Property Management Software",
                            "property-manager": "Hire Property Manager",
                            "other": "Other"
                          };
                          
                          const method = methodLabels[intake.currentLeaseHandling] || intake.currentLeaseHandling;
                          
                          // If they specified a tool name, append it
                          if (intake.leaseHandlingToolName) {
                            return `${method}: ${intake.leaseHandlingToolName}`;
                          }
                          
                          return method;
                        })()}
                      </TableCell>
                      <TableCell data-testid={`text-team-${intake.id}`}>
                        {intake.teamSize || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-demo-${intake.id}`}>
                        {intake.wantsDemo === true ? (
                          <Badge variant="default">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Yes
                          </Badge>
                        ) : intake.wantsDemo === false ? (
                          <Badge variant="outline">
                            <XCircle className="w-3 h-3 mr-1" />
                            No
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-created-${intake.id}`}>
                        {intake.createdAt ? format(new Date(intake.createdAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-completed-${intake.id}`}>
                        {intake.completedAt ? format(new Date(intake.completedAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
