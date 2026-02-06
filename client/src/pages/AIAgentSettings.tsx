import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Zap, Clock, AlertCircle, User, MessageSquare, Shield, Timer, Ban } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

function AIAgentSettings() {
  const { toast } = useToast();
  
  // Auto-Pilot Mode settings state
  const [autoPilotEnabled, setAutoPilotEnabled] = useState<boolean>(false);
  const [autoPilotQuestionTypes, setAutoPilotQuestionTypes] = useState<string[]>([]);
  const [autoPilotMinConfidence, setAutoPilotMinConfidence] = useState<string>("high");
  const [autoPilotBusinessHoursEnabled, setAutoPilotBusinessHoursEnabled] = useState<boolean>(false);
  const [autoPilotBusinessHoursStart, setAutoPilotBusinessHoursStart] = useState<string>("09:00");
  const [autoPilotBusinessHoursEnd, setAutoPilotBusinessHoursEnd] = useState<string>("17:00");
  const [autoPilotBusinessDays, setAutoPilotBusinessDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  
  // New settings state
  const [followUpEnabled, setFollowUpEnabled] = useState<boolean>(false);
  const [followUpDelayHours, setFollowUpDelayHours] = useState<string>("24");
  const [preQualifyEnabled, setPreQualifyEnabled] = useState<boolean>(false);
  const [dailyMessageLimit, setDailyMessageLimit] = useState<string>("50");
  const [responseDelayMinutes, setResponseDelayMinutes] = useState<string>("5");
  const [officeHoursOnly, setOfficeHoursOnly] = useState<boolean>(false);
  const [escalationKeywords, setEscalationKeywords] = useState<string>("");
  const [agentName, setAgentName] = useState<string>("AI Leasing Agent");
  
  const [isSavingAutoPilot, setIsSavingAutoPilot] = useState(false);

  // Fetch automation/auto-pilot settings
  const { data: automationSettings, isLoading: isLoadingAutoPilot } = useQuery({
    queryKey: ["/api/ai-settings/automation"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/automation");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch general AI settings (for agent name, follow-up, etc.)
  const { data: generalSettings } = useQuery({
    queryKey: ["/api/ai-settings/general"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/general");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Load auto-pilot settings into state
  useEffect(() => {
    if (automationSettings && automationSettings.length > 0) {
      const settingsMap = automationSettings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
      setAutoPilotEnabled(settingsMap.auto_pilot_mode === "true" || settingsMap.auto_pilot_mode === true);
      
      // Parse question types (stored as comma-separated string or array)
      const questionTypes = settingsMap.auto_pilot_question_types;
      if (questionTypes) {
        if (typeof questionTypes === "string") {
          setAutoPilotQuestionTypes(questionTypes.split(",").filter(Boolean));
        } else if (Array.isArray(questionTypes)) {
          setAutoPilotQuestionTypes(questionTypes);
        }
      }
      
      setAutoPilotMinConfidence(settingsMap.auto_pilot_min_confidence || "high");
      setAutoPilotBusinessHoursEnabled(settingsMap.auto_pilot_business_hours_enabled === "true" || settingsMap.auto_pilot_business_hours_enabled === true);
      setAutoPilotBusinessHoursStart(settingsMap.auto_pilot_business_hours_start || "09:00");
      setAutoPilotBusinessHoursEnd(settingsMap.auto_pilot_business_hours_end || "17:00");
      
      // Parse business days
      const businessDays = settingsMap.auto_pilot_business_days;
      if (businessDays) {
        if (typeof businessDays === "string") {
          setAutoPilotBusinessDays(businessDays.split(",").filter(Boolean));
        } else if (Array.isArray(businessDays)) {
          setAutoPilotBusinessDays(businessDays);
        }
      }

      // New settings
      setFollowUpEnabled(settingsMap.follow_up_enabled === "true" || settingsMap.follow_up_enabled === true);
      setFollowUpDelayHours(settingsMap.follow_up_delay_hours || "24");
      setPreQualifyEnabled(settingsMap.pre_qualify_enabled === "true" || settingsMap.pre_qualify_enabled === true);
      setDailyMessageLimit(settingsMap.daily_message_limit || "50");
      setResponseDelayMinutes(settingsMap.response_delay_minutes || "5");
      setOfficeHoursOnly(settingsMap.office_hours_only === "true" || settingsMap.office_hours_only === true);
      setEscalationKeywords(settingsMap.escalation_keywords || "");
    }
  }, [automationSettings]);

  // Load general settings
  useEffect(() => {
    if (generalSettings && generalSettings.length > 0) {
      const settingsMap = generalSettings.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
      setAgentName(settingsMap.agent_name || "AI Leasing Agent");
    }
  }, [generalSettings]);

  // Save auto-pilot settings mutation
  const saveAutoPilotMutation = useMutation({
    mutationFn: async (settings: Array<{ category: string; key: string; value: string }>) => {
      await Promise.all(
        settings.map((setting) =>
          apiRequest("POST", "/api/ai-settings", setting)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-settings/automation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-settings/general"] });
      toast({
        title: "Settings saved",
        description: "AI Leasing Agent settings have been updated successfully.",
      });
      setIsSavingAutoPilot(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save auto-pilot settings",
        variant: "destructive",
      });
      setIsSavingAutoPilot(false);
    },
  });

  const handleSaveAutoPilot = async () => {
    setIsSavingAutoPilot(true);
    const settings = [
      { category: "automation", key: "auto_pilot_mode", value: autoPilotEnabled ? "true" : "false" },
      { category: "automation", key: "auto_pilot_question_types", value: autoPilotQuestionTypes.join(",") },
      { category: "automation", key: "auto_pilot_min_confidence", value: autoPilotMinConfidence },
      { category: "automation", key: "auto_pilot_business_hours_enabled", value: autoPilotBusinessHoursEnabled ? "true" : "false" },
      { category: "automation", key: "auto_pilot_business_hours_start", value: autoPilotBusinessHoursStart },
      { category: "automation", key: "auto_pilot_business_hours_end", value: autoPilotBusinessHoursEnd },
      { category: "automation", key: "auto_pilot_business_days", value: autoPilotBusinessDays.join(",") },
      // New settings
      { category: "automation", key: "follow_up_enabled", value: followUpEnabled ? "true" : "false" },
      { category: "automation", key: "follow_up_delay_hours", value: followUpDelayHours },
      { category: "automation", key: "pre_qualify_enabled", value: preQualifyEnabled ? "true" : "false" },
      { category: "automation", key: "daily_message_limit", value: dailyMessageLimit },
      { category: "automation", key: "response_delay_minutes", value: responseDelayMinutes },
      { category: "automation", key: "office_hours_only", value: officeHoursOnly ? "true" : "false" },
      { category: "automation", key: "escalation_keywords", value: escalationKeywords },
      { category: "general", key: "agent_name", value: agentName },
    ];
    saveAutoPilotMutation.mutate(settings);
  };

  const toggleQuestionType = (questionType: string) => {
    setAutoPilotQuestionTypes((prev) =>
      prev.includes(questionType)
        ? prev.filter((t) => t !== questionType)
        : [...prev, questionType]
    );
  };

  const toggleBusinessDay = (day: string) => {
    setAutoPilotBusinessDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  if (isLoadingAutoPilot) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Leasing Agent Settings</h1>
        <p className="text-muted-foreground">
          Configure how your AI Leasing Agent handles lead conversations across all channels.
        </p>
      </div>

      <Separator />

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure the AI Leasing Agent's identity and basic behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="agent-name">AI Leasing Agent Name</Label>
            <Input
              id="agent-name"
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="AI Leasing Agent"
            />
            <p className="text-xs text-muted-foreground">
              The name the AI will use when introducing itself to leads.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automation Settings
          </CardTitle>
          <CardDescription>
            Configure how the AI Leasing Agent automatically handles lead conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question Types */}
          <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold">Allowed Question Types</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Auto-pilot will only respond to these question types. All other questions require approval.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { value: "availability", label: "Availability Questions", desc: "Questions about unit availability" },
                    { value: "pricing", label: "Pricing Questions", desc: "Questions about rent, deposits, fees" },
                    { value: "showing_request", label: "Showing Requests", desc: "Requests to schedule property viewings" },
                    { value: "general", label: "General Questions", desc: "General inquiries about the property" },
                  ].map((type) => (
                    <div key={type.value} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`question-type-${type.value}`}
                        checked={autoPilotQuestionTypes.includes(type.value)}
                        onCheckedChange={() => toggleQuestionType(type.value)}
                      />
                      <div className="flex-1 space-y-0.5">
                        <Label
                          htmlFor={`question-type-${type.value}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {type.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{type.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  <p className="text-xs text-yellow-800">
                    Sensitive questions (legal, financial details, etc.) always require human approval regardless of settings.
                  </p>
                </div>
          </div>

          <Separator />

          {/* Minimum Confidence Level */}
          <div className="space-y-2">
            <Label htmlFor="min-confidence">Minimum Confidence Level</Label>
            <Select value={autoPilotMinConfidence} onValueChange={setAutoPilotMinConfidence}>
              <SelectTrigger id="min-confidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Only send when AI is very confident</SelectItem>
                <SelectItem value="medium">Medium - Send when AI is reasonably confident</SelectItem>
                <SelectItem value="low">Low - Send even with lower confidence (not recommended)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lower confidence responses will be escalated to human review
            </p>
          </div>

          <Separator />

          {/* Business Hours */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="business-hours-enabled" className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Restrict to Business Hours
                </Label>
                <p className="text-sm text-muted-foreground">
                  Only send AI responses during specified business hours
                </p>
              </div>
              <Switch
                id="business-hours-enabled"
                checked={autoPilotBusinessHoursEnabled}
                onCheckedChange={setAutoPilotBusinessHoursEnabled}
              />
            </div>

                {autoPilotBusinessHoursEnabled && (
                  <div className="space-y-4 pl-4 border-l-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="business-hours-start">Start Time</Label>
                        <Input
                          id="business-hours-start"
                          type="time"
                          value={autoPilotBusinessHoursStart}
                          onChange={(e) => setAutoPilotBusinessHoursStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="business-hours-end">End Time</Label>
                        <Input
                          id="business-hours-end"
                          type="time"
                          value={autoPilotBusinessHoursEnd}
                          onChange={(e) => setAutoPilotBusinessHoursEnd(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Business Days</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { value: "monday", label: "Monday" },
                          { value: "tuesday", label: "Tuesday" },
                          { value: "wednesday", label: "Wednesday" },
                          { value: "thursday", label: "Thursday" },
                          { value: "friday", label: "Friday" },
                          { value: "saturday", label: "Saturday" },
                          { value: "sunday", label: "Sunday" },
                        ].map((day) => (
                          <div key={day.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`business-day-${day.value}`}
                              checked={autoPilotBusinessDays.includes(day.value)}
                              onCheckedChange={() => toggleBusinessDay(day.value)}
                            />
                            <Label
                              htmlFor={`business-day-${day.value}`}
                              className="text-sm cursor-pointer"
                            >
                              {day.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
          </div>

          <Separator />

          {/* Follow-Up Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="follow-up-enabled" className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Enable Follow-Up Messages
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically send follow-up messages to leads who haven't replied
                </p>
              </div>
              <Switch
                id="follow-up-enabled"
                checked={followUpEnabled}
                onCheckedChange={setFollowUpEnabled}
              />
            </div>

                {followUpEnabled && (
                  <div className="space-y-2 pl-4 border-l-2">
                    <Label htmlFor="follow-up-delay">Follow-Up Delay (Hours)</Label>
                    <Input
                      id="follow-up-delay"
                      type="number"
                      min="1"
                      value={followUpDelayHours}
                      onChange={(e) => setFollowUpDelayHours(e.target.value)}
                      placeholder="24"
                    />
                    <p className="text-xs text-muted-foreground">
                      How many hours to wait after no reply from lead before sending a follow-up
                    </p>
                  </div>
                )}
          </div>

          <Separator />

          {/* Pre-Qualification Settings */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="pre-qualify-enabled" className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Pre-Qualify Leads
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically ask qualification questions before scheduling showings
              </p>
            </div>
            <Switch
              id="pre-qualify-enabled"
              checked={preQualifyEnabled}
              onCheckedChange={setPreQualifyEnabled}
            />
          </div>

          <Separator />

          {/* Daily Message Limit */}
          <div className="space-y-2">
            <Label htmlFor="daily-message-limit">Daily Message Limit</Label>
            <Input
              id="daily-message-limit"
              type="number"
              min="1"
              value={dailyMessageLimit}
              onChange={(e) => setDailyMessageLimit(e.target.value)}
              placeholder="50"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of messages AI can send per day
            </p>
          </div>

          <Separator />

          {/* Response Delay */}
          <div className="space-y-2">
            <Label htmlFor="response-delay">Response Delay (Minutes)</Label>
            <Input
              id="response-delay"
              type="number"
              min="0"
              value={responseDelayMinutes}
              onChange={(e) => setResponseDelayMinutes(e.target.value)}
              placeholder="5"
            />
            <p className="text-xs text-muted-foreground">
              Minimum delay before responding to make conversations feel more natural (prevents bot-like instant replies)
            </p>
          </div>

          <Separator />

          {/* Office Hours Only */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="office-hours-only" className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Office Hours Only
              </Label>
              <p className="text-sm text-muted-foreground">
                Only send AI messages during office hours (uses business hours settings above)
              </p>
            </div>
            <Switch
              id="office-hours-only"
              checked={officeHoursOnly}
              onCheckedChange={setOfficeHoursOnly}
            />
          </div>

          <Separator />

          {/* Escalation Keywords */}
          <div className="space-y-2">
            <Label htmlFor="escalation-keywords" className="flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Escalation Keywords
            </Label>
            <Textarea
              id="escalation-keywords"
              value={escalationKeywords}
              onChange={(e) => setEscalationKeywords(e.target.value)}
              placeholder="lawsuit, attorney, lawyer, complaint, refund, cancel"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of keywords. If a lead's message contains any of these, the AI will hand off to a human instead of responding.
            </p>
          </div>

          <Separator />

          {/* Info about visibility */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Visibility & Audit Trail</h4>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>All AI responses are logged with what was sent, why it was sent, and confidence level</li>
              <li>You can review AI activity in the audit logs</li>
              <li>Responses that don't meet rules are automatically escalated to human review</li>
            </ul>
          </div>

          <Separator />

          <Button onClick={handleSaveAutoPilot} disabled={isSavingAutoPilot} className="w-full sm:w-auto">
            {isSavingAutoPilot ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIAgentSettings;
