import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiGoogle, SiZillow } from "react-icons/si";
import { Mail, Building2, CheckCircle2, Settings as SettingsIcon } from "lucide-react";

const integrations = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Sync emails and manage leads directly from your Gmail inbox",
    icon: <SiGoogle className="h-8 w-8" />,
    status: "configured",
    category: "Email",
  },
  {
    id: "zillow",
    name: "Zillow",
    description: "List properties on Zillow and automatically capture leads",
    icon: <SiZillow className="h-8 w-8" />,
    status: "available",
    category: "Listing Platform",
  },
];

export default function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-integrations-title">
          Integrations
        </h1>
        <p className="text-muted-foreground mt-2" data-testid="text-integrations-subtitle">
          Connect external services to streamline your property management workflow
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {integration.icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl" data-testid={`text-${integration.id}-name`}>
                      {integration.name}
                    </CardTitle>
                    <Badge variant="outline" className="mt-1">
                      {integration.category}
                    </Badge>
                  </div>
                </div>
                {integration.status === "configured" && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" data-testid={`icon-${integration.id}-configured`} />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription data-testid={`text-${integration.id}-description`}>
                {integration.description}
              </CardDescription>
              <div className="flex gap-2">
                {integration.status === "configured" ? (
                  <Button variant="outline" size="sm" data-testid={`button-${integration.id}-manage`}>
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                ) : (
                  <Button size="sm" data-testid={`button-${integration.id}-connect`}>
                    Connect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Need another integration?</CardTitle>
          <CardDescription>
            We're always adding new integrations. Contact support to request a specific platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" data-testid="button-request-integration">
            <Mail className="h-4 w-4 mr-2" />
            Request Integration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
