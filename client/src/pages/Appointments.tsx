import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Mail, Phone, Building2, User, CheckCircle2, XCircle, Ban } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Appointment } from "@shared/schema";

export default function Appointments() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/appointments/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Status Updated",
        description: "Appointment status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update appointment status.",
        variant: "destructive",
      });
    },
  });

  const filteredAppointments = appointments?.filter(apt => {
    if (filterStatus === "all") return true;
    return apt.status === filterStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
      scheduled: { variant: "default", icon: Clock },
      completed: { variant: "secondary", icon: CheckCircle2 },
      cancelled: { variant: "destructive", icon: XCircle },
      "no-show": { variant: "outline", icon: Ban },
    };

    const config = variants[status] || variants.scheduled;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1.5" data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const stats = {
    total: appointments?.length || 0,
    scheduled: appointments?.filter(a => a.status === 'scheduled').length || 0,
    completed: appointments?.filter(a => a.status === 'completed').length || 0,
    cancelled: appointments?.filter(a => a.status === 'cancelled').length || 0,
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-appointments">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Appointments</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Manage and track all scheduled demo appointments
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Appointments</CardDescription>
            <CardTitle className="text-3xl" data-testid="stat-total">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Scheduled</CardDescription>
            <CardTitle className="text-3xl text-primary" data-testid="stat-scheduled">
              {stats.scheduled}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-green-600" data-testid="stat-completed">
              {stats.completed}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Cancelled</CardDescription>
            <CardTitle className="text-3xl text-red-600" data-testid="stat-cancelled">
              {stats.cancelled}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle data-testid="text-appointments-list">Appointments List</CardTitle>
              <CardDescription data-testid="text-list-description">
                View and manage all appointment bookings
              </CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="filter-all">All Statuses</SelectItem>
                <SelectItem value="scheduled" data-testid="filter-scheduled">Scheduled</SelectItem>
                <SelectItem value="completed" data-testid="filter-completed">Completed</SelectItem>
                <SelectItem value="cancelled" data-testid="filter-cancelled">Cancelled</SelectItem>
                <SelectItem value="no-show" data-testid="filter-no-show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
              Loading appointments...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-appointments">
              No appointments found.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-date-time">Date & Time</TableHead>
                    <TableHead data-testid="header-contact">Contact Info</TableHead>
                    <TableHead data-testid="header-company">Company & Details</TableHead>
                    <TableHead data-testid="header-current-tools">Current Tools</TableHead>
                    <TableHead data-testid="header-notes">Notes</TableHead>
                    <TableHead data-testid="header-status">Status</TableHead>
                    <TableHead data-testid="header-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id} data-testid={`row-appointment-${appointment.id}`}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 font-medium">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-date-${appointment.id}`}>
                              {format(parseISO(appointment.appointmentDate), "MMM d, yyyy")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span data-testid={`text-time-${appointment.id}`}>
                              {formatTime(appointment.appointmentTime)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 font-medium">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span data-testid={`text-name-${appointment.id}`}>
                              {appointment.firstName} {appointment.lastName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span data-testid={`text-email-${appointment.id}`}>
                              {appointment.email}
                            </span>
                          </div>
                          {appointment.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span data-testid={`text-phone-${appointment.id}`}>
                                {appointment.phone}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {appointment.company && (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span data-testid={`text-company-${appointment.id}`}>
                                {appointment.company}
                              </span>
                            </div>
                          )}
                          {appointment.unitsUnderManagement && (
                            <div className="text-muted-foreground">
                              {appointment.unitsUnderManagement} units
                            </div>
                          )}
                          {!appointment.company && !appointment.unitsUnderManagement && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-[200px] truncate" title={appointment.currentTools}>
                          {appointment.currentTools || <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {appointment.notes ? (
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-notes-${appointment.id}`}>
                              {appointment.notes}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(appointment.status)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={appointment.status}
                          onValueChange={(status) => updateStatus.mutate({ id: appointment.id, status })}
                          disabled={updateStatus.isPending}
                        >
                          <SelectTrigger className="w-[140px]" data-testid={`select-status-${appointment.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="no-show">No Show</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
