import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Brain, MessageSquare, Zap, Settings2, Save } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Settings() {
  const { toast } = useToast();
  
  // Handle tab navigation from URL query parameter
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'ai-training';
  });
  
  const [greetingTemplate, setGreetingTemplate] = useState("");
  const [followupTemplate, setFollowupTemplate] = useState("");
  const [minIncome, setMinIncome] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [requireRefs, setRequireRefs] = useState(false);
  
  const [responseTone, setResponseTone] = useState("professional");
  const [responseSpeed, setResponseSpeed] = useState("immediate");
  const [includeDetails, setIncludeDetails] = useState(true);
  const [suggestTours, setSuggestTours] = useState(true);
  
  const [autoRespond, setAutoRespond] = useState(true);
  const [followup24h, setFollowup24h] = useState(true);
  const [autoSendApp, setAutoSendApp] = useState(false);
  const [maxFollowups, setMaxFollowups] = useState("3");
  const [autoPilotMode, setAutoPilotMode] = useState(false);
  

  const { data: responseSettings } = useQuery({ 
    queryKey: ["/api/ai-settings/responses"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/responses");
      if (!res.ok) return [];
      const data = await res.json();
      if (data?.length > 0) {
        const settings = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
        setGreetingTemplate(settings.greeting_template || "");
        setFollowupTemplate(settings.followup_template || "");
      }
      return data;
    }
  });
  
  const { data: qualificationSettings } = useQuery({ 
    queryKey: ["/api/ai-settings/qualification"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings/qualification");
      if (!res.ok) return [];
      const data = await res.json();
      if (data?.length > 0) {
        const settings = data.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
        setMinIncome(settings.min_income || "");
        setCreditScore(settings.credit_score || "");
        setPetsAllowed(settings.pets_allowed === "true");
        setRequireRefs(settings.require_refs === "true");
      }
      return data;
    }
  });


  const saveSettingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ai-settings", data),
    onSuccess: (_, variables) => {
      toast({ title: "Settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/ai-settings/${variables.category}`] });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const saveTemplates = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "responses", key: "greeting_template", value: greetingTemplate });
      await saveSettingMutation.mutateAsync({ category: "responses", key: "followup_template", value: followupTemplate });
      toast({ title: "Templates saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save templates", variant: "destructive" });
    }
  };

  const saveCriteria = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "min_income", value: minIncome });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "credit_score", value: creditScore });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "pets_allowed", value: petsAllowed.toString() });
      await saveSettingMutation.mutateAsync({ category: "qualification", key: "require_refs", value: requireRefs.toString() });
      toast({ title: "Qualification criteria saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save criteria", variant: "destructive" });
    }
  };

  const saveBehavior = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "response_tone", value: responseTone });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "response_speed", value: responseSpeed });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "include_details", value: includeDetails.toString() });
      await saveSettingMutation.mutateAsync({ category: "behavior", key: "suggest_tours", value: suggestTours.toString() });
      toast({ title: "Response behavior saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save behavior", variant: "destructive" });
    }
  };

  const saveAutomation = async () => {
    try {
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_respond", value: autoRespond.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "followup_24h", value: followup24h.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_send_app", value: autoSendApp.toString() });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "max_followups", value: maxFollowups });
      await saveSettingMutation.mutateAsync({ category: "automation", key: "auto_pilot_mode", value: autoPilotMode.toString() });
      toast({ title: "Automation rules saved successfully" });
    } catch (error) {
      toast({ title: "Failed to save automation", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your AI assistant and system preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-training" data-testid="tab-ai-training">
            <Brain className="h-4 w-4 mr-2" />
            AI Training
          </TabsTrigger>
          <TabsTrigger value="responses" data-testid="tab-responses">
            <MessageSquare className="h-4 w-4 mr-2" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">
            <Zap className="h-4 w-4 mr-2" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Settings2 className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-training" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Templates</CardTitle>
              <CardDescription>Train your AI to respond in your voice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="greeting-template">Initial Greeting Template</Label>
                <Textarea
                  id="greeting-template"
                  placeholder="Hi {name}! Thanks for your interest in {property}..."
                  className="min-h-[100px]"
                  data-testid="textarea-greeting-template"
                  value={greetingTemplate}
                  onChange={(e) => setGreetingTemplate(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Available variables: {"{name}"}, {"{property}"}, {"{units}"}, {"{rent}"}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="followup-template">Follow-up Template</Label>
                <Textarea
                  id="followup-template"
                  placeholder="Just checking in about your interest in {property}..."
                  className="min-h-[100px]"
                  data-testid="textarea-followup-template"
                  value={followupTemplate}
                  onChange={(e) => setFollowupTemplate(e.target.value)}
                />
              </div>

              <Button onClick={saveTemplates} disabled={saveSettingMutation.isPending} data-testid="button-save-templates">
                <Save className="h-4 w-4 mr-2" />
                Save Templates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Qualification Criteria</CardTitle>
              <CardDescription>Set criteria for pre-qualifying leads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="min-income">Minimum Monthly Income</Label>
                <Input
                  id="min-income"
                  type="number"
                  placeholder="3000"
                  data-testid="input-min-income"
                  value={minIncome}
                  onChange={(e) => setMinIncome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="credit-score">Minimum Credit Score</Label>
                <Input
                  id="credit-score"
                  type="number"
                  placeholder="650"
                  data-testid="input-credit-score"
                  value={creditScore}
                  onChange={(e) => setCreditScore(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pets Allowed</Label>
                  <p className="text-sm text-muted-foreground">Accept leads with pets</p>
                </div>
                <Switch checked={petsAllowed} onCheckedChange={setPetsAllowed} data-testid="switch-pets-allowed" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require References</Label>
                  <p className="text-sm text-muted-foreground">Request previous landlord references</p>
                </div>
                <Switch checked={requireRefs} onCheckedChange={setRequireRefs} data-testid="switch-require-references" />
              </div>

              <Button onClick={saveCriteria} disabled={saveSettingMutation.isPending} data-testid="button-save-criteria">
                <Save className="h-4 w-4 mr-2" />
                Save Criteria
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Behavior</CardTitle>
              <CardDescription>Configure how AI responds to inquiries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="response-tone">Response Tone</Label>
                <Select value={responseTone} onValueChange={setResponseTone}>
                  <SelectTrigger id="response-tone" data-testid="select-response-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="response-speed">Response Speed</Label>
                <Select value={responseSpeed} onValueChange={setResponseSpeed}>
                  <SelectTrigger id="response-speed" data-testid="select-response-speed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="1-min">1-2 minutes</SelectItem>
                    <SelectItem value="5-min">5 minutes</SelectItem>
                    <SelectItem value="manual">Manual only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Property Details</Label>
                  <p className="text-sm text-muted-foreground">Automatically share amenities and photos</p>
                </div>
                <Switch checked={includeDetails} onCheckedChange={setIncludeDetails} data-testid="switch-include-property-details" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Suggest Virtual Tours</Label>
                  <p className="text-sm text-muted-foreground">Offer virtual tour scheduling in responses</p>
                </div>
                <Switch checked={suggestTours} onCheckedChange={setSuggestTours} data-testid="switch-suggest-tours" />
              </div>

              <Button onClick={saveBehavior} disabled={saveSettingMutation.isPending} data-testid="button-save-behavior">
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Actions</CardTitle>
              <CardDescription>Configure automatic follow-ups and workflows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-respond to New Leads</Label>
                  <p className="text-sm text-muted-foreground">Send initial greeting automatically</p>
                </div>
                <Switch checked={autoRespond} onCheckedChange={setAutoRespond} data-testid="switch-auto-respond" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Follow-up After 24 Hours</Label>
                  <p className="text-sm text-muted-foreground">Send reminder if no response</p>
                </div>
                <Switch checked={followup24h} onCheckedChange={setFollowup24h} data-testid="switch-followup-24h" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-send Applications</Label>
                  <p className="text-sm text-muted-foreground">Send application to qualified leads</p>
                </div>
                <Switch checked={autoSendApp} onCheckedChange={setAutoSendApp} data-testid="switch-auto-send-applications" />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Pilot Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically approve and send AI-generated replies (bypasses manual review)
                  </p>
                </div>
                <Switch 
                  checked={autoPilotMode} 
                  onCheckedChange={setAutoPilotMode} 
                  data-testid="switch-auto-pilot-mode" 
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="max-followups">Maximum Follow-ups</Label>
                <Input
                  id="max-followups"
                  type="number"
                  min="1"
                  max="10"
                  data-testid="input-max-followups"
                  value={maxFollowups}
                  onChange={(e) => setMaxFollowups(e.target.value)}
                />
              </div>

              <Button onClick={saveAutomation} disabled={saveSettingMutation.isPending} data-testid="button-save-automation">
                <Save className="h-4 w-4 mr-2" />
                Save Automation Rules
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrations Moved</CardTitle>
              <CardDescription>All integrations are now managed in the Integrations section</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We've reorganized the app! All integration settings (Gmail, Zillow, Twilio, and more) have been moved to the dedicated <strong>Integrations</strong> page in the sidebar for easier access and management.
              </p>
              <Button asChild data-testid="button-go-to-integrations">
                <a href="/integrations">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Go to Integrations
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
