import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, Phone, Building2, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

type DemoRequest = {
  id: number;
  isCurrentCustomer: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  company?: string;
  unitsUnderManagement: string;
  managedOrOwned: string;
  hqLocation: string;
  currentTools?: string;
  agreeTerms: boolean;
  agreeMarketing: boolean;
  createdAt: Date;
};

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

export default function DemoRequests() {
  const { data: requests, isLoading } = useQuery<DemoRequest[]>({
    queryKey: ["/api/demo-requests"],
  });

  const { data: prospects } = useQuery<SalesProspect[]>({
    queryKey: ["/api/sales-prospects"],
  });

  // Helper function to get pipeline stage for a demo request
  const getPipelineStage = (request: DemoRequest): string | null => {
    if (!prospects || !request.email) return null;
    const normalizedEmail = request.email.trim().toLowerCase();
    const prospect = prospects.find(p => p.email.toLowerCase() === normalizedEmail);
    return prospect?.pipelineStage || null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-muted-foreground">Loading demo requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Demo Requests</h1>
        <p className="text-muted-foreground mt-2">
          View and manage incoming demo requests from potential customers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-requests">
              {requests?.length ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Customers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-current-customers">
              {(requests?.filter(r => r.isCurrentCustomer) ?? []).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Prospects</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-new-prospects">
              {(requests?.filter(r => !r.isCurrentCustomer) ?? []).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Demo Requests</CardTitle>
          <CardDescription>
            Complete list of all demo requests submitted through the landing page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No demo requests yet.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Pipeline Stage</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Business Details</TableHead>
                    <TableHead>Current Tools</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Marketing</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const pipelineStage = getPipelineStage(request);
                    const stageInfo = pipelineStage ? STAGE_LABELS[pipelineStage] : null;
                    
                    return (
                    <TableRow key={request.id} data-testid={`row-demo-request-${request.id}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {request.firstName} {request.lastName}
                          </div>
                          {request.isCurrentCustomer && (
                            <Badge variant="secondary" className="text-xs">
                              Current Customer
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-pipeline-stage-${request.id}`}>
                        {stageInfo ? (
                          <Badge className={`${stageInfo.color} text-white`}>
                            {stageInfo.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <a 
                              href={`mailto:${request.email}`} 
                              className="text-primary hover:underline"
                              data-testid={`link-email-${request.id}`}
                            >
                              {request.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <a 
                              href={`tel:${request.countryCode}${request.phone}`}
                              className="text-primary hover:underline"
                              data-testid={`link-phone-${request.id}`}
                            >
                              {request.countryCode} {request.phone}
                            </a>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {request.company || <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="font-medium">{request.unitsUnderManagement}</span> units
                          </div>
                          <div className="text-muted-foreground capitalize">
                            {request.managedOrOwned}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[200px] truncate" title={request.currentTools}>
                          {request.currentTools || <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {request.hqLocation}
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.agreeMarketing ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Opted In
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Opted Out
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(request.createdAt), "MMM d, yyyy")}
                        </div>
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
