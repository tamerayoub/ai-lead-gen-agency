import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and integrations</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue="John Doe" data-testid="input-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="john@example.com" data-testid="input-email" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" defaultValue="ABC Property Management" data-testid="input-company" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" defaultValue="+1 555-0123" data-testid="input-phone" />
                </div>
              </div>
              <Button data-testid="button-save-profile">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Twilio (SMS & Phone)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="twilio-sid">Account SID</Label>
                  <Input id="twilio-sid" placeholder="ACxxxxxxxxxxxxx" data-testid="input-twilio-sid" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twilio-token">Auth Token</Label>
                  <Input id="twilio-token" type="password" placeholder="••••••••" data-testid="input-twilio-token" />
                </div>
                <Button data-testid="button-save-twilio">
                  <Save className="h-4 w-4 mr-2" />
                  Save Twilio Config
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Service</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-api">API Key</Label>
                  <Input id="email-api" type="password" placeholder="••••••••" data-testid="input-email-api" />
                </div>
                <Button data-testid="button-save-email">
                  <Save className="h-4 w-4 mr-2" />
                  Save Email Config
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">OpenAI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-key">API Key</Label>
                  <Input id="openai-key" type="password" placeholder="sk-••••••••" data-testid="input-openai-key" />
                </div>
                <Button data-testid="button-save-openai">
                  <Save className="h-4 w-4 mr-2" />
                  Save OpenAI Config
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { id: "new-leads", label: "New lead notifications" },
                  { id: "ai-actions", label: "AI action summaries" },
                  { id: "qualified", label: "Pre-qualified lead alerts" },
                  { id: "applications", label: "Application status updates" },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-md bg-muted">
                    <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
                    <input
                      type="checkbox"
                      id={item.id}
                      defaultChecked
                      className="h-4 w-4"
                      data-testid={`checkbox-${item.id}`}
                    />
                  </div>
                ))}
              </div>
              <Button data-testid="button-save-notifications">
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
