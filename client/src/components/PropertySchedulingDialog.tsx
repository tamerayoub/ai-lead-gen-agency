import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ChevronDown, ChevronUp, Clock, Plus, Trash2, Info, Users, User, ChevronLeft } from "lucide-react";
import type { PropertySchedulingSettings, SchedulePreference, AssignedMember } from "@shared/schema";

interface PropertySchedulingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  propertyName: string;
  selectedUnitIds?: string[] | "all" | null; // Pre-selected units from creation flow
  isCreationFlow?: boolean; // Flag to indicate if this is a booking type creation flow
}

export default function PropertySchedulingDialog({
  isOpen,
  onClose,
  propertyId,
  propertyName,
  selectedUnitIds,
  isCreationFlow = false,
}: PropertySchedulingDialogProps) {
  const { toast } = useToast();
  
  // Helper to format time string (HH:MM) to 12-hour format (e.g., "00:00" -> "12am", "13:30" -> "1:30pm")
  const formatTimeForDisplay = (timeStr: string): string => {
    if (!timeStr) return timeStr;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    
    // Handle 00:00 as 12am
    if (hours === 0 && minutes === 0) return "12am";
    
    // Handle 12:00 as 12pm
    if (hours === 12 && minutes === 0) return "12pm";
    
    // Handle 12:XX as 12:XXpm
    if (hours === 12) return `12:${minutes.toString().padStart(2, '0')}pm`;
    
    // Handle 00:XX as 12:XXam
    if (hours === 0) return `12:${minutes.toString().padStart(2, '0')}am`;
    
    // Handle 13-23 as 1-11pm
    if (hours > 12) {
      const hour12 = hours - 12;
      return minutes === 0 ? `${hour12}pm` : `${hour12}:${minutes.toString().padStart(2, '0')}pm`;
    }
    
    // Handle 1-11 as 1-11am
    return minutes === 0 ? `${hours}am` : `${hours}:${minutes.toString().padStart(2, '0')}am`;
  };
  
  // Helper to format reminder time for display
  const formatReminderTime = (minutes: number): string => {
    if (minutes === 15) return "15 minutes";
    if (minutes === 30) return "30 minutes";
    if (minutes === 60) return "1 hour";
    if (minutes === 180) return "3 hours";
    if (minutes === 360) return "6 hours";
    if (minutes === 720) return "12 hours";
    if (minutes === 1440) return "24 hours";
    if (minutes === 2880) return "48 hours";
    // Fallback for any other values
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
    return `${Math.round(minutes / 1440)} days`;
  };
  
  const [eventName, setEventName] = useState("");
  const [bookingMode, setBookingMode] = useState<"one_to_one" | "group">("one_to_one");
  const [eventDuration, setEventDuration] = useState(30);
  const [bufferTime, setBufferTime] = useState(15);
  const [leadTime, setLeadTime] = useState(120); // 2 hours in minutes
  const [eventDescription, setEventDescription] = useState("");
  const [assignedMembers, setAssignedMembers] = useState<AssignedMember[]>([]);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [preQualifyEnabled, setPreQualifyEnabled] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderCount, setReminderCount] = useState(1); // number of reminders to send
  const [reminderTimes, setReminderTimes] = useState<number[]>([1440]); // array of minutes before (24 hours default for first reminder)
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderEmail, setReminderEmail] = useState(true);
  const [reminderText, setReminderText] = useState(false);
  const [memberPreferences, setMemberPreferences] = useState<Record<string, SchedulePreference[]>>({});
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [editingPreferences, setEditingPreferences] = useState<Record<string, Array<{
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }>>>({});
  const [savingPreferences, setSavingPreferences] = useState<Record<string, boolean>>({});
  
  const [showApplyToUnitsDialog, setShowApplyToUnitsDialog] = useState(false);
  const [showUnitSelectionDialog, setShowUnitSelectionDialog] = useState(false);
  const [selectedUnitsForApply, setSelectedUnitsForApply] = useState<string[]>([]);
  const [showBookingToggleDialog, setShowBookingToggleDialog] = useState(false);
  const [pendingBookingState, setPendingBookingState] = useState(true);
  const [pendingSaveData, setPendingSaveData] = useState<{
    eventName: string;
    bookingMode: "one_to_one" | "group";
    eventDuration: number;
    bufferTime: number;
    leadTime: number;
    eventDescription: string;
    assignedMembers: AssignedMember[];
    bookingEnabled: boolean;
    reminderSettings?: any;
  } | null>(null);
  const [originalSettings, setOriginalSettings] = useState<{
    eventName: string;
    bookingMode: "one_to_one" | "group";
    eventDuration: number;
    bufferTime: number;
    leadTime: number;
    eventDescription: string;
    assignedMembers: AssignedMember[];
    reminderSettings?: any;
    bookingEnabled: boolean;
  } | null>(null);
  const [changesToApply, setChangesToApply] = useState<{
    eventName: boolean;
    bookingMode: boolean;
    eventDuration: boolean;
    bufferTime: boolean;
    leadTime: boolean;
    eventDescription: boolean;
    assignedMembers: boolean;
    reminderSettings: boolean;
    bookingEnabled: boolean;
    memberPreferences: boolean;
  }>({
    eventName: true,
    bookingMode: true,
    eventDuration: true,
    bufferTime: true,
    leadTime: true,
    eventDescription: true,
    assignedMembers: true,
    reminderSettings: true,
    bookingEnabled: true,
    memberPreferences: true,
  });
  
  // Track whether member preferences were edited to trigger the apply-to-units dialog
  const [memberPreferencesEdited, setMemberPreferencesEdited] = useState(false);

  // Fetch current user for permission checking
  const { data: currentUser } = useQuery<{ id: string; email: string }>({
    queryKey: ["/api/auth/user"],
  });

  // Fetch current user's membership to check role
  const { data: currentOrg } = useQuery<{ orgId: string; role: string }>({
    queryKey: ["/api/organizations/current"],
  });

  // Helper to normalize assignedMembers (handle legacy string[] data)
  const normalizeAssignedMembers = (members: any): AssignedMember[] => {
    if (!members || !Array.isArray(members)) return [];
    return members.map(m => {
      if (typeof m === 'string') {
        return { userId: m, priority: 1 };
      }
      return m;
    });
  };

  // Fetch organization members
  const { data: orgMembers = [] } = useQuery<Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>>({
    queryKey: ["/api/org/members"],
  });

  // Fetch existing settings
  const { data: settings, isLoading: settingsLoading } = useQuery<PropertySchedulingSettings | null>({
    queryKey: ["/api/properties", propertyId, "scheduling-settings"],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/scheduling-settings`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch property units for unit selection
  const { data: propertyUnits = [] } = useQuery<Array<{
    id: string;
    unitNumber: string;
    bedrooms: number;
    bathrooms: string;
  }>>({
    queryKey: ["/api/properties", propertyId, "units"],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/units`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch property units");
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch member preferences when assigned members change
  const { data: bulkPreferences } = useQuery<SchedulePreference[]>({
    queryKey: ["/api/schedule/preferences/bulk", propertyId, ...assignedMembers.map(m => m.userId).sort()],
    queryFn: async () => {
      if (assignedMembers.length === 0) return [];
      const userIds = assignedMembers.map(m => m.userId);
      const response = await apiRequest("POST", "/api/schedule/preferences/bulk", { 
        userIds,
        propertyId 
      });
      return response.json();
    },
    enabled: assignedMembers.length > 0 && isOpen,
  });

  // Reset form to defaults when opening in creation flow
  // Always reset in creation flow, even if settings exist (we want a clean form for new booking type)
  useEffect(() => {
    if (isOpen && isCreationFlow) {
      // In creation flow, always reset to clean defaults
      setEventName("");
      setEventDescription("");
      setAssignedMembers([]); // Don't auto-assign members in creation flow
      setBookingMode("one_to_one");
      setEventDuration(30);
      setBufferTime(15);
      setLeadTime(120);
      setBookingEnabled(true);
      setReminderEnabled(false);
      setReminderCount(1);
      setReminderTimes([1440]);
      setReminderMessage("");
      setReminderEmail(true);
      setReminderText(false);
      setOriginalSettings(null);
    }
  }, [isOpen, isCreationFlow]);

  // Update form when settings load
  // Don't reset form state if the "apply to units" dialog is open or if we have pending save data
  // (user is in the middle of applying changes)
  // Skip if in creation flow (we want clean form in creation flow)
  useEffect(() => {
    if (settings && !showApplyToUnitsDialog && !pendingSaveData && !isCreationFlow) {
      setEventName(settings.eventName || "");
      setBookingMode((settings.bookingMode as "one_to_one" | "group") || "one_to_one");
      setEventDuration(settings.eventDuration);
      setBufferTime(settings.bufferTime);
      setLeadTime(settings.leadTime);
      setEventDescription(settings.eventDescription || "");
      setAssignedMembers(normalizeAssignedMembers(settings.assignedMembers));
      setBookingEnabled(settings.bookingEnabled ?? true);
      setPreQualifyEnabled((settings as any).preQualifyEnabled ?? false);
      
      // Store original settings for comparison
      const reminderSettings = (settings as any).reminderSettings;
      setOriginalSettings({
        eventName: settings.eventName || "",
        bookingMode: (settings.bookingMode as "one_to_one" | "group") || "one_to_one",
        eventDuration: settings.eventDuration,
        bufferTime: settings.bufferTime,
        leadTime: settings.leadTime,
        eventDescription: settings.eventDescription || "",
        assignedMembers: normalizeAssignedMembers(settings.assignedMembers),
        reminderSettings: reminderSettings || null, // Store null if not set
        bookingEnabled: settings.bookingEnabled ?? true,
      });
      
      // Load reminder settings
      // If reminderSettings is null/undefined, reminders are disabled - clear all fields
      if (reminderSettings && reminderSettings.enabled === true) {
        setReminderEnabled(true);
        const count = reminderSettings.count || 1;
        setReminderCount(count);
        
        // Handle old format (single time) or new format (array of times)
        if (reminderSettings.times && Array.isArray(reminderSettings.times)) {
          // New format: array of times
          setReminderTimes(reminderSettings.times);
        } else if (reminderSettings.time) {
          // Old format: single time, convert to array
          let timeInMinutes: number;
          if (reminderSettings.timeUnit === "days") {
            timeInMinutes = reminderSettings.time * 24 * 60;
          } else if (reminderSettings.timeUnit === "hours") {
            timeInMinutes = reminderSettings.time * 60;
          } else {
            timeInMinutes = reminderSettings.time; // already in minutes
          }
          // Create array with the single time, or default times for multiple reminders
          if (count === 1) {
            setReminderTimes([timeInMinutes]);
          } else {
            // Generate default times: 24h, 12h, 6h, etc.
            const defaultTimes = [1440, 720, 360, 180, 60, 30, 15];
            setReminderTimes(defaultTimes.slice(0, count).map(t => t));
          }
        } else {
          // Default: create array based on count
          const defaultTimes = [1440, 720, 360, 180, 60, 30, 15];
          setReminderTimes(defaultTimes.slice(0, count));
        }
        setReminderMessage(reminderSettings.message || "");
        setReminderEmail(reminderSettings.email !== false);
        setReminderText(reminderSettings.text || false);
      } else {
        // Reminders are disabled - clear all fields
        setReminderEnabled(false);
        setReminderCount(1);
        setReminderTimes([1440]);
        setReminderMessage("");
        setReminderEmail(true);
        setReminderText(false);
      }
    }
  }, [settings, showApplyToUnitsDialog, pendingSaveData]);

  // Organize preferences by user ID
  useEffect(() => {
    if (bulkPreferences) {
      const organized: Record<string, SchedulePreference[]> = {};
      bulkPreferences.forEach(pref => {
        if (pref.userId) {
          if (!organized[pref.userId]) {
            organized[pref.userId] = [];
          }
          organized[pref.userId].push(pref);
        }
      });
      setMemberPreferences(organized);
    }
  }, [bulkPreferences]);

  // Sync editing preferences when member preferences data changes
  useEffect(() => {
    Object.keys(memberPreferences).forEach(memberId => {
      // Only update if this member is expanded and we don't have unsaved edits
      if (expandedMembers[memberId]) {
        setEditingPreferences(prev => {
          // If we already have edits for this member, don't overwrite them
          if (prev[memberId] && prev[memberId].length > 0) {
            return prev;
          }
          // Otherwise, initialize from server data
          return {
            ...prev,
            [memberId]: memberPreferences[memberId].map(p => ({
              dayOfWeek: p.dayOfWeek,
              startTime: p.startTime,
              endTime: p.endTime,
            }))
          };
        });
      }
    });
  }, [memberPreferences, expandedMembers]);

  const saveMutation = useMutation({
    mutationFn: async (data: {
      eventName: string;
      bookingMode: "one_to_one" | "group";
      eventDuration: number;
      bufferTime: number;
      leadTime: number;
      eventDescription: string;
      assignedMembers: AssignedMember[];
      bookingEnabled: boolean;
      preQualifyEnabled: boolean;
      reminderSettings?: {
        enabled: boolean;
        times: number[]; // array of minutes before, stored in minutes
        message: string;
        email: boolean;
        text: boolean;
        count: number;
      } | null; // null means reminders are disabled/cleared
    }) => {
      return await apiRequest("POST", `/api/properties/${propertyId}/scheduling-settings`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "scheduling-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduling-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences/bulk"] });
      // Invalidate all unit queries for this property to ensure they refetch property settings
      queryClient.invalidateQueries({ queryKey: ["/api/units"], exact: false });
      
      // Set pending save data for both flows (creation and manual edit)
      // When reminders are disabled, send null to completely clear/wipe out reminder settings
      // When enabled, send the full reminder settings object
      const reminderSettingsData = reminderEnabled ? {
        enabled: reminderEnabled,
        times: reminderTimes,
        message: reminderMessage,
        email: reminderEmail,
        text: reminderText,
        count: reminderCount,
      } : null; // null means reminders are disabled/cleared
      
      setPendingSaveData({
        ...variables,
        reminderSettings: reminderSettingsData,
      });
      
      // Determine what changed by comparing with original settings
      let hasEventNameChange = false;
      let hasBookingModeChange = false;
      let hasEventDurationChange = false;
      let hasBufferTimeChange = false;
      let hasLeadTimeChange = false;
      let hasEventDescriptionChange = false;
      let hasAssignedMembersChange = false;
      let hasReminderSettingsChange = false;
      let hasBookingEnabledChange = false;
      
      if (originalSettings) {
        hasEventNameChange = variables.eventName !== originalSettings.eventName;
        hasBookingModeChange = variables.bookingMode !== originalSettings.bookingMode;
        hasEventDurationChange = variables.eventDuration !== originalSettings.eventDuration;
        hasBufferTimeChange = variables.bufferTime !== originalSettings.bufferTime;
        hasLeadTimeChange = variables.leadTime !== originalSettings.leadTime;
        hasEventDescriptionChange = variables.eventDescription !== originalSettings.eventDescription;
        // Normalize assignedMembers for comparison (sort by userId to ensure consistent comparison)
        const normalizeForComparison = (members: AssignedMember[]) => {
          return [...members].sort((a, b) => a.userId.localeCompare(b.userId))
            .map(m => ({ userId: m.userId, priority: m.priority }));
        };
        const normalizedCurrentMembers = normalizeForComparison(variables.assignedMembers);
        const normalizedOriginalMembers = normalizeForComparison(originalSettings.assignedMembers);
        hasAssignedMembersChange = JSON.stringify(normalizedCurrentMembers) !== JSON.stringify(normalizedOriginalMembers);
        
        // Debug logging for assignedMembers changes
        if (hasAssignedMembersChange) {
          console.log("[PropertyScheduling] AssignedMembers changed detected");
          console.log("[PropertyScheduling] Current:", normalizedCurrentMembers);
          console.log("[PropertyScheduling] Original:", normalizedOriginalMembers);
        }
        
        // Compare reminder settings: normalize both to the same format before comparing
        // Normalize original reminderSettings to match the format we send (null if disabled, object if enabled)
        const normalizedOriginalReminderSettings = originalSettings.reminderSettings && originalSettings.reminderSettings.enabled === true
          ? {
              enabled: true,
              times: originalSettings.reminderSettings.times || [],
              message: originalSettings.reminderSettings.message || "",
              email: originalSettings.reminderSettings.email !== false,
              text: originalSettings.reminderSettings.text || false,
              count: originalSettings.reminderSettings.count || 1,
            }
          : null;
        
        // Normalize current reminderSettingsData to match the same format
        const normalizedCurrentReminderSettings = reminderSettingsData && reminderSettingsData.enabled === true
          ? {
              enabled: true,
              times: reminderSettingsData.times || [],
              message: reminderSettingsData.message || "",
              email: reminderSettingsData.email !== false,
              text: reminderSettingsData.text || false,
              count: reminderSettingsData.count || 1,
            }
          : null;
        
        // Compare normalized versions
        hasReminderSettingsChange = JSON.stringify(normalizedCurrentReminderSettings) !== JSON.stringify(normalizedOriginalReminderSettings);
        hasBookingEnabledChange = variables.bookingEnabled !== originalSettings.bookingEnabled;
        
        // Set which changes to apply (default to all changes that occurred)
        setChangesToApply({
          eventName: hasEventNameChange,
          bookingMode: hasBookingModeChange,
          eventDuration: hasEventDurationChange,
          bufferTime: hasBufferTimeChange,
          leadTime: hasLeadTimeChange,
          eventDescription: hasEventDescriptionChange,
          assignedMembers: hasAssignedMembersChange,
          reminderSettings: hasReminderSettingsChange,
          bookingEnabled: hasBookingEnabledChange,
          memberPreferences: memberPreferencesEdited, // Include member preferences edit flag
        });
      }
      
      // Check if there are any changes to show the dialog
      // Include memberPreferencesEdited to trigger dialog when member slots were edited
      const hasAnyChanges = originalSettings && (
        hasEventNameChange || hasBookingModeChange || hasEventDurationChange || 
        hasBufferTimeChange || hasLeadTimeChange || hasEventDescriptionChange || 
        hasAssignedMembersChange || hasReminderSettingsChange || hasBookingEnabledChange ||
        memberPreferencesEdited
      );
      
      console.log("[PropertySchedulingDialog] Save changes detected:", {
        hasEventNameChange, hasBookingModeChange, hasEventDurationChange,
        hasBufferTimeChange, hasLeadTimeChange, hasEventDescriptionChange,
        hasAssignedMembersChange, hasReminderSettingsChange, hasBookingEnabledChange,
        memberPreferencesEdited, hasAnyChanges
      });
      
      // If isCreationFlow is true (creation flow), automatically apply settings to selected units
      if (isCreationFlow && selectedUnitIds) {
        // Use defaults if eventName or eventDescription are empty in creation flow
        const finalEventName = !variables.eventName.trim() 
          ? `Showing for ${propertyName}` 
          : variables.eventName;
        const finalEventDescription = !variables.eventDescription.trim()
          ? `Welcome to ${propertyName}. Schedule a showing to view this property.`
          : variables.eventDescription;
        
        applyToUnitsMutation.mutate({
          eventName: finalEventName,
          eventDescription: finalEventDescription,
          assignedMembers: variables.assignedMembers,
          enableBooking: true, // Enable booking for units during creation flow
          unitIds: selectedUnitIds === "all" ? undefined : Array.isArray(selectedUnitIds) ? selectedUnitIds : undefined,
        });
      } else if (hasAnyChanges) {
        // Show the apply to units confirmation dialog if there are any changes
        setShowApplyToUnitsDialog(true);
      } else {
        // No changes, just close
        toast({
          title: "Settings saved",
          description: "Scheduling settings have been updated successfully.",
        });
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save scheduling settings",
      });
      setPendingSaveData(null);
    },
  });

  const applyToUnitsMutation = useMutation({
    mutationFn: async (data: {
      eventName?: string;
      bookingMode?: "one_to_one" | "group";
      eventDuration?: number;
      bufferTime?: number;
      leadTime?: number;
      eventDescription?: string;
      assignedMembers?: AssignedMember[];
      reminderSettings?: any;
      enableBooking?: boolean; // Optional: enable booking when applying (creation flow)
      unitIds?: string[]; // Optional: specific units to apply to
    }) => {
      return await apiRequest("POST", `/api/properties/${propertyId}/apply-settings-to-units`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      // Invalidate all unit scheduling queries for this property to ensure they show updated settings
      queryClient.invalidateQueries({ queryKey: ["/api/units"], exact: false });
      // Also invalidate property settings query to ensure it's fresh
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "scheduling-settings"] });
      // CRITICAL: Invalidate preference queries so units refetch inherited preferences
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences/bulk"] });
      
      // Show different messages for creation vs edit flow
      if (isCreationFlow) {
        const description = variables.unitIds 
          ? `Booking event has been created and applied to ${variables.unitIds.length} selected unit(s).`
          : "Booking event has been created and applied to all linked units.";
        toast({
          title: "Booking event created",
          description,
        });
      } else {
        const description = variables.unitIds 
          ? `Property settings have been applied to ${variables.unitIds.length} selected unit(s).`
          : "Property settings have been applied to all linked units.";
        toast({
          title: "Settings applied",
          description,
        });
      }
      
      // Close dialogs and reset state
      setShowApplyToUnitsDialog(false);
      setShowUnitSelectionDialog(false);
      setPendingSaveData(null);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to apply settings to units",
      });
      setShowApplyToUnitsDialog(false);
      setPendingSaveData(null);
    },
  });

  const handleSave = async () => {
    // Save all pending member preferences first
    const membersWithPendingPreferences = Object.keys(editingPreferences).filter(
      memberId => editingPreferences[memberId] && editingPreferences[memberId].length > 0
    );
    
    // Save all preferences in parallel
    if (membersWithPendingPreferences.length > 0) {
      try {
        await Promise.all(
          membersWithPendingPreferences.map(memberId => 
            saveMemberPreferences(memberId)
          )
        );
      } catch (error) {
        // If preference saving fails, still continue with main save
        // The error toast will be shown by saveMemberPreferences
        console.error("Failed to save some preferences:", error);
      }
    }
    
    // When reminders are disabled, send null to completely clear/wipe out reminder settings
    // When enabled, send the full reminder settings object
    const reminderSettingsToSave = reminderEnabled ? {
      enabled: reminderEnabled,
      times: reminderTimes, // array of minutes before, stored in minutes
      message: reminderMessage,
      email: reminderEmail,
      text: reminderText,
      count: reminderCount,
    } : null; // Send null to clear reminder settings when disabled
    
    // In creation flow, use defaults if eventName or eventDescription are empty
    // This ensures the booking type is actually created even if user doesn't fill out these fields
    const finalEventName = (isCreationFlow && !eventName.trim()) 
      ? `Showing for ${propertyName}` 
      : eventName;
    
    const finalEventDescription = (isCreationFlow && !eventDescription.trim())
      ? `Welcome to ${propertyName}. Schedule a showing to view this property.`
      : eventDescription;
    
    saveMutation.mutate({
      eventName: finalEventName,
      bookingMode,
      eventDuration,
      bufferTime,
      leadTime,
      eventDescription: finalEventDescription,
      assignedMembers,
      bookingEnabled,
      preQualifyEnabled,
      reminderSettings: reminderSettingsToSave,
    });
    
    // Store reminder settings in pendingSaveData for comparison
    if (pendingSaveData) {
      setPendingSaveData({
        ...pendingSaveData,
        reminderSettings: reminderEnabled ? {
          enabled: reminderEnabled,
          times: reminderTimes,
          message: reminderMessage,
          email: reminderEmail,
          text: reminderText,
          count: reminderCount,
        } : undefined,
      });
    }
  };

  const handleBookingToggle = (checked: boolean) => {
    if (!checked) {
      // Disabling booking - show confirmation
      setPendingBookingState(false);
      setShowBookingToggleDialog(true);
    } else {
      // Enabling booking - apply directly
      setBookingEnabled(true);
    }
  };

  const confirmBookingToggle = () => {
    setBookingEnabled(pendingBookingState);
    setShowBookingToggleDialog(false);
  };

  const cancelBookingToggle = () => {
    // Reset to current state when canceling
    setShowBookingToggleDialog(false);
  };

  const handleApplyToAllUnits = async () => {
    if (pendingSaveData) {
      // Always include reminderSettings if it's in changesToApply
      // If null, it means reminders are disabled and will clear unit-level custom reminder settings
      const reminderSettingsToApply = changesToApply.reminderSettings 
        ? pendingSaveData.reminderSettings // This will be null if disabled, or the object if enabled
        : undefined;
      
      // CRITICAL: If member preferences should be applied, reset unit-level overrides so units inherit from property
      // This must happen BEFORE applyPropertySettingsToUnits so that customAssignedMembers gets cleared
      if (changesToApply.memberPreferences && memberPreferencesEdited && propertyUnits.length > 0) {
        try {
          await apiRequest("POST", "/api/schedule/preferences/copy-to-units", {
            propertyId,
            unitIds: propertyUnits.map(u => u.id),
          });
          console.log("[PropertySchedulingDialog] Reset unit preferences to inherit from property");
        } catch (error) {
          console.error("Failed to reset unit preferences to inherit:", error);
          toast({
            variant: "destructive",
            title: "Warning",
            description: "Failed to apply preferences to units",
          });
        }
      }
      
      // CRITICAL: Always include assignedMembers when memberPreferences are being applied
      // This ensures applyPropertySettingsToUnits clears customAssignedMembers for units that had custom preferences
      applyToUnitsMutation.mutate({
        eventName: changesToApply.eventName ? pendingSaveData.eventName : undefined,
        bookingMode: changesToApply.bookingMode ? pendingSaveData.bookingMode : undefined,
        eventDuration: changesToApply.eventDuration ? pendingSaveData.eventDuration : undefined,
        bufferTime: changesToApply.bufferTime ? pendingSaveData.bufferTime : undefined,
        leadTime: changesToApply.leadTime ? pendingSaveData.leadTime : undefined,
        eventDescription: changesToApply.eventDescription ? pendingSaveData.eventDescription : undefined,
        // CRITICAL: Include assignedMembers if memberPreferences are being applied OR if assignedMembers changed
        assignedMembers: (changesToApply.memberPreferences || changesToApply.assignedMembers) ? pendingSaveData.assignedMembers : undefined,
        reminderSettings: reminderSettingsToApply,
        enableBooking: changesToApply.bookingEnabled ? pendingSaveData.bookingEnabled : undefined,
      });
    }
  };

  const handleSkipApplyToUnits = () => {
    toast({
      title: "Settings saved",
      description: "Scheduling settings have been updated successfully.",
    });
    setShowApplyToUnitsDialog(false);
    setPendingSaveData(null);
    onClose();
  };

  const handleSelectUnits = () => {
    // Initialize with all units selected
    setSelectedUnitsForApply(propertyUnits.map(u => u.id));
    setShowApplyToUnitsDialog(false);
    setShowUnitSelectionDialog(true);
  };

  const handleApplyToSelectedUnits = async () => {
    if (pendingSaveData && selectedUnitsForApply.length > 0) {
      // Always include reminderSettings if it's in changesToApply
      // If null, it means reminders are disabled and will clear unit-level custom reminder settings
      const reminderSettingsToApply = changesToApply.reminderSettings 
        ? pendingSaveData.reminderSettings // This will be null if disabled, or the object if enabled
        : undefined;
      
      // If member preferences should be applied, reset unit-level overrides so units inherit from property
      if (changesToApply.memberPreferences && memberPreferencesEdited) {
        try {
          await apiRequest("POST", "/api/schedule/preferences/copy-to-units", {
            propertyId,
            unitIds: selectedUnitsForApply,
          });
          console.log("[PropertySchedulingDialog] Reset selected units to inherit from property");
          // Invalidate all preference queries - using shortest prefix to match all variations
          // This catches both unit-level and property-level inherited queries
          queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences/bulk"] });
        } catch (error) {
          console.error("Failed to reset unit preferences to inherit:", error);
          toast({
            variant: "destructive",
            title: "Warning",
            description: "Failed to apply preferences to selected units",
          });
        }
      }
      
      applyToUnitsMutation.mutate({
        eventName: changesToApply.eventName ? pendingSaveData.eventName : undefined,
        bookingMode: changesToApply.bookingMode ? pendingSaveData.bookingMode : undefined,
        eventDuration: changesToApply.eventDuration ? pendingSaveData.eventDuration : undefined,
        bufferTime: changesToApply.bufferTime ? pendingSaveData.bufferTime : undefined,
        leadTime: changesToApply.leadTime ? pendingSaveData.leadTime : undefined,
        eventDescription: changesToApply.eventDescription ? pendingSaveData.eventDescription : undefined,
        assignedMembers: changesToApply.assignedMembers ? pendingSaveData.assignedMembers : undefined,
        reminderSettings: reminderSettingsToApply,
        enableBooking: changesToApply.bookingEnabled ? pendingSaveData.bookingEnabled : undefined,
        unitIds: selectedUnitsForApply,
      });
    }
  };

  const toggleUnitSelection = (unitId: string) => {
    setSelectedUnitsForApply(prev =>
      prev.includes(unitId)
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const toggleMember = (memberId: string) => {
    setAssignedMembers((prev) => {
      const isAssigned = prev.some(m => m.userId === memberId);
      if (isAssigned) {
        return prev.filter((m) => m.userId !== memberId);
      } else {
        // Find the next available priority (1-5)
        const usedPriorities = new Set(prev.map(m => m.priority));
        let nextPriority = 1;
        while (usedPriorities.has(nextPriority) && nextPriority <= 5) {
          nextPriority++;
        }
        // If all priorities 1-5 are taken, use the highest priority + 1
        if (nextPriority > 5) {
          nextPriority = Math.max(...prev.map(m => m.priority), 0) + 1;
        }
        return [...prev, { userId: memberId, priority: nextPriority }];
      }
    });
  };

  const updateMemberPriority = (memberId: string, newPriority: number) => {
    setAssignedMembers((prev) => {
      // Find the member being updated and their current priority
      const memberToUpdate = prev.find(m => m.userId === memberId);
      if (!memberToUpdate) return prev;
      
      const oldPriority = memberToUpdate.priority;
      
      // Check if another member already has this priority
      const conflictingMember = prev.find(m => m.userId !== memberId && m.priority === newPriority);
      
      if (conflictingMember) {
        // Swap priorities: give the conflicting member the old priority
        return prev.map((m) => {
          if (m.userId === memberId) {
            return { ...m, priority: newPriority };
          } else if (m.userId === conflictingMember.userId) {
            return { ...m, priority: oldPriority };
          }
          return m;
        });
      } else {
        // No conflict, just update the priority
        return prev.map((m) => 
          m.userId === memberId ? { ...m, priority: newPriority } : m
        );
      }
    });
  };

  const getMemberName = (member: { firstName: string | null; lastName: string | null; email: string }) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return member.email;
  };

  const canEditPreferences = (memberId: string) => {
    const role = currentOrg?.role;
    const isCurrentUser = currentUser?.id === memberId;
    return role === 'admin' || role === 'property_manager' || isCurrentUser;
  };

  const toggleMemberExpanded = (memberId: string) => {
    const willExpand = !expandedMembers[memberId];
    setExpandedMembers(prev => ({ ...prev, [memberId]: willExpand }));
    if (willExpand) {
      initializeEditingPreferences(memberId);
    }
  };

  const getMemberPreferencesSummary = (memberId: string) => {
    const prefs = memberPreferences[memberId] || [];
    if (prefs.length === 0) return "No preferences set";
    
    // Show time ranges for the first few preferences
    const dayNames: Record<string, string> = {
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun',
    };
    
    const firstFew = prefs.slice(0, 2);
    const timeRanges = firstFew.map(p => {
      const dayName = dayNames[p.dayOfWeek] || p.dayOfWeek.substring(0, 3);
      return `${dayName} ${formatTimeForDisplay(p.startTime)}-${formatTimeForDisplay(p.endTime)}`;
    }).join(', ');
    
    if (prefs.length <= 2) {
      return timeRanges;
    }
    return `${timeRanges} (+${prefs.length - 2} more)`;
  };

  // Initialize editing preferences when member is expanded
  const initializeEditingPreferences = (memberId: string) => {
    // Don't initialize if we already have edits
    if (editingPreferences[memberId]) {
      return;
    }
    
    const existing = memberPreferences[memberId] || [];
    setEditingPreferences(prev => ({
      ...prev,
      [memberId]: existing.map(p => ({
        dayOfWeek: p.dayOfWeek,
        startTime: p.startTime,
        endTime: p.endTime,
      }))
    }));
  };

  const addTimeSlot = (memberId: string) => {
    setMemberPreferencesEdited(true); // Track that preferences were edited
    setEditingPreferences(prev => ({
      ...prev,
      [memberId]: [
        ...(prev[memberId] || []),
        { dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00' }
      ]
    }));
  };

  const removeTimeSlot = (memberId: string, index: number) => {
    setMemberPreferencesEdited(true); // Track that preferences were edited
    setEditingPreferences(prev => ({
      ...prev,
      [memberId]: (prev[memberId] || []).filter((_, i) => i !== index)
    }));
  };

  const updateTimeSlot = (memberId: string, index: number, field: 'dayOfWeek' | 'startTime' | 'endTime', value: string) => {
    setMemberPreferencesEdited(true); // Track that preferences were edited
    setEditingPreferences(prev => ({
      ...prev,
      [memberId]: (prev[memberId] || []).map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const saveMemberPreferences = async (memberId: string) => {
    try {
      setSavingPreferences(prev => ({ ...prev, [memberId]: true }));
      
      const preferences = editingPreferences[memberId] || [];
      await apiRequest("PUT", `/api/schedule/preferences/user/${memberId}`, { 
        preferences,
        propertyId 
      });
      
      // Refetch preferences and clear editing state for this member
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences/bulk"] });
      
      // Clear the editing state for this member so it gets refreshed from server
      setEditingPreferences(prev => {
        const newState = { ...prev };
        delete newState[memberId];
        return newState;
      });
      
      toast({
        title: "Success",
        description: "Preferences saved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save preferences",
      });
    } finally {
      setSavingPreferences(prev => ({ ...prev, [memberId]: false }));
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] lg:max-w-[800px] max-h-[95vh] flex flex-col" data-testid="dialog-property-scheduling">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle data-testid="text-dialog-title">Scheduling Settings</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Configure how showings are scheduled for {propertyName}
          </DialogDescription>
        </DialogHeader>

        {settingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8 py-6 overflow-y-auto flex-1 min-h-0">
            {/* Booking Toggle */}
            <div className="flex items-center justify-between p-5 border rounded-md bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="booking-enabled" className="text-base">Public Booking</Label>
                <p className="text-sm text-muted-foreground">
                  Allow prospects to book showings for this property
                </p>
              </div>
              <Switch
                id="booking-enabled"
                checked={bookingEnabled}
                onCheckedChange={handleBookingToggle}
                data-testid="switch-booking-enabled"
              />
            </div>

            {/* Pre-Qualification Toggle */}
            <div className="flex items-center justify-between p-5 border rounded-md bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="pre-qualify-enabled" className="text-base">Pre-Qualification</Label>
                <p className="text-sm text-muted-foreground">
                  Require leads to complete pre-qualification before booking
                </p>
              </div>
              <Switch
                id="pre-qualify-enabled"
                checked={preQualifyEnabled}
                onCheckedChange={setPreQualifyEnabled}
                data-testid="switch-pre-qualify-enabled"
              />
            </div>

            {/* Event Name */}
            <div className="space-y-3">
              <div className="bg-muted/50 p-3 rounded-md border border-muted">
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{unit_number}"}, {"{bedrooms}"}, {"{bathrooms}"}, {"{unit_rent}"}, {"{security_deposit}"}, {"{property_amenities}"}, {"{property_address}"}, {"{property_name}"}. You can customize the event name and event description with these variables.
                </p>
              </div>
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                placeholder={`Showing for ${propertyName}`}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                data-testid="input-event-name"
                className={!eventName ? "placeholder:text-muted-foreground/60" : ""}
                maxLength={55}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use default: "Showing for {propertyName}"
              </p>
            </div>

            {/* Event Description */}
            <div className="space-y-3">
              <Label htmlFor="event-description">Event Description</Label>
              <Textarea
                id="event-description"
                data-testid="textarea-event-description"
                placeholder={`Welcome to ${propertyName}. Schedule a showing to view this property.`}
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                rows={3}
                className={`resize-none ${!eventDescription ? "placeholder:text-muted-foreground/60" : ""}`}
              />
            </div>

            {/* Event Duration */}
            <div className="space-y-3">
              <Label htmlFor="event-duration">Event Duration</Label>
              <Select value={eventDuration.toString()} onValueChange={(v) => setEventDuration(parseInt(v))}>
                <SelectTrigger id="event-duration" data-testid="select-event-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buffer Time */}
            <div className="space-y-3">
              <Label htmlFor="buffer-time">Buffer Between Showings</Label>
              <Select value={bufferTime.toString()} onValueChange={(v) => setBufferTime(parseInt(v))}>
                <SelectTrigger id="buffer-time" data-testid="select-buffer-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No buffer</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lead Time */}
            <div className="space-y-3">
              <Label htmlFor="lead-time">Minimum Lead Time</Label>
              <Select value={leadTime.toString()} onValueChange={(v) => setLeadTime(parseInt(v))}>
                <SelectTrigger id="lead-time" data-testid="select-lead-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No lead time</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="1440">1 day</SelectItem>
                  <SelectItem value="2880">2 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned Team Members */}
            <div className="space-y-3">
              <Label>Assigned Team Members</Label>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md mb-3">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                  Assign team members to handle showings. Use the priority setting (1=highest) to control auto-assignment order when bookings are created.
                </p>
                  <p className="text-xs text-muted-foreground italic">
                    Example: If 2 leasing agents have available time at 2pm, and a lead books this time, the system will assign whoever has the higher priority (lower number).
                </p>
                </div>
              </div>
              <div className="border rounded-md p-3 space-y-2 max-h-96 overflow-y-auto">
                {orgMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No team members available</p>
                ) : (
                  orgMembers.map((member) => {
                    const assignedMember = assignedMembers.find(m => m.userId === member.id);
                    const isAssigned = !!assignedMember;
                    const isExpanded = expandedMembers[member.id];
                    const canEdit = canEditPreferences(member.id);
                    
                    return (
                      <div key={member.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`member-${member.id}`}
                            checked={isAssigned}
                            onCheckedChange={() => toggleMember(member.id)}
                            data-testid={`checkbox-member-${member.id}`}
                          />
                          <Label
                            htmlFor={`member-${member.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                            data-testid={`label-member-${member.id}`}
                          >
                            {getMemberName(member)}
                          </Label>
                          {isAssigned && (
                            <>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Priority:</Label>
                                <Select
                                  value={assignedMember!.priority.toString()}
                                  onValueChange={(v) => updateMemberPriority(member.id, parseInt(v))}
                                >
                                  <SelectTrigger className="h-8 w-24" data-testid={`select-priority-${member.id}`}>
                                    <SelectValue>
                                      {assignedMember!.priority === 1 ? "1 (High)" : 
                                       assignedMember!.priority === 5 ? "5 (Low)" : 
                                       assignedMember!.priority.toString()}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1 (High)</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                    <SelectItem value="4">4</SelectItem>
                                    <SelectItem value="5">5 (Low)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleMemberExpanded(member.id)}
                                className="h-6 px-2"
                                data-testid={`button-expand-${member.id}`}
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                <span className="text-xs text-muted-foreground">
                                  {getMemberPreferencesSummary(member.id)}
                                </span>
                                {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                              </Button>
                            </>
                          )}
                        </div>
                        
                        {isAssigned && isExpanded && (
                          <div className="ml-6 pl-4 border-l-2 border-muted space-y-3 py-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium">
                                {canEdit ? "Configure preferred times" : "Preferred times (view-only)"}
                              </p>
                              {canEdit && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimeSlot(member.id)}
                                  className="h-7 text-xs"
                                  data-testid={`button-add-time-slot-${member.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Time Slot
                                </Button>
                              )}
                            </div>

                            {!canEdit && (
                              <p className="text-xs text-muted-foreground italic">
                                You can only edit your own preferences
                              </p>
                            )}

                            <div className="space-y-2">
                              {(editingPreferences[member.id] || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                  No time slots configured. {canEdit && "Click 'Add Time Slot' to get started."}
                                </p>
                              ) : (
                                (editingPreferences[member.id] || []).map((slot, index) => (
                                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                                    <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                                      <Select
                                        value={slot.dayOfWeek}
                                        onValueChange={(v) => updateTimeSlot(member.id, index, 'dayOfWeek', v)}
                                        disabled={!canEdit}
                                      >
                                        <SelectTrigger className="h-8 text-xs" data-testid={`select-day-${member.id}-${index}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="monday">Monday</SelectItem>
                                          <SelectItem value="tuesday">Tuesday</SelectItem>
                                          <SelectItem value="wednesday">Wednesday</SelectItem>
                                          <SelectItem value="thursday">Thursday</SelectItem>
                                          <SelectItem value="friday">Friday</SelectItem>
                                          <SelectItem value="saturday">Saturday</SelectItem>
                                          <SelectItem value="sunday">Sunday</SelectItem>
                                        </SelectContent>
                                      </Select>

                                      <div className="flex flex-col gap-0.5">
                                      <Input
                                        type="time"
                                        value={slot.startTime}
                                        onChange={(e) => updateTimeSlot(member.id, index, 'startTime', e.target.value)}
                                        disabled={!canEdit}
                                        step="60"
                                        className="h-8 text-xs"
                                        data-testid={`input-start-time-${member.id}-${index}`}
                                      />
                                        <span className="text-[10px] text-muted-foreground">
                                          {formatTimeForDisplay(slot.startTime)}
                                        </span>
                                      </div>

                                      <div className="flex flex-col gap-0.5">
                                      <Input
                                        type="time"
                                        value={slot.endTime}
                                        onChange={(e) => updateTimeSlot(member.id, index, 'endTime', e.target.value)}
                                        disabled={!canEdit}
                                        step="60"
                                        className="h-8 text-xs"
                                        data-testid={`input-end-time-${member.id}-${index}`}
                                      />
                                        <span className="text-[10px] text-muted-foreground">
                                          {formatTimeForDisplay(slot.endTime)}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {canEdit && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeTimeSlot(member.id, index)}
                                        className="h-8 w-8 flex-shrink-0"
                                        data-testid={`button-remove-time-slot-${member.id}-${index}`}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Reminders */}
            <div className="space-y-4 p-5 border rounded-md">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="reminder-enabled" className="text-base">Send Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send reminders before scheduled showings
                  </p>
                </div>
                <Switch
                  id="reminder-enabled"
                  checked={reminderEnabled}
                  onCheckedChange={setReminderEnabled}
                  data-testid="switch-reminder-enabled"
                />
              </div>

              {reminderEnabled && (
                <div className="space-y-4 pt-2 border-t">
                  {/* Number of Reminders - First */}
                  <div className="space-y-2">
                    <Label htmlFor="reminder-count">Number of Reminders</Label>
                    <Select
                      value={reminderCount.toString()}
                      onValueChange={(v) => {
                        const newCount = parseInt(v);
                        setReminderCount(newCount);
                        // Adjust reminderTimes array to match new count
                        setReminderTimes(prev => {
                          if (prev.length < newCount) {
                            // Add default times for new reminders
                            const defaultTimes = [1440, 720, 360, 180, 60, 30, 15];
                            const newTimes = [...prev];
                            for (let i = prev.length; i < newCount; i++) {
                              newTimes.push(defaultTimes[i] || 1440);
                            }
                            return newTimes;
                          } else {
                            // Remove extra times
                            return prev.slice(0, newCount);
                          }
                        });
                      }}
                    >
                      <SelectTrigger id="reminder-count" data-testid="select-reminder-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 reminder</SelectItem>
                        <SelectItem value="2">2 reminders</SelectItem>
                        <SelectItem value="3">3 reminders</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Send multiple reminders at different times before the showing
                    </p>
                  </div>

                  {/* Reminder Times - Show one for each reminder */}
                  <div className="space-y-3">
                    {Array.from({ length: reminderCount }).map((_, index) => (
                      <div key={index} className="space-y-2">
                        <Label htmlFor={`reminder-time-${index}`}>
                          Reminder {index + 1} - Time Before Showing
                        </Label>
                        <Select
                          value={reminderTimes[index]?.toString() || "1440"}
                          onValueChange={(v) => {
                            setReminderTimes(prev => {
                              const newTimes = [...prev];
                              newTimes[index] = parseInt(v);
                              return newTimes;
                            });
                          }}
                        >
                          <SelectTrigger id={`reminder-time-${index}`} data-testid={`select-reminder-time-${index}`}>
                            <SelectValue>
                              {formatReminderTime(reminderTimes[index] || 1440)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="180">3 hours</SelectItem>
                            <SelectItem value="360">6 hours</SelectItem>
                            <SelectItem value="720">12 hours</SelectItem>
                            <SelectItem value="1440">24 hours</SelectItem>
                            <SelectItem value="2880">48 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  {/* Reminder Message */}
                  <div className="space-y-2">
                    <Label htmlFor="reminder-message">Reminder Message</Label>
                    <Textarea
                      id="reminder-message"
                      placeholder="Hi {name}, this is a reminder about your showing at {property_name} on {date} at {time}..."
                      value={reminderMessage}
                      onChange={(e) => setReminderMessage(e.target.value)}
                      rows={3}
                      className="resize-none"
                      data-testid="textarea-reminder-message"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{name}"}</code>,{" "}
                      <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{property_name}"}</code>,{" "}
                      <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{date}"}</code>,{" "}
                      <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{time}"}</code>
                    </p>
                  </div>

                  {/* Reminder Channels */}
                  <div className="space-y-2">
                    <Label>Send Via</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="reminder-email"
                          checked={reminderEmail}
                          onCheckedChange={(checked) => setReminderEmail(checked === true)}
                          data-testid="checkbox-reminder-email"
                        />
                        <label
                          htmlFor="reminder-email"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Email
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="reminder-text"
                          checked={reminderText}
                          onCheckedChange={(checked) => setReminderText(checked === true)}
                          disabled={true}
                          data-testid="checkbox-reminder-text"
                        />
                        <label
                          htmlFor="reminder-text"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Text (SMS) <span className="text-xs text-muted-foreground">(Coming soon)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saveMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || settingsLoading}
            data-testid="button-save"
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Apply to Units Confirmation Dialog */}
    <AlertDialog open={showApplyToUnitsDialog} onOpenChange={setShowApplyToUnitsDialog}>
      <AlertDialogContent data-testid="dialog-apply-to-units" className="max-w-md max-h-[85vh] flex flex-col">
        <AlertDialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setShowApplyToUnitsDialog(false);
              }}
              data-testid="button-back-arrow"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
          <AlertDialogTitle>Apply Settings to Units?</AlertDialogTitle>
          <AlertDialogDescription>
                Select which changes you want to apply to units under {propertyName}.
          </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        
        {/* Show what changed and let user select */}
        {pendingSaveData && (
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 max-h-[calc(85vh-200px)]">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Changes to Apply:</Label>
              
              {changesToApply.eventName && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-event-name"
                    checked={changesToApply.eventName}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, eventName: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-event-name"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Event Title</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.eventName || "(Empty - will use default)"}
                    </div>
                  </label>
                </div>
              )}
              
              {changesToApply.eventDescription && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-event-description"
                    checked={changesToApply.eventDescription}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, eventDescription: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-event-description"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Event Description</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.eventDescription || "(Empty)"}
                    </div>
                  </label>
                </div>
              )}
              
              {changesToApply.assignedMembers && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-assigned-members"
                    checked={changesToApply.assignedMembers}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, assignedMembers: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-assigned-members"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Assigned Team Members</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.assignedMembers.length > 0 
                        ? `${pendingSaveData.assignedMembers.length} member(s) assigned`
                        : "No members assigned"}
                    </div>
                  </label>
                </div>
              )}
              
              {changesToApply.bookingMode && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-booking-mode"
                    checked={changesToApply.bookingMode}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, bookingMode: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-booking-mode"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Booking Type</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.bookingMode === "group" ? "Group Booking" : "1-to-1 Booking"}
                    </div>
                  </label>
                </div>
              )}
              
              {changesToApply.eventDuration && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-event-duration"
                    checked={changesToApply.eventDuration}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, eventDuration: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-event-duration"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Event Duration</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.eventDuration} minutes
                    </div>
                  </label>
                </div>
              )}
              
              {changesToApply.bufferTime && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-buffer-time"
                    checked={changesToApply.bufferTime}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, bufferTime: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-buffer-time"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Buffer Between Showings</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.bufferTime === 0 ? "No buffer" : `${pendingSaveData.bufferTime} minutes`}
                    </div>
                  </label>
                </div>
              )}
              
              {changesToApply.leadTime && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-lead-time"
                    checked={changesToApply.leadTime}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, leadTime: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-lead-time"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Minimum Lead Time</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.leadTime === 0 ? "No lead time" : formatReminderTime(pendingSaveData.leadTime)}
                    </div>
                  </label>
                </div>
              )}
              
              {changesToApply.reminderSettings && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-reminder-settings"
                    checked={changesToApply.reminderSettings}
                    onCheckedChange={(checked) => 
                      setChangesToApply(prev => ({ ...prev, reminderSettings: checked === true }))
                    }
                  />
                  <label
                    htmlFor="apply-reminder-settings"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Reminder Settings</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.reminderSettings?.enabled 
                        ? `${pendingSaveData.reminderSettings.count || 1} reminder(s) configured`
                        : "Reminders disabled"}
                    </div>
                  </label>
                </div>
              )}
              
              {pendingSaveData && changesToApply.bookingEnabled && (
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <Checkbox
                    id="apply-booking-enabled"
                    checked={changesToApply.bookingEnabled}
                    onCheckedChange={(checked) => setChangesToApply(prev => ({ ...prev, bookingEnabled: checked === true }))}
                  />
                  <label
                    htmlFor="apply-booking-enabled"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Public Booking</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pendingSaveData.bookingEnabled ? "Enabled" : "Disabled"}
                    </div>
                  </label>
                </div>
              )}
              
              {memberPreferencesEdited && (
                <div className="flex items-center space-x-2 p-3 border rounded-md bg-primary/5">
                  <Checkbox
                    id="apply-member-preferences"
                    checked={changesToApply.memberPreferences}
                    onCheckedChange={(checked) => setChangesToApply(prev => ({ ...prev, memberPreferences: checked === true }))}
                  />
                  <label
                    htmlFor="apply-member-preferences"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    <div className="font-semibold">Member Preferred Time Slots</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Copy property-level preferred times to unit-level settings
                    </div>
                  </label>
                </div>
              )}
              
              {!changesToApply.eventName && !changesToApply.eventDescription && !changesToApply.assignedMembers && 
               !changesToApply.eventDuration && !changesToApply.bufferTime && 
               !changesToApply.leadTime && !changesToApply.reminderSettings && !changesToApply.bookingEnabled && 
               !changesToApply.memberPreferences && (
                <p className="text-sm text-muted-foreground italic">
                  No changes detected.
                </p>
              )}
            </div>
          </div>
        )}
        
        <div className="flex flex-col gap-3 pt-2 flex-shrink-0 border-t">
          <p className="text-xs text-muted-foreground mb-1">
            Note: When you apply selected settings to units, those specific custom unit-level settings will be cleared and units will inherit the selected property-level settings.
          </p>
          <Button
            onClick={handleApplyToAllUnits}
            disabled={applyToUnitsMutation.isPending || (
              !changesToApply.eventName && !changesToApply.eventDescription && !changesToApply.assignedMembers &&
              !changesToApply.eventDuration && !changesToApply.bufferTime &&
              !changesToApply.leadTime && !changesToApply.reminderSettings && !changesToApply.bookingEnabled &&
              !changesToApply.memberPreferences
            )}
            data-testid="button-apply-to-all-units"
            className="w-full justify-start"
          >
            {applyToUnitsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to All Units
          </Button>
          <Button
            onClick={handleSelectUnits}
            disabled={applyToUnitsMutation.isPending || (
              !changesToApply.eventName && !changesToApply.eventDescription && !changesToApply.assignedMembers &&
              !changesToApply.eventDuration && !changesToApply.bufferTime &&
              !changesToApply.leadTime && !changesToApply.reminderSettings && !changesToApply.bookingEnabled &&
              !changesToApply.memberPreferences
            )}
            data-testid="button-select-units"
            variant="outline"
            className="w-full justify-start"
          >
            Select Specific Units
          </Button>
          <Button
            onClick={handleSkipApplyToUnits}
            disabled={applyToUnitsMutation.isPending}
            data-testid="button-skip-apply"
            variant="outline"
            className="w-full justify-start"
          >
            Don't Apply to Units
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>

    {/* Booking Toggle Confirmation Dialog */}
    <AlertDialog open={showBookingToggleDialog} onOpenChange={setShowBookingToggleDialog}>
      <AlertDialogContent data-testid="dialog-booking-toggle-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Disable Public Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Disabling public booking will prevent new showing bookings for this property and all its units.
            Existing scheduled showings will remain intact. You can re-enable booking at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => setShowBookingToggleDialog(false)}
            data-testid="button-cancel-booking-toggle"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={confirmBookingToggle}
            data-testid="button-confirm-booking-toggle"
          >
            Disable Booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Unit Selection Dialog */}
    <Dialog open={showUnitSelectionDialog} onOpenChange={setShowUnitSelectionDialog}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-unit-selection">
        <DialogHeader>
          <DialogTitle>Select Units</DialogTitle>
          <DialogDescription>
            Choose which units to apply the settings to
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {propertyUnits.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center space-x-3 p-3 border rounded-md hover-elevate"
              >
                <Checkbox
                  id={`unit-${unit.id}`}
                  checked={selectedUnitsForApply.includes(unit.id)}
                  onCheckedChange={() => toggleUnitSelection(unit.id)}
                  data-testid={`checkbox-unit-${unit.id}`}
                />
                <Label
                  htmlFor={`unit-${unit.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <p className="text-sm font-medium">Unit {unit.unitNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {unit.bedrooms} bed, {unit.bathrooms} bath
                  </p>
                </Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowUnitSelectionDialog(false);
              setShowApplyToUnitsDialog(true);
            }}
            data-testid="button-back-to-options"
          >
            Back
          </Button>
          <Button
            onClick={handleApplyToSelectedUnits}
            disabled={applyToUnitsMutation.isPending || selectedUnitsForApply.length === 0}
            data-testid="button-apply-to-selected"
          >
            {applyToUnitsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to {selectedUnitsForApply.length} Unit{selectedUnitsForApply.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
