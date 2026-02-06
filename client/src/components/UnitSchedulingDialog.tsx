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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Info, ChevronDown, ChevronUp, Clock, Plus, Trash2 } from "lucide-react";
import type { PropertySchedulingSettings, SchedulePreference, AssignedMember } from "@shared/schema";

interface UnitSchedulingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
}

export default function UnitSchedulingDialog({
  isOpen,
  onClose,
  unitId,
  unitNumber,
  propertyId,
  propertyName,
}: UnitSchedulingDialogProps) {
  const { toast } = useToast();
  
  const [customEventName, setCustomEventName] = useState<string>("");
  const [customEventDescription, setCustomEventDescription] = useState<string>("");
  const [useCustomEventName, setUseCustomEventName] = useState(false);
  const [useCustomEventDescription, setUseCustomEventDescription] = useState(false);
  const [assignedMembers, setAssignedMembers] = useState<AssignedMember[]>([]);
  const [useCustomAssignedMembers, setUseCustomAssignedMembers] = useState(false);
  
  // Additional custom settings
  const [useCustomBookingMode, setUseCustomBookingMode] = useState(false);
  const [customBookingMode, setCustomBookingMode] = useState<"one_to_one" | "group">("one_to_one");
  const [useCustomEventDuration, setUseCustomEventDuration] = useState(false);
  const [customEventDuration, setCustomEventDuration] = useState(30);
  const [useCustomBufferTime, setUseCustomBufferTime] = useState(false);
  const [customBufferTime, setCustomBufferTime] = useState(15);
  const [useCustomLeadTime, setUseCustomLeadTime] = useState(false);
  const [customLeadTime, setCustomLeadTime] = useState(120);
  const [useCustomReminderSettings, setUseCustomReminderSettings] = useState(false);
  const [customReminderEnabled, setCustomReminderEnabled] = useState(false);
  const [customReminderCount, setCustomReminderCount] = useState(1);
  const [customReminderTimes, setCustomReminderTimes] = useState<number[]>([1440]);
  const [customReminderMessage, setCustomReminderMessage] = useState("");
  const [customReminderEmail, setCustomReminderEmail] = useState(true);
  const [customReminderText, setCustomReminderText] = useState(false);
  const [unitBookingEnabled, setUnitBookingEnabled] = useState<boolean | undefined>(undefined);
  const [unitPreQualifyEnabled, setUnitPreQualifyEnabled] = useState<boolean | undefined>(undefined);
  const [memberPreferences, setMemberPreferences] = useState<Record<string, SchedulePreference[]>>({});
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [editingPreferences, setEditingPreferences] = useState<Record<string, Array<{
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }>>>({});
  const [savingPreferences, setSavingPreferences] = useState<Record<string, boolean>>({});

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

  // Fetch property-level settings for inheritance
  const { data: propertySettings } = useQuery<PropertySchedulingSettings | null>({
    queryKey: ["/api/properties", propertyId, "scheduling-settings"],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/scheduling-settings`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch property settings");
      }
      return response.json();
    },
    enabled: isOpen,
    refetchOnMount: true,
    staleTime: 0, // Always consider data stale to ensure fresh property settings are loaded
  });

  // Determine effective assigned members (custom or inherited from property)
  const effectiveAssignedMembers = useCustomAssignedMembers 
    ? assignedMembers 
    : normalizeAssignedMembers(propertySettings?.assignedMembers);

  // Fetch member preferences when assigned members change (for custom assigned members)
  // Pass unitId to get unit-level preferences (not property-level)
  const { data: bulkPreferences } = useQuery<SchedulePreference[]>({
    queryKey: ["/api/schedule/preferences/bulk", unitId, "unit-level", ...effectiveAssignedMembers.map(m => m.userId).sort()],
    queryFn: async () => {
      console.log("[UnitSchedulingDialog] Fetching unit-level preferences:", { unitId, propertyId, effectiveAssignedMembers });
      if (effectiveAssignedMembers.length === 0) return [];
      const userIds = effectiveAssignedMembers.map(m => m.userId);
      const response = await apiRequest("POST", "/api/schedule/preferences/bulk", { 
        userIds,
        propertyId,
        unitId, // Pass unitId to get unit-specific preferences
      });
      const data = await response.json();
      console.log("[UnitSchedulingDialog] Fetched unit-level preferences:", { count: data.length, data });
      return data;
    },
    enabled: effectiveAssignedMembers.length > 0 && isOpen && useCustomAssignedMembers,
    refetchOnMount: true,
    staleTime: 0, // Always consider stale to ensure fresh data after saves
  });

  // Fetch member preferences for inherited assigned members (property-level)
  // When inheriting from property, fetch PROPERTY-level preferences (no unitId)
  // This is the true inheritance model: units without custom overrides inherit from property
  // CRITICAL: Include unitId in query key to ensure each unit has its own cached query
  // Even though we're fetching property-level data, we need unit-specific cache keys
  const propertyAssignedMembers = normalizeAssignedMembers(propertySettings?.assignedMembers);
  const { data: inheritedBulkPreferences } = useQuery<SchedulePreference[]>({
    queryKey: ["/api/schedule/preferences/bulk", propertyId, unitId, "property-level-inherited", ...propertyAssignedMembers.map(m => m.userId).sort()],
    queryFn: async () => {
      console.log("[UnitSchedulingDialog] Fetching inherited property-level preferences:", { propertyId, propertyAssignedMembers });
      if (propertyAssignedMembers.length === 0) return [];
      const userIds = propertyAssignedMembers.map(m => m.userId);
      const response = await apiRequest("POST", "/api/schedule/preferences/bulk", { 
        userIds,
        propertyId,
        // Do NOT pass unitId - fetch property-level preferences for inheritance
      });
      const data = await response.json();
      console.log("[UnitSchedulingDialog] Fetched inherited property-level preferences:", { count: data.length, data });
      return data;
    },
    enabled: propertyAssignedMembers.length > 0 && isOpen && !useCustomAssignedMembers,
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 0, // Always consider stale to ensure fresh data after apply-to-units
    // CRITICAL: Ensure query refetches when dialog opens to get latest data
    // This prevents stale cached data from being used
    refetchOnReconnect: true,
  });

  // Fetch unit-level settings
  const { data: unitSettings, isLoading: unitSettingsLoading } = useQuery<{
    bookingEnabled: boolean;
    customEventName: string | null;
    customEventDescription: string | null;
    customAssignedMembers: AssignedMember[] | null;
    customBookingMode: string | null;
    customEventDuration: number | null;
    customBufferTime: number | null;
    customLeadTime: number | null;
    customReminderSettings: any | null;
  }>({
    queryKey: ["/api/units", unitId, "scheduling"],
    enabled: isOpen,
  });

  // Reset all state when unitId changes or dialog closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when dialog closes
      setCustomEventName("");
      setCustomEventDescription("");
      setAssignedMembers([]);
      setUseCustomEventName(false);
      setUseCustomEventDescription(false);
      setUseCustomAssignedMembers(false);
      setUseCustomBookingMode(false);
      setCustomBookingMode("one_to_one");
      setUseCustomEventDuration(false);
      setCustomEventDuration(30);
      setUseCustomBufferTime(false);
      setCustomBufferTime(15);
      setUseCustomLeadTime(false);
      setCustomLeadTime(120);
      setUseCustomReminderSettings(false);
      setCustomReminderEnabled(false);
      setCustomReminderCount(1);
      setCustomReminderTimes([1440]);
      setCustomReminderMessage("");
      setCustomReminderEmail(true);
      setCustomReminderText(false);
      setUnitBookingEnabled(undefined);
      setUnitPreQualifyEnabled(undefined);
      setMemberPreferences({});
      setInheritedMemberPreferences({});
      setExpandedMembers({});
      setEditingPreferences({});
      setSavingPreferences({});
      return;
    }
  }, [isOpen, unitId]);

  // Update form when settings load
  useEffect(() => {
    if (unitSettings && isOpen) {
      // Load bookingEnabled and preQualifyEnabled - if they exist, use them; otherwise inherited
      setUnitBookingEnabled(unitSettings.bookingEnabled);
      setUnitPreQualifyEnabled((unitSettings as any).preQualifyEnabled);
      setCustomEventName(unitSettings.customEventName || "");
      setCustomEventDescription(unitSettings.customEventDescription || "");
      setAssignedMembers(normalizeAssignedMembers(unitSettings.customAssignedMembers));
      
      setUseCustomEventName(!!unitSettings.customEventName);
      setUseCustomEventDescription(!!unitSettings.customEventDescription);
      setUseCustomAssignedMembers(!!unitSettings.customAssignedMembers);
      
      // Load additional custom settings - check for null/undefined explicitly
      const hasCustomBookingMode = unitSettings.customBookingMode !== null && unitSettings.customBookingMode !== undefined;
      setUseCustomBookingMode(hasCustomBookingMode);
      if (hasCustomBookingMode) {
        setCustomBookingMode(unitSettings.customBookingMode as "one_to_one" | "group");
      } else {
        setCustomBookingMode(propertySettings?.bookingMode === "group" ? "group" : "one_to_one");
      }
      
      const hasCustomEventDuration = unitSettings.customEventDuration !== null && unitSettings.customEventDuration !== undefined;
      setUseCustomEventDuration(hasCustomEventDuration);
      if (hasCustomEventDuration && unitSettings.customEventDuration !== null) {
        setCustomEventDuration(unitSettings.customEventDuration);
      } else {
        setCustomEventDuration(propertySettings?.eventDuration || 30);
      }
      
      const hasCustomBufferTime = unitSettings.customBufferTime !== null && unitSettings.customBufferTime !== undefined;
      setUseCustomBufferTime(hasCustomBufferTime);
      if (hasCustomBufferTime && unitSettings.customBufferTime !== null) {
        setCustomBufferTime(unitSettings.customBufferTime);
      } else {
        setCustomBufferTime(propertySettings?.bufferTime || 15);
      }
      
      const hasCustomLeadTime = unitSettings.customLeadTime !== null && unitSettings.customLeadTime !== undefined;
      setUseCustomLeadTime(hasCustomLeadTime);
      if (hasCustomLeadTime && unitSettings.customLeadTime !== null) {
        setCustomLeadTime(unitSettings.customLeadTime);
      } else {
        setCustomLeadTime(propertySettings?.leadTime || 120);
      }
      
      const hasCustomReminderSettings = unitSettings.customReminderSettings !== null && unitSettings.customReminderSettings !== undefined;
      setUseCustomReminderSettings(hasCustomReminderSettings);
      if (hasCustomReminderSettings && unitSettings.customReminderSettings) {
        const reminderSettings = unitSettings.customReminderSettings;
        setCustomReminderEnabled(reminderSettings.enabled || false);
        setCustomReminderCount(reminderSettings.count || 1);
        setCustomReminderTimes(reminderSettings.times || [1440]);
        setCustomReminderMessage(reminderSettings.message || "");
        setCustomReminderEmail(reminderSettings.email !== false);
        setCustomReminderText(reminderSettings.text || false);
      } else {
        // Unit doesn't have custom reminder settings - inherit from property
        const propertyReminderSettings = (propertySettings as any)?.reminderSettings;
        // If reminderSettings is null, reminders are disabled at property level
        if (propertyReminderSettings && propertyReminderSettings.enabled === true) {
          setCustomReminderEnabled(true);
          setCustomReminderCount(propertyReminderSettings.count || 1);
          setCustomReminderTimes(propertyReminderSettings.times || [1440]);
          setCustomReminderMessage(propertyReminderSettings.message || "");
          setCustomReminderEmail(propertyReminderSettings.email !== false);
          setCustomReminderText(propertyReminderSettings.text || false);
        } else {
          // Reminders are disabled at property level
          setCustomReminderEnabled(false);
          setCustomReminderCount(1);
          setCustomReminderTimes([1440]);
          setCustomReminderMessage("");
          setCustomReminderEmail(true);
          setCustomReminderText(false);
        }
      }
    } else if (!isOpen) {
      // Reset to defaults when unitSettings is not available and dialog is closed
      setUseCustomEventName(false);
      setUseCustomEventDescription(false);
      setUseCustomAssignedMembers(false);
      setUseCustomBookingMode(false);
      setUseCustomEventDuration(false);
      setUseCustomBufferTime(false);
      setUseCustomLeadTime(false);
      setUseCustomReminderSettings(false);
    }
  }, [unitSettings, propertySettings, isOpen, unitId]);

  // Update reminder settings when propertySettings changes (for units without custom reminder settings)
  // IMPORTANT: Only update when dialog is open for this specific unit to prevent resetting other units' settings
  // This effect should NOT run if the unit has custom reminder settings (those are loaded in the main effect above)
  useEffect(() => {
    // Only update if:
    // 1. Dialog is open
    // 2. Unit settings are loaded
    // 3. Unit doesn't have custom reminder settings (is inheriting from property)
    // 4. Property settings are available
    // 5. Unit settings explicitly show no custom reminder settings (null/undefined)
    if (isOpen && unitSettings && propertySettings) {
      // Check if unit actually has custom reminder settings in the database
      const hasCustomReminderSettings = unitSettings.customReminderSettings !== null && unitSettings.customReminderSettings !== undefined;
      
      // Only update if unit is inheriting (no custom settings) AND the checkbox is not checked
      if (!hasCustomReminderSettings && !useCustomReminderSettings) {
        const propertyReminderSettings = (propertySettings as any)?.reminderSettings || {};
        setCustomReminderEnabled(propertyReminderSettings.enabled || false);
        setCustomReminderCount(propertyReminderSettings.count || 1);
        setCustomReminderTimes(propertyReminderSettings.times || [1440]);
        setCustomReminderMessage(propertyReminderSettings.message || "");
        setCustomReminderEmail(propertyReminderSettings.email !== false);
        setCustomReminderText(propertyReminderSettings.text || false);
      }
    }
  }, [isOpen, propertySettings, unitSettings, useCustomReminderSettings]);

  // Organize preferences by user ID (for custom assigned members)
  // CRITICAL: This effect must run whenever bulkPreferences changes OR when useCustomAssignedMembers changes
  // to ensure preferences are loaded when switching from inherited to custom mode
  useEffect(() => {
    // Only process if we're using custom assigned members (unit-level preferences)
    if (!useCustomAssignedMembers) {
      // Clear member preferences when switching to inherited mode
      setMemberPreferences({});
      return;
    }
    
    if (bulkPreferences && bulkPreferences.length > 0) {
      const organized: Record<string, SchedulePreference[]> = {};
      bulkPreferences.forEach(pref => {
        // CRITICAL: Only include preferences that belong to THIS unit
        if (pref.userId && pref.unitId === unitId) {
          if (!organized[pref.userId]) {
            organized[pref.userId] = [];
          }
          organized[pref.userId].push(pref);
        }
      });
      console.log("[UnitSchedulingDialog] Organized unit-level preferences:", organized);
      setMemberPreferences(organized);
    } else {
      // Clear member preferences if query returns empty
      console.log("[UnitSchedulingDialog] No unit-level preferences found, clearing state");
      setMemberPreferences({});
    }
  }, [bulkPreferences, unitId, useCustomAssignedMembers]); // Include useCustomAssignedMembers

  // Store inherited preferences separately for display
  const [inheritedMemberPreferences, setInheritedMemberPreferences] = useState<Record<string, SchedulePreference[]>>({});
  
  useEffect(() => {
    // CRITICAL: Only process inherited preferences when NOT using custom assigned members
    // This prevents clearing inherited preferences when switching modes
    // Also ensure we process when dialog opens, even if data is from cache
    if (!useCustomAssignedMembers && isOpen) {
      if (inheritedBulkPreferences && inheritedBulkPreferences.length > 0) {
        const organized: Record<string, SchedulePreference[]> = {};
        inheritedBulkPreferences.forEach(pref => {
          // CRITICAL: Only include preferences that are property-level (unitId is null)
          // This ensures we're only showing inherited preferences, not unit-specific ones
          if (pref.userId && !pref.unitId) {
            if (!organized[pref.userId]) {
              organized[pref.userId] = [];
            }
            organized[pref.userId].push(pref);
          }
        });
        console.log("[UnitSchedulingDialog] Organized inherited preferences:", organized);
        setInheritedMemberPreferences(organized);
      } else if (inheritedBulkPreferences !== undefined) {
        // Query has completed but returned empty - clear state
        // Only clear if query has actually run (inheritedBulkPreferences is defined, even if empty)
        console.log("[UnitSchedulingDialog] No inherited preferences found, clearing state");
        setInheritedMemberPreferences({});
      }
      // If inheritedBulkPreferences is undefined, query hasn't run yet - don't clear state
    }
    // Don't clear when useCustomAssignedMembers is true - preserve state for when switching back
  }, [inheritedBulkPreferences, useCustomAssignedMembers, isOpen]); // Include isOpen to ensure processing when dialog opens

  // Sync editing preferences when member preferences data changes
  // This initializes editingPreferences from the current preferences (custom or inherited)
  // CRITICAL: Reset editingPreferences when unitId changes to prevent cross-unit contamination
  useEffect(() => {
    // Only sync when dialog is open and we have the correct mode
    if (!isOpen) return;
    
    // Determine which preferences to use based on useCustomAssignedMembers
    const sourcePreferences = useCustomAssignedMembers ? memberPreferences : inheritedMemberPreferences;
    
    // CRITICAL: When preferences change, update editingPreferences for ALL members in effectiveAssignedMembers
    // This ensures that when the dialog reopens, the preferences are properly initialized
    const allMemberIds = effectiveAssignedMembers.map(m => m.userId);
    
    console.log("[UnitSchedulingDialog] Syncing editingPreferences:", {
      useCustomAssignedMembers,
      sourceCount: Object.keys(sourcePreferences).length,
      memberIds: allMemberIds,
      sourcePreferences: Object.keys(sourcePreferences).reduce((acc, id) => {
        acc[id] = sourcePreferences[id].length;
        return acc;
      }, {} as Record<string, number>)
    });
    
    setEditingPreferences(prev => {
      const updated = { ...prev };
      
      // Update editingPreferences for all assigned members
      allMemberIds.forEach(memberId => {
        const existing = sourcePreferences[memberId] || [];
        // Always update if we have preferences, or if member is expanded (to show empty state)
        // This ensures preferences are loaded when dialog reopens
        if (existing.length > 0) {
          updated[memberId] = existing.map((p: SchedulePreference) => ({
            dayOfWeek: p.dayOfWeek,
            startTime: p.startTime,
            endTime: p.endTime,
          }));
          console.log(`[UnitSchedulingDialog] Updated editingPreferences for ${memberId}:`, updated[memberId].length, "preferences");
        } else if (expandedMembers[memberId]) {
          // Member is expanded but no preferences - set empty array to show empty state
          updated[memberId] = [];
        }
      });
      
      return updated;
    });
  }, [memberPreferences, inheritedMemberPreferences, effectiveAssignedMembers, useCustomAssignedMembers, unitId, expandedMembers, isOpen]); // Include isOpen

  const saveMutation = useMutation({
    mutationFn: async (data: {
      bookingEnabled?: boolean;
      preQualifyEnabled?: boolean;
      customEventName: string | null;
      customEventDescription: string | null;
      customAssignedMembers: AssignedMember[] | null;
      customBookingMode: string | null;
      customEventDuration: number | null;
      customBufferTime: number | null;
      customLeadTime: number | null;
      customReminderSettings: any | null;
    }) => {
      // Use the current unitId from props to ensure we're saving to the correct unit
      const currentUnitId = unitId;
      if (!currentUnitId) {
        throw new Error("Unit ID is required to save settings");
      }
      console.log(`[UnitSchedulingDialog] Saving settings for unit: ${currentUnitId}`, data);
      return await apiRequest("PATCH", `/api/units/${currentUnitId}/scheduling`, data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/units", unitId, "scheduling"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/with-listed-units"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      // CRITICAL: Only invalidate queries for THIS specific unit to prevent affecting other units
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences/bulk", unitId] });
      
      // If assigned members was set to null (because checkbox was checked but no members selected),
      // reset the checkbox state to reflect that it's now inheriting from property
      if (variables.customAssignedMembers === null) {
        setUseCustomAssignedMembers(false);
        setAssignedMembers([]);
      }
      
      // Clear local state so fresh data loads on next open
      setEditingPreferences({});
      setExpandedMembers({});
      setMemberPreferences({});
      setInheritedMemberPreferences({});
      
      toast({
        title: "Settings saved",
        description: "Unit scheduling settings have been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save unit scheduling settings",
      });
    },
  });

  const handleSave = async () => {
    // Ensure we're using the current unitId (defensive check)
    if (!unitId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unit ID is missing. Cannot save settings.",
      });
      return;
    }

    // If "Customize Assigned Team Members" is checked but no members are selected,
    // revert to inheriting from property level (set to null)
    const finalAssignedMembers = useCustomAssignedMembers 
      ? (assignedMembers.length > 0 ? assignedMembers : null)
      : null;

    // Save all member preferences that have been edited
    // Save preferences for all members that have entries in editingPreferences
    console.log("[UnitSchedulingDialog] handleSave - Saving preferences for members:", Object.keys(editingPreferences));
    const preferenceSavePromises = Object.keys(editingPreferences)
      .filter(memberId => {
        // Only save if user has permission to edit this member's preferences
        return canEditPreferences(memberId);
      })
      .map(async (memberId) => {
        try {
          const preferences = editingPreferences[memberId] || [];
          console.log(`[UnitSchedulingDialog] handleSave - Saving for member ${memberId}:`, { unitId, propertyId, preferences });
          await apiRequest("PUT", `/api/schedule/preferences/user/${memberId}`, {
            propertyId,
            unitId, // Pass unitId to save unit-specific preferences
            preferences,
          });
          console.log(`[UnitSchedulingDialog] handleSave - Saved preferences for member ${memberId}`);
          
          // Update state immediately so UI reflects changes without refresh
          // We'll update memberPreferences by merging with existing preferences that have full structure
          setMemberPreferences(prev => {
            const existing = prev[memberId] || [];
            // Create a map of existing preferences by dayOfWeek+startTime+endTime for quick lookup
            const existingMap = new Map(
              existing.map(p => [`${p.dayOfWeek}-${p.startTime}-${p.endTime}`, p])
            );
            
            // Merge saved preferences with existing full preference objects
            const updated = preferences.map(p => {
              const key = `${p.dayOfWeek}-${p.startTime}-${p.endTime}`;
              const existingPref = existingMap.get(key);
              if (existingPref) {
                // Keep existing full object but update fields
                return {
                  ...existingPref,
                  dayOfWeek: p.dayOfWeek,
                  startTime: p.startTime,
                  endTime: p.endTime,
                  isActive: true,
                };
              }
              // Create new preference object with required fields
              return {
                id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID until refetch
                createdAt: new Date(),
                userId: memberId,
                propertyId: propertyId,
                unitId: unitId,
                dayOfWeek: p.dayOfWeek,
                startTime: p.startTime,
                endTime: p.endTime,
                isActive: true,
              };
            });
            
            return {
              ...prev,
              [memberId]: updated,
            };
          });
          
          // Also update editingPreferences to match what was saved (so it persists if user reopens)
          setEditingPreferences(prev => ({
            ...prev,
            [memberId]: preferences,
          }));
        } catch (error: any) {
          console.error(`[UnitSchedulingDialog] Error saving preferences for member ${memberId}:`, error);
          // Don't throw - we'll continue saving other preferences and unit settings
          // But show a warning toast
          const member = orgMembers.find(m => m.id === memberId);
          const memberName = member ? getMemberName(member) : `member ${memberId}`;
          toast({
            variant: "destructive",
            title: "Warning",
            description: `Failed to save preferences for ${memberName}. Other settings were saved.`,
          });
        }
      });

    // Wait for all preference saves to complete (or fail gracefully)
    await Promise.allSettled(preferenceSavePromises);

    // CRITICAL: Only invalidate queries for THIS specific unit to prevent affecting other units
    queryClient.invalidateQueries({ queryKey: ["/api/schedule/preferences/bulk", unitId] });

    // Now save the unit settings
    saveMutation.mutate({
      // Only include bookingEnabled and preQualifyEnabled if they were explicitly changed
      bookingEnabled: unitBookingEnabled !== undefined ? unitBookingEnabled : undefined,
      preQualifyEnabled: unitPreQualifyEnabled !== undefined ? unitPreQualifyEnabled : undefined,
      customEventName: useCustomEventName ? customEventName : null,
      customEventDescription: useCustomEventDescription ? customEventDescription : null,
      customAssignedMembers: finalAssignedMembers,
      customBookingMode: useCustomBookingMode ? customBookingMode : null,
      customEventDuration: useCustomEventDuration ? customEventDuration : null,
      customBufferTime: useCustomBufferTime ? customBufferTime : null,
      customLeadTime: useCustomLeadTime ? customLeadTime : null,
      customReminderSettings: useCustomReminderSettings ? {
        enabled: customReminderEnabled,
        times: customReminderTimes,
        message: customReminderMessage,
        email: customReminderEmail,
        text: customReminderText,
        count: customReminderCount,
      } : null,
    });
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

  const getPropertyEventName = () => {
    return propertySettings?.eventName || `Showing for ${propertyName}`;
  };

  const getPropertyEventDescription = () => {
    return propertySettings?.eventDescription || "";
  };

  const getPropertyAssignedMembers = () => {
    return (propertySettings?.assignedMembers as AssignedMember[]) || [];
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

  const getPropertyBookingMode = () => {
    return propertySettings?.bookingMode === "group" ? "Group Booking" : "1-to-1 Booking";
  };

  const getPropertyEventDuration = () => {
    return propertySettings?.eventDuration || 30;
  };

  const getPropertyBufferTime = () => {
    return propertySettings?.bufferTime || 15;
  };

  const getPropertyLeadTime = () => {
    return propertySettings?.leadTime || 120;
  };

  const getPropertyReminderSettings = () => {
    const reminderSettings = (propertySettings as any)?.reminderSettings;
    // Return null if reminderSettings is null/undefined (reminders disabled)
    // Return the object if it exists
    return reminderSettings || null;
  };

  const getPropertyBookingEnabled = () => {
    return propertySettings?.bookingEnabled ?? true;
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

  // Helper to format time for display
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

  const getMemberPreferencesSummary = (memberId: string) => {
    // ALWAYS check the correct source based on whether we're using custom or inherited
    let prefs: SchedulePreference[] = [];
    
    if (useCustomAssignedMembers) {
      // When using custom assigned members, use unit-level preferences
      prefs = memberPreferences[memberId] || [];
    } else {
      // When inheriting, use property-level preferences
      prefs = inheritedMemberPreferences[memberId] || [];
    }
    
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

  const initializeEditingPreferences = (memberId: string) => {
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
    setEditingPreferences(prev => ({
      ...prev,
      [memberId]: [
        ...(prev[memberId] || []),
        { dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00' }
      ]
    }));
  };

  const removeTimeSlot = (memberId: string, index: number) => {
    setEditingPreferences(prev => ({
      ...prev,
      [memberId]: (prev[memberId] || []).filter((_, i) => i !== index)
    }));
  };

  const updateTimeSlot = (memberId: string, index: number, field: 'dayOfWeek' | 'startTime' | 'endTime', value: string) => {
    setEditingPreferences(prev => ({
      ...prev,
      [memberId]: (prev[memberId] || []).map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const saveMemberPreferences = async (memberId: string) => {
    setSavingPreferences(prev => ({ ...prev, [memberId]: true }));
    
    try {
      const preferences = editingPreferences[memberId] || [];
      console.log("[UnitSchedulingDialog] Saving preferences:", { unitId, propertyId, memberId, preferences, useCustomAssignedMembers });
      
      // Only save if we're using custom assigned members (unit-level preferences)
      // If inheriting, preferences should be saved at property level, not unit level
      if (!useCustomAssignedMembers) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Cannot save preferences when inheriting from property. Enable 'Customize Assigned Team Members' first.",
        });
        return;
      }
      
      const response = await apiRequest("PUT", `/api/schedule/preferences/user/${memberId}`, {
        propertyId,
        unitId, // Pass unitId to save unit-specific preferences
        preferences,
      });
      
      const savedPreferences = await response.json();
      console.log("[UnitSchedulingDialog] Saved preferences response:", savedPreferences);
      
      // CRITICAL: Verify that saved preferences belong to THIS unit
      // Filter out any preferences that don't match the current unitId
      const validPreferences = savedPreferences.filter((p: SchedulePreference) => {
        const matchesUnit = p.unitId === unitId;
        if (!matchesUnit) {
          console.warn(`[UnitSchedulingDialog] Filtered out preference with wrong unitId:`, p);
        }
        return matchesUnit;
      });
      
      console.log("[UnitSchedulingDialog] Valid preferences for this unit:", validPreferences);
      
      // Update state IMMEDIATELY so UI reflects changes without refresh
      setMemberPreferences(prev => ({
        ...prev,
        [memberId]: validPreferences.map((p: SchedulePreference) => ({
          ...p,
          // Ensure all required fields are present and correct
          id: p.id,
          createdAt: p.createdAt || new Date(),
          userId: p.userId || memberId,
          propertyId: p.propertyId || propertyId,
          unitId: unitId, // CRITICAL: Force unitId to match current unit
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
          isActive: p.isActive !== null && p.isActive !== undefined ? p.isActive : true,
        }))
      }));
      
      // Also update editingPreferences to match what was saved (so it persists)
      setEditingPreferences(prev => ({
        ...prev,
        [memberId]: validPreferences.map((p: SchedulePreference) => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        }))
      }));
      
      // CRITICAL: Only invalidate queries for THIS specific unit
      // This prevents other units from being affected
      queryClient.invalidateQueries({ 
        queryKey: ["/api/schedule/preferences/bulk", unitId, "unit-level"] 
      });
      // Also invalidate the specific query for this unit and these members
      queryClient.invalidateQueries({ 
        queryKey: ["/api/schedule/preferences/bulk", unitId, "unit-level", ...effectiveAssignedMembers.map(m => m.userId).sort()] 
      });
      
      toast({
        title: "Preferences saved",
        description: `Schedule preferences for ${getMemberName(orgMembers.find(m => m.id === memberId)!)} have been updated.`,
      });
      
      // Keep expanded so user can see the saved state immediately
    } catch (error: any) {
      console.error("[UnitSchedulingDialog] Error saving preferences:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save member preferences",
      });
    } finally {
      setSavingPreferences(prev => ({ ...prev, [memberId]: false }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] lg:max-w-[800px] max-h-[95vh] flex flex-col" data-testid="dialog-unit-scheduling">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle data-testid="text-dialog-title">Unit Scheduling Settings</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Configure scheduling settings for {propertyName} - Unit {unitNumber}
          </DialogDescription>
        </DialogHeader>

        {unitSettingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Info about inheritance */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                By default, units inherit scheduling settings from the property level. 
                Enable customization below to override specific settings for this unit.
              </p>
            </div>

            {/* Public Booking - Editable at Unit Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-5 border rounded-md bg-muted/20">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="booking-enabled-unit" className="text-base">Enable Booking</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow prospects to book showings for this unit
                  </p>
                  {!unitSettings?.bookingEnabled && unitSettings?.bookingEnabled !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Currently disabled for this unit
                    </p>
                  )}
                  {unitSettings?.bookingEnabled === undefined && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Inherited from property: {getPropertyBookingEnabled() ? "Enabled" : "Disabled"}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="booking-enabled-unit"
                    checked={unitBookingEnabled !== undefined ? unitBookingEnabled : (unitSettings?.bookingEnabled ?? getPropertyBookingEnabled())}
                    onCheckedChange={(checked) => {
                      // Update the unit's bookingEnabled directly
                      // We'll save this in handleSave
                      setUnitBookingEnabled(checked);
                    }}
                    data-testid="switch-booking-enabled-unit"
                  />
                </div>
              </div>
            </div>

            {/* Pre-Qualification - Editable at Unit Level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-5 border rounded-md bg-muted/20">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="pre-qualify-enabled-unit" className="text-base">Pre-Qualification</Label>
                  <p className="text-sm text-muted-foreground">
                    Require leads to complete pre-qualification before booking
                  </p>
                  {(unitSettings as any)?.preQualifyEnabled === undefined && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Inherited from property: {(propertySettings as any)?.preQualifyEnabled ? "Enabled" : "Disabled"}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="pre-qualify-enabled-unit"
                    checked={unitPreQualifyEnabled !== undefined ? unitPreQualifyEnabled : ((unitSettings as any)?.preQualifyEnabled ?? (propertySettings as any)?.preQualifyEnabled ?? false)}
                    onCheckedChange={(checked) => {
                      setUnitPreQualifyEnabled(checked);
                    }}
                    data-testid="switch-pre-qualify-enabled-unit"
                  />
                </div>
              </div>
            </div>

            {/* Custom Event Name */}
            <div className="space-y-3">
              <div className="bg-muted/50 p-3 rounded-md border border-muted">
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{unit_number}"}, {"{bedrooms}"}, {"{bathrooms}"}, {"{unit_rent}"}, {"{security_deposit}"}, {"{property_amenities}"}, {"{property_address}"}, {"{property_name}"}. You can customize the event name and event description with these variables.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-event-name"
                  checked={useCustomEventName}
                  onCheckedChange={(checked) => setUseCustomEventName(checked as boolean)}
                  data-testid="checkbox-use-custom-event-name"
                />
                <Label htmlFor="use-custom-event-name" className="cursor-pointer">
                  Customize Event Name
                </Label>
              </div>
              
              {useCustomEventName ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-event-name">Event Name</Label>
                  <Input
                    id="custom-event-name"
                    data-testid="input-custom-event-name"
                    placeholder="Enter custom event name..."
                    value={customEventName}
                    onChange={(e) => setCustomEventName(e.target.value)}
                    maxLength={55}
                  />
                </div>
              ) : (
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-muted-foreground">Inherited from property:</p>
                  <p className="text-sm font-medium">{getPropertyEventName()}</p>
                </div>
              )}
            </div>

            {/* Custom Event Description */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-event-description"
                  checked={useCustomEventDescription}
                  onCheckedChange={(checked) => setUseCustomEventDescription(checked as boolean)}
                  data-testid="checkbox-use-custom-event-description"
                />
                <Label htmlFor="use-custom-event-description" className="cursor-pointer">
                  Customize Event Description
                </Label>
              </div>
              
              {useCustomEventDescription ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-event-description">Event Description</Label>
                  <Textarea
                    id="custom-event-description"
                    data-testid="textarea-custom-event-description"
                    placeholder="Enter custom event description..."
                    value={customEventDescription}
                    onChange={(e) => setCustomEventDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              ) : (
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-muted-foreground">Inherited from property:</p>
                  <p className="text-sm">{getPropertyEventDescription() || <span className="italic text-muted-foreground">No description set</span>}</p>
                </div>
              )}
            </div>

            {/* Custom Event Duration */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-event-duration"
                  checked={useCustomEventDuration}
                  onCheckedChange={(checked) => setUseCustomEventDuration(checked as boolean)}
                />
                <Label htmlFor="use-custom-event-duration" className="cursor-pointer">
                  Customize Event Duration
                </Label>
              </div>
              
              {useCustomEventDuration ? (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="custom-event-duration">Event Duration</Label>
                  <Select
                    value={customEventDuration.toString()}
                    onValueChange={(v) => setCustomEventDuration(parseInt(v))}
                  >
                    <SelectTrigger id="custom-event-duration">
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
              ) : (
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-muted-foreground">Inherited from property:</p>
                  <p className="text-sm font-medium">{getPropertyEventDuration()} minutes</p>
                </div>
              )}
            </div>

            {/* Custom Buffer Time */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-buffer-time"
                  checked={useCustomBufferTime}
                  onCheckedChange={(checked) => setUseCustomBufferTime(checked as boolean)}
                />
                <Label htmlFor="use-custom-buffer-time" className="cursor-pointer">
                  Customize Buffer Between Showings
                </Label>
              </div>
              
              {useCustomBufferTime ? (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="custom-buffer-time">Buffer Between Showings</Label>
                  <Select
                    value={customBufferTime.toString()}
                    onValueChange={(v) => setCustomBufferTime(parseInt(v))}
                  >
                    <SelectTrigger id="custom-buffer-time">
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
              ) : (
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-muted-foreground">Inherited from property:</p>
                  <p className="text-sm font-medium">
                    {getPropertyBufferTime() === 0 ? "No buffer" : `${getPropertyBufferTime()} minutes`}
                  </p>
                </div>
              )}
            </div>

            {/* Custom Lead Time */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-lead-time"
                  checked={useCustomLeadTime}
                  onCheckedChange={(checked) => setUseCustomLeadTime(checked as boolean)}
                />
                <Label htmlFor="use-custom-lead-time" className="cursor-pointer">
                  Customize Minimum Lead Time
                </Label>
              </div>
              
              {useCustomLeadTime ? (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="custom-lead-time">Minimum Lead Time</Label>
                  <Select
                    value={customLeadTime.toString()}
                    onValueChange={(v) => setCustomLeadTime(parseInt(v))}
                  >
                    <SelectTrigger id="custom-lead-time">
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
              ) : (
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-muted-foreground">Inherited from property:</p>
                  <p className="text-sm font-medium">
                    {getPropertyLeadTime() === 0 ? "No lead time" : formatReminderTime(getPropertyLeadTime())}
                  </p>
                </div>
              )}
            </div>

            {/* Custom Assigned Members */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-assigned-members"
                  checked={useCustomAssignedMembers}
                  onCheckedChange={(checked) => setUseCustomAssignedMembers(checked as boolean)}
                  data-testid="checkbox-use-custom-assigned-members"
                />
                <Label htmlFor="use-custom-assigned-members" className="cursor-pointer">
                  Customize Assigned Team Members
                </Label>
              </div>
              
              {useCustomAssignedMembers ? (
                <div className="space-y-3">
                  <Label>Assigned Team Members</Label>
                  <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md mb-2">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Assign team members to handle showings. Use the priority setting (1=highest) to control auto-assignment order when bookings are created.
                    </p>
                  </div>
                  <div className="border rounded-md p-3 space-y-2 max-h-64 overflow-y-auto">
                    {orgMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No team members available</p>
                    ) : (
                      orgMembers.map((member) => {
                        const assignedMember = assignedMembers.find(m => m.userId === member.id);
                        const isAssigned = !!assignedMember;
                        
                        return (
                          <div key={member.id} className="flex items-center gap-2">
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
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Priority:</Label>
                                <Select
                                  value={assignedMember!.priority.toString()}
                                  onValueChange={(v) => updateMemberPriority(member.id, parseInt(v))}
                                >
                                  <SelectTrigger className="h-8 w-20" data-testid={`select-priority-${member.id}`}>
                                    <SelectValue />
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
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {effectiveAssignedMembers.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-sm">Member Schedule Preferences</Label>
                      {effectiveAssignedMembers.map((assignedMember) => {
                        const memberId = assignedMember.userId;
                        const member = orgMembers.find(m => m.id === memberId);
                        if (!member) return null;
                        const isExpanded = expandedMembers[memberId];
                        
                        // Get the correct preferences based on whether we're using custom or inherited
                        let currentPrefs: SchedulePreference[] = [];
                        if (useCustomAssignedMembers) {
                          // Use unit-level preferences when custom
                          currentPrefs = memberPreferences[memberId] || [];
                        } else {
                          // Use property-level preferences when inheriting
                          currentPrefs = inheritedMemberPreferences[memberId] || [];
                        }
                        
                        // Get editing preferences (what user is currently editing)
                        // If editingPreferences exists, use it; otherwise initialize from current preferences
                        const slots = editingPreferences[memberId] || currentPrefs.map(p => ({
                          dayOfWeek: p.dayOfWeek,
                          startTime: p.startTime,
                          endTime: p.endTime,
                        }));

                        return (
                          <div key={memberId} className="border rounded-md overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleMemberExpanded(memberId)}
                              className="w-full p-3 flex items-center justify-between hover-elevate active-elevate-2 bg-muted/30"
                              data-testid={`button-expand-member-${memberId}`}
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{getMemberName(member)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {getMemberPreferencesSummary(memberId)}
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="p-3 space-y-3 border-t">
                                {!canEditPreferences(memberId) && (
                                  <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">
                                      You can only edit your own schedule preferences unless you're an admin or property manager.
                                    </p>
                                  </div>
                                )}

                                {slots.length === 0 && (
                                  <p className="text-sm text-muted-foreground text-center py-2">
                                    No time slots configured
                                  </p>
                                )}

                                {slots.map((slot, index) => (
                                  <div key={index} className="flex items-end gap-2">
                                    <div className="flex-1 space-y-1.5">
                                      <Label className="text-xs">Day</Label>
                                      <Select
                                        value={slot.dayOfWeek}
                                        onValueChange={(value) => updateTimeSlot(memberId, index, 'dayOfWeek', value)}
                                        disabled={!canEditPreferences(memberId)}
                                      >
                                        <SelectTrigger className="h-9" data-testid={`select-day-${memberId}-${index}`}>
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
                                    </div>

                                    <div className="flex-1 space-y-1.5">
                                      <Label className="text-xs">Start Time</Label>
                                      <Input
                                        type="time"
                                        value={slot.startTime}
                                        onChange={(e) => updateTimeSlot(memberId, index, 'startTime', e.target.value)}
                                        disabled={!canEditPreferences(memberId)}
                                        className="h-9"
                                        data-testid={`input-start-time-${memberId}-${index}`}
                                      />
                                    </div>

                                    <div className="flex-1 space-y-1.5">
                                      <Label className="text-xs">End Time</Label>
                                      <Input
                                        type="time"
                                        value={slot.endTime}
                                        onChange={(e) => updateTimeSlot(memberId, index, 'endTime', e.target.value)}
                                        disabled={!canEditPreferences(memberId)}
                                        className="h-9"
                                        data-testid={`input-end-time-${memberId}-${index}`}
                                      />
                                    </div>

                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeTimeSlot(memberId, index)}
                                      disabled={!canEditPreferences(memberId)}
                                      data-testid={`button-remove-slot-${memberId}-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimeSlot(memberId)}
                                  disabled={!canEditPreferences(memberId)}
                                  className="w-full"
                                  data-testid={`button-add-slot-${memberId}`}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Time Slot
                                </Button>

                                {canEditPreferences(memberId) && editingPreferences[memberId] && editingPreferences[memberId].length > 0 && (
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={() => saveMemberPreferences(memberId)}
                                    disabled={savingPreferences[memberId]}
                                    className="w-full"
                                    data-testid={`button-save-preferences-${memberId}`}
                                  >
                                    {savingPreferences[memberId] ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        Saving...
                                      </>
                                    ) : (
                                      <>
                                        Save Preferences
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-muted-foreground">Inherited from property:</p>
                  {getPropertyAssignedMembers().length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">No members assigned</p>
                  ) : (
                    <div className="space-y-3">
                      {getPropertyAssignedMembers().map((assignedMember) => {
                        const member = orgMembers.find((m) => m.id === assignedMember.userId);
                        // CRITICAL: Always get preferences from state, but also check query data as fallback
                        // This ensures preferences show even if state hasn't been updated yet (race condition fix)
                        let memberPrefs = inheritedMemberPreferences[assignedMember.userId] || [];
                        
                        // Fallback: If state is empty but query has data, organize it on-the-fly
                        // This handles the case where the dialog reopens and query returns cached data
                        // before the state organization effect runs
                        if (memberPrefs.length === 0 && inheritedBulkPreferences && inheritedBulkPreferences.length > 0) {
                          const organized = inheritedBulkPreferences
                            .filter((pref: SchedulePreference) => pref.userId === assignedMember.userId && !pref.unitId)
                            .map((pref: SchedulePreference) => pref);
                          if (organized.length > 0) {
                            memberPrefs = organized;
                            console.log(`[UnitSchedulingDialog] Fallback: Found ${organized.length} preferences for ${assignedMember.userId} from query data`);
                          }
                        }
                        
                        const hasPreferences = memberPrefs.length > 0;
                        
                        return member ? (
                          <div key={assignedMember.userId} className="space-y-2">
                            <p className="text-sm">
                              {getMemberName(member)} <span className="text-xs text-muted-foreground">(Priority: {assignedMember.priority})</span>
                            </p>
                            {hasPreferences && (
                              <div className="ml-4 pl-3 border-l-2 border-muted space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">Time slots:</p>
                                <div className="space-y-1">
                                  {memberPrefs.map((pref, idx) => (
                                    <div key={idx} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                      <span className="capitalize">{pref.dayOfWeek}</span>: {formatTimeForDisplay(pref.startTime)} - {formatTimeForDisplay(pref.endTime)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {!hasPreferences && (
                              <p className="text-xs text-muted-foreground italic ml-4">No time slots configured</p>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom Reminder Settings */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-custom-reminder-settings"
                  checked={useCustomReminderSettings}
                  onCheckedChange={(checked) => setUseCustomReminderSettings(!!checked)}
                />
                <Label htmlFor="use-custom-reminder-settings" className="cursor-pointer">
                  Customize Reminder Settings
                </Label>
              </div>
              
              {useCustomReminderSettings ? (
                <div className="space-y-4 pl-6 pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="custom-reminder-enabled"
                      checked={customReminderEnabled}
                      onCheckedChange={(checked) => setCustomReminderEnabled(!!checked)}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="custom-reminder-enabled" className="text-base cursor-pointer">Send Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically send reminders before scheduled showings
                      </p>
                    </div>
                  </div>

                  {customReminderEnabled && (
                    <div className="space-y-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label htmlFor="custom-reminder-count">Number of Reminders</Label>
                        <Select
                          value={customReminderCount.toString()}
                          onValueChange={(v) => {
                            const newCount = parseInt(v);
                            setCustomReminderCount(newCount);
                            setCustomReminderTimes(prev => {
                              if (prev.length < newCount) {
                                const defaultTimes = [1440, 720, 360, 180, 60, 30, 15];
                                const newTimes = [...prev];
                                for (let i = prev.length; i < newCount; i++) {
                                  newTimes.push(defaultTimes[i] || 1440);
                                }
                                return newTimes;
                              } else {
                                return prev.slice(0, newCount);
                              }
                            });
                          }}
                        >
                          <SelectTrigger id="custom-reminder-count">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 reminder</SelectItem>
                            <SelectItem value="2">2 reminders</SelectItem>
                            <SelectItem value="3">3 reminders</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        {Array.from({ length: customReminderCount }).map((_, index) => (
                          <div key={index} className="space-y-2">
                            <Label htmlFor={`custom-reminder-time-${index}`}>
                              Reminder {index + 1} - Time Before Showing
                            </Label>
                            <Select
                              value={customReminderTimes[index]?.toString() || "1440"}
                              onValueChange={(v) => {
                                setCustomReminderTimes(prev => {
                                  const newTimes = [...prev];
                                  newTimes[index] = parseInt(v);
                                  return newTimes;
                                });
                              }}
                            >
                              <SelectTrigger id={`custom-reminder-time-${index}`}>
                                <SelectValue>
                                  {formatReminderTime(customReminderTimes[index] || 1440)}
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

                      <div className="space-y-2">
                        <Label htmlFor="custom-reminder-message">Reminder Message</Label>
                        <Textarea
                          id="custom-reminder-message"
                          placeholder="Hi {name}, this is a reminder that you have an appointment at the property {property_name}..."
                          value={customReminderMessage}
                          onChange={(e) => setCustomReminderMessage(e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                          Available variables: <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{name}"}</code>,{" "}
                          <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{property_name}"}</code>,{" "}
                          <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{date}"}</code>,{" "}
                          <code className="px-1 py-0.5 bg-muted rounded text-xs">{"{time}"}</code>
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Send Via</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="custom-reminder-email"
                              checked={customReminderEmail}
                              onCheckedChange={(checked) => setCustomReminderEmail(checked === true)}
                            />
                            <label
                              htmlFor="custom-reminder-email"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              Email
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="custom-reminder-text"
                              checked={customReminderText}
                              onCheckedChange={(checked) => setCustomReminderText(checked === true)}
                              disabled={true}
                            />
                            <label
                              htmlFor="custom-reminder-text"
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
              ) : (
                <div className="pl-6 space-y-1">
                  <p className="text-sm text-muted-foreground">Inherited from property:</p>
                  {(() => {
                    const reminderSettings = getPropertyReminderSettings();
                    // Check if reminderSettings exists and is enabled
                    // If reminderSettings is null, it means reminders are disabled at property level
                    if (reminderSettings && reminderSettings.enabled === true) {
                      return (
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{reminderSettings.count || 1} reminder(s) configured</p>
                          {reminderSettings.times && Array.isArray(reminderSettings.times) && reminderSettings.times.length > 0 && (
                            <div className="pl-2 space-y-0.5 text-xs text-muted-foreground">
                              {reminderSettings.times.map((time: number, index: number) => (
                                <p key={index}>
                                  Reminder {index + 1}: {formatReminderTime(time)} before
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    // If reminderSettings is null, undefined, or enabled is false, show disabled
                    return <p className="text-sm font-medium italic text-muted-foreground">Reminders disabled</p>;
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
