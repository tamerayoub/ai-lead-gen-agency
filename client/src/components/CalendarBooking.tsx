import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle2, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TimeSlot {
  time: string;
  label: string;
}

export function CalendarBooking() {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    unitsUnderManagement: "",
    teamSize: "",
    currentTools: "",
    notes: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // Fetch available time slots for selected date
  const dateParam = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const { data: availability, isLoading: isLoadingSlots } = useQuery({
    queryKey: [`/api/appointments/availability?date=${dateParam}`],
    enabled: !!selectedDate,
  });

  const createAppointment = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/appointments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/availability"] });
      setIsSubmitted(true);
      toast({
        title: "Appointment Booked!",
        description: "We'll send you a confirmation email shortly.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "This time slot may no longer be available.",
        variant: "destructive",
      });
    },
  });

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(undefined);
    setShowForm(false);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Missing Information",
        description: "Please select a date and time.",
        variant: "destructive",
      });
      return;
    }

    createAppointment.mutate({
      appointmentDate: format(selectedDate, "yyyy-MM-dd"),
      appointmentTime: selectedTime,
      ...formData,
    });
  };

  // Convert 24h time to 12h format with AM/PM
  const formatTimeSlot = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  if (isSubmitted) {
    return (
      <Card className="border-none shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-primary mb-4" data-testid="icon-success" />
          <h3 className="text-2xl font-semibold mb-2" data-testid="text-success-title">Appointment Confirmed!</h3>
          <p className="text-muted-foreground mb-1" data-testid="text-success-message">
            Your demo is scheduled for:
          </p>
          <p className="text-lg font-medium mb-4" data-testid="text-appointment-details">
            {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime && formatTimeSlot(selectedTime)}
          </p>
          <p className="text-sm text-muted-foreground max-w-md" data-testid="text-confirmation-note">
            We've sent a confirmation email to <strong>{formData.email}</strong> with calendar invite and meeting details.
          </p>
          <Button
            onClick={() => {
              setIsSubmitted(false);
              setSelectedDate(undefined);
              setSelectedTime(undefined);
              setShowForm(false);
              setFormData({
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                company: "",
                unitsUnderManagement: "",
                teamSize: "",
                currentTools: "",
                notes: "",
              });
            }}
            variant="outline"
            className="mt-6"
            data-testid="button-book-another"
          >
            Book Another Appointment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="container-calendar-booking">
      {/* Left Column: Calendar and Time Slots */}
      <div className="space-y-4">
        {/* Calendar */}
        <Card className="bg-background">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2" data-testid="text-select-date">
              <CalendarIcon className="h-5 w-5" />
              Select a Date
            </CardTitle>
            <CardDescription data-testid="text-calendar-description">
              Choose a day for your demo
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="rounded-md border bg-card p-1">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const maxDate = new Date(today);
                  maxDate.setDate(maxDate.getDate() + 60); // 60 days ahead
                  return date < today || date > maxDate;
                }}
                className="rounded-md"
                data-testid="calendar-date-picker"
              />
            </div>
          </CardContent>
        </Card>

        {/* Time Slots */}
        {selectedDate && (
          <Card className="bg-background">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2" data-testid="text-select-time">
                <Clock className="h-5 w-5" />
                Select a Time
              </CardTitle>
              <CardDescription data-testid="text-time-description">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSlots ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-loading-slots">
                  Loading available times...
                </div>
              ) : availability?.availableSlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-slots">
                  No available time slots for this date. Please select another day.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2" data-testid="container-time-slots">
                  {availability?.availableSlots.map((time: string) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => handleTimeSelect(time)}
                      className="w-full"
                      data-testid={`button-timeslot-${time.replace(':', '')}`}
                    >
                      {formatTimeSlot(time)}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column: Booking Form */}
      {showForm && selectedDate && selectedTime && (
        <Card className="bg-background">
          <CardHeader className="space-y-1">
            <CardTitle data-testid="text-your-information">Your Information</CardTitle>
            <CardDescription data-testid="text-form-description">
              Complete your booking details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-black dark:text-white" data-testid="label-first-name">First Name *</Label>
                  <Input
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-black dark:text-white" data-testid="label-last-name">Last Name *</Label>
                  <Input
                    id="lastName"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-black dark:text-white" data-testid="label-email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-black dark:text-white" data-testid="label-phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="text-black dark:text-white" data-testid="label-company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  data-testid="input-company"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitsUnderManagement" className="text-black dark:text-white" data-testid="label-units">Units Under Management</Label>
                <Input
                  id="unitsUnderManagement"
                  value={formData.unitsUnderManagement}
                  onChange={(e) => setFormData({ ...formData, unitsUnderManagement: e.target.value })}
                  placeholder="e.g., 50 units"
                  data-testid="input-units"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamSize" className="text-black dark:text-white" data-testid="label-team-size">Team Size</Label>
                <Input
                  id="teamSize"
                  value={formData.teamSize}
                  onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                  placeholder="e.g., 5 people"
                  data-testid="input-team-size"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentTools" className="text-black dark:text-white" data-testid="label-current-tools">Tools Currently Using</Label>
                <Input
                  id="currentTools"
                  value={formData.currentTools}
                  onChange={(e) => setFormData({ ...formData, currentTools: e.target.value })}
                  placeholder="e.g., Yardi, Buildium, AppFolio"
                  data-testid="input-current-tools"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-black dark:text-white" data-testid="label-notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any specific topics you'd like to discuss?"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-4" data-testid="text-summary">
                  <p className="font-medium mb-1">Appointment Summary:</p>
                  <p>{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
                  <p>{formatTimeSlot(selectedTime)}</p>
                  <p className="mt-2 text-xs">Duration: 30 minutes</p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createAppointment.isPending}
                  data-testid="button-confirm-booking"
                >
                  {createAppointment.isPending ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Placeholder when no time selected */}
      {selectedDate && !showForm && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground" data-testid="text-select-time-prompt">
              Select a time slot to continue
            </p>
          </CardContent>
        </Card>
      )}

      {/* Placeholder when no date selected */}
      {!selectedDate && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground" data-testid="text-select-date-prompt">
              Select a date to see available times
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
