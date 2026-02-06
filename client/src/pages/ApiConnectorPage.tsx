/**
 * API Connector - Developer onboarding page (Integrations → API)
 * Self-serve: keys, getting started, recipes, docs, webhooks, audit logs.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Key,
  Copy,
  Plus,
  Trash2,
  ExternalLink,
  Webhook,
  Activity,
  ChevronLeft,
  Check,
  AlertTriangle,
  Play,
  Send,
} from "lucide-react";

const BASE_URL = typeof window !== "undefined" ? `${window.location.origin}/api/integrations/api/v1` : "";

type PlaygroundAction = {
  id: string;
  label: string;
  method: "GET" | "POST";
  pathTemplate: string; // e.g. /leads, /leads/{leadId}
  defaultPayload: Record<string, unknown>;
  description: string;
};

const PLAYGROUND_ACTIONS: PlaygroundAction[] = [
  { id: "get-leads", label: "Get Leads", method: "GET", pathTemplate: "/leads", description: "List leads with filters", defaultPayload: { limit: 10, status: "", source: "", cursor: "", updated_since: "" } },
  { id: "get-lead", label: "Get Lead by ID", method: "GET", pathTemplate: "/leads/{leadId}", description: "Single lead details", defaultPayload: { leadId: "" } },
  { id: "list-conversations", label: "List Conversations", method: "GET", pathTemplate: "/conversations", description: "Conversations for a lead", defaultPayload: { leadId: "", limit: 20, cursor: "" } },
  { id: "list-messages", label: "List Messages", method: "GET", pathTemplate: "/conversations/{conversationId}/messages", description: "Messages in a conversation", defaultPayload: { leadId: "", conversationId: "", limit: 50 } },
  { id: "list-bookings", label: "List Tour Bookings", method: "GET", pathTemplate: "/tours/bookings", description: "Tour/showing bookings", defaultPayload: { leadId: "", propertyId: "", limit: 20, cursor: "" } },
  { id: "get-properties", label: "Get Properties", method: "GET", pathTemplate: "/properties", description: "List properties", defaultPayload: { limit: 50 } },
  { id: "get-property", label: "Get Property", method: "GET", pathTemplate: "/properties/{propertyId}", description: "Single property details", defaultPayload: { propertyId: "" } },
  { id: "get-units", label: "Get Property Units", method: "GET", pathTemplate: "/properties/{propertyId}/units", description: "Units for a property", defaultPayload: { propertyId: "" } },
  { id: "create-lead", label: "Create Lead", method: "POST", pathTemplate: "/leads", description: "Create a new lead", defaultPayload: { name: "", email: "", phone: "", source: { channel: "api", details: {} } } },
];

function buildPlaygroundRequest(action: PlaygroundAction, payload: Record<string, unknown>, apiKey: string): { method: string; url: string; body?: string } {
  let path = action.pathTemplate;
  const payloadCopy = { ...payload } as Record<string, unknown>;

  // Substitute path params like {leadId}
  const pathParamMatches = path.match(/\{(\w+)\}/g) || [];
  for (const m of pathParamMatches) {
    const key = m.slice(1, -1);
    const val = payloadCopy[key];
    path = path.replace(m, encodeURIComponent(String(val ?? "")));
    delete payloadCopy[key];
  }

  // For GET: add query params from remaining payload
  if (action.method === "GET") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(payloadCopy)) {
      if (v !== "" && v != null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) path += (path.includes("?") ? "&" : "?") + qs;
    return { method: action.method, url: `${BASE_URL}${path}` };
  }

  // For POST: body is the payload (minus path params already used)
  return { method: action.method, url: `${BASE_URL}${path}`, body: JSON.stringify(payloadCopy, null, 2) };
}

const WEBHOOK_EVENTS = [
  "lead.created",
  "lead.updated",
  "message.created",
  "tour.booking.created",
  "tour.booking.updated",
];

function useApiConnector() {
  const { data: status } = useQuery<any>({ queryKey: ["/api/integrations/api-connector/status"] });
  const { data: keys = [], refetch: refetchKeys } = useQuery<any[]>({ queryKey: ["/api/integrations/api-connector/keys"] });
  const { data: webhooks = [] } = useQuery<any[]>({ queryKey: ["/api/integrations/api-connector/webhooks"] });
  const { data: audit } = useQuery<any>({
    queryKey: ["/api/integrations/api-connector/audit"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/api-connector/audit?limit=50", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  return { status, keys, webhooks, audit };
}

function ApiDocsView() {
  const { data: spec, isLoading, error } = useQuery<string>({
    queryKey: ["/api/integrations/api-connector/openapi-inline"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/api-connector/openapi?inline=1", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.text();
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Documentation</CardTitle>
        <CardDescription>Endpoints, parameters, and response schemas.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">Failed to load documentation.</p>}
        {spec && (
          <pre className="p-4 rounded-lg border bg-muted/30 text-sm overflow-x-auto max-h-[480px] overflow-y-auto font-mono whitespace-pre-wrap">
            <code>{spec}</code>
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function usePlaygroundLookups(playgroundActionId: string, payloadLeadId: string) {
  const needsLeadId = ["get-lead", "list-conversations", "list-messages", "list-bookings"].includes(playgroundActionId);
  const needsPropertyId = ["get-property", "get-units", "list-bookings"].includes(playgroundActionId);
  const needsConversationId = playgroundActionId === "list-messages" && !!payloadLeadId;

  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["/api/leads"],
    enabled: needsLeadId,
  });
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties"],
    enabled: needsPropertyId,
  });
  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: ["/api/conversations", payloadLeadId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${payloadLeadId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: needsConversationId,
  });
  return { leads, properties, conversations };
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export default function ApiConnectorPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { status, keys, webhooks, audit } = useApiConnector();
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ rawKey: string; name: string } | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(WEBHOOK_EVENTS);
  const [createdWebhook, setCreatedWebhook] = useState<{ secret: string; url: string } | null>(null);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);

  const activeKeys = keys.filter((k: any) => !k.revokedAt && k.isEnabled);
  const latestPrefix = activeKeys[0]?.keyPrefix ? `l2l_${activeKeys[0].keyPrefix}****` : "l2l_********";

  // API Playground state
  const [playgroundActionId, setPlaygroundActionId] = useState(PLAYGROUND_ACTIONS[0].id);
  const [playgroundPayload, setPlaygroundPayload] = useState(JSON.stringify(PLAYGROUND_ACTIONS[0].defaultPayload, null, 2));
  const [playgroundApiKey, setPlaygroundApiKey] = useState("");
  const [playgroundResponse, setPlaygroundResponse] = useState<{
    status: number;
    statusText: string;
    body: string;
    ok: boolean;
  } | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  const selectedAction = PLAYGROUND_ACTIONS.find((a) => a.id === playgroundActionId) ?? PLAYGROUND_ACTIONS[0];

  let payloadLeadId = "";
  try {
    const p = JSON.parse(playgroundPayload) as Record<string, unknown>;
    payloadLeadId = String(p.leadId ?? "").trim();
  } catch {
    /* ignore */
  }
  const { leads, properties, conversations } = usePlaygroundLookups(playgroundActionId, payloadLeadId);
  const needsLeadId = ["get-lead", "list-conversations", "list-messages", "list-bookings"].includes(playgroundActionId);
  const needsPropertyId = ["get-property", "get-units", "list-bookings"].includes(playgroundActionId);
  const needsConversationId = playgroundActionId === "list-messages" && !!payloadLeadId;
  const requiresLeadId = ["get-lead", "list-conversations"].includes(playgroundActionId);
  const requiresPropertyId = ["get-property", "get-units"].includes(playgroundActionId);
  const requiresConversationId = playgroundActionId === "list-messages";

  const applyQuickSelect = (key: string, value: string) => {
    try {
      const p = JSON.parse(playgroundPayload) as Record<string, unknown>;
      p[key] = value;
      setPlaygroundPayload(JSON.stringify(p, null, 2));
    } catch {
      /* ignore */
    }
  };

  const handleSelectAction = (action: PlaygroundAction) => {
    setPlaygroundActionId(action.id);
    setPlaygroundPayload(JSON.stringify(action.defaultPayload, null, 2));
    setPlaygroundResponse(null);
  };

  const createKeyMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", "/api/integrations/api-connector/keys", { name }),
    onSuccess: async (res) => {
      const data = await res.json();
      setCreatedKey({ rawKey: data.rawKey, name: data.name });
      setNewKeyName("");
      setCreateKeyOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/status"] });
    },
    onError: () => toast({ title: "Failed to create API key", variant: "destructive" }),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/integrations/api-connector/keys/${id}`),
    onSuccess: () => {
      setRevokeKeyId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/status"] });
      toast({ title: "API key revoked" });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: (body: { url: string; events: string[] }) =>
      apiRequest("POST", "/api/integrations/api-connector/webhooks", body),
    onSuccess: async (res) => {
      const data = await res.json();
      setCreatedWebhook({ secret: data.secret, url: data.url });
      setNewWebhookUrl("");
      setNewWebhookEvents(WEBHOOK_EVENTS);
      setCreateWebhookOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/status"] });
    },
    onError: () => toast({ title: "Failed to create webhook", variant: "destructive" }),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/integrations/api-connector/webhooks/${id}`),
    onSuccess: () => {
      setDeleteWebhookId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/webhooks"] });
      toast({ title: "Webhook deleted" });
    },
  });

  const [rotatedSecret, setRotatedSecret] = useState<{ secret: string } | null>(null);
  const sendPlaygroundRequest = async () => {
    let payloadObj: Record<string, unknown>;
    try {
      payloadObj = JSON.parse(playgroundPayload) as Record<string, unknown>;
    } catch {
      toast({ title: "Invalid JSON in payload", variant: "destructive" });
      return;
    }
    const apiKey = playgroundApiKey.trim() || "YOUR_API_KEY";
    if (!playgroundApiKey.trim()) {
      toast({ title: "Enter your API key above to test", variant: "destructive" });
      return;
    }
    const { method, url, body } = buildPlaygroundRequest(selectedAction, payloadObj, apiKey);
    setPlaygroundLoading(true);
    setPlaygroundResponse(null);
    try {
      const opts: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      };
      if (body) opts.body = body;
      const res = await fetch(url, opts);
      let bodyText = "";
      try {
        bodyText = await res.text();
        if (bodyText) {
          const parsed = JSON.parse(bodyText);
          bodyText = JSON.stringify(parsed, null, 2);
        }
      } catch {
        bodyText = bodyText || "(empty)";
      }
      setPlaygroundResponse({
        status: res.status,
        statusText: res.statusText,
        body: bodyText,
        ok: res.ok,
      });
    } catch (err) {
      setPlaygroundResponse({
        status: 0,
        statusText: "Network error",
        body: String(err instanceof Error ? err.message : err),
        ok: false,
      });
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const getFullRequestJson = () => {
    let payloadObj: Record<string, unknown>;
    try {
      payloadObj = JSON.parse(playgroundPayload) as Record<string, unknown>;
    } catch {
      return null;
    }
    const apiKey = playgroundApiKey.trim() || "YOUR_API_KEY";
    const { method, url, body } = buildPlaygroundRequest(selectedAction, payloadObj, apiKey);
    const fullRequest: Record<string, unknown> = {
      method,
      url,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };
    if (body) fullRequest.body = JSON.parse(body);
    return JSON.stringify(fullRequest, null, 2);
  };

  const fullRequestJson = getFullRequestJson();

  const rotateSecretMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/integrations/api-connector/webhooks/${id}/rotate-secret`),
    onSuccess: async (res) => {
      const data = await res.json();
      setRotatedSecret({ secret: data.secret });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/webhooks"] });
    },
  });

  const curlExample = `curl -X GET "${BASE_URL}/leads?limit=10" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;
  const jsExample = `const res = await fetch("${BASE_URL}/leads?limit=10", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const data = await res.json();`;

  const recipes = [
    {
      title: "List Leads",
      desc: "Fetch all leads with optional filters (status, source, updated_since).",
      curl: `curl -X GET "${BASE_URL}/leads?limit=20" -H "Authorization: Bearer YOUR_API_KEY"`,
      js: `fetch("${BASE_URL}/leads?limit=20", { headers: { "Authorization": "Bearer YOUR_API_KEY" } }).then(r => r.json())`,
    },
    {
      title: "Get Lead by ID",
      desc: "Retrieve a single lead's details.",
      curl: `curl -X GET "${BASE_URL}/leads/{leadId}" -H "Authorization: Bearer YOUR_API_KEY"`,
      js: `fetch(\`\${baseUrl}/leads/\${leadId}\`, { headers: { "Authorization": "Bearer YOUR_API_KEY" } }).then(r => r.json())`,
    },
    {
      title: "List Conversations",
      desc: "Get conversations for a lead.",
      curl: `curl -X GET "${BASE_URL}/conversations?leadId={leadId}" -H "Authorization: Bearer YOUR_API_KEY"`,
      js: `fetch(\`\${baseUrl}/conversations?leadId=\${leadId}\`, { headers: { "Authorization": "Bearer YOUR_API_KEY" } }).then(r => r.json())`,
    },
    {
      title: "List Tour Bookings",
      desc: "Fetch tour/showing bookings.",
      curl: `curl -X GET "${BASE_URL}/tours/bookings" -H "Authorization: Bearer YOUR_API_KEY"`,
      js: `fetch("${BASE_URL}/tours/bookings", { headers: { "Authorization": "Bearer YOUR_API_KEY" } }).then(r => r.json())`,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/integrations")}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">API Connector</CardTitle>
                <CardDescription>
                  Sync leads, conversations, and tours with Lead2Lease via REST API + webhooks.
                </CardDescription>
              </div>
            </div>
            <Badge variant={status?.configured ? "default" : "secondary"}>
              {status?.configured ? "Enabled" : "No keys yet"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* API Keys Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Create and manage API keys. Keys are shown only once at creation.</CardDescription>
            </div>
            <Button onClick={() => setCreateKeyOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
          ) : (
            <div className="space-y-2">
              {activeKeys.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <span className="font-medium">{k.name}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-sm">l2l_{k.keyPrefix}****</span>
                    {k.lastUsedAt && (
                      <span className="text-xs text-muted-foreground ml-2">
                        Last used {new Date(k.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRevokeKeyId(k.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Getting Started Card */}
      <Card className={activeKeys.length === 0 ? "opacity-75" : ""}>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Use these values in your first API request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">1. Base URL</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={BASE_URL} className="font-mono text-sm" />
              <CopyButton text={BASE_URL} />
            </div>
          </div>
          <div>
            <Label className="text-sm">2. Auth header</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={`Bearer ${latestPrefix}`} className="font-mono text-sm" />
              <CopyButton text={`Authorization: Bearer YOUR_API_KEY`} label="Copy header" />
            </div>
          </div>
          <div>
            <Label className="text-sm">3. Your first request</Label>
            <Tabs defaultValue="curl" className="mt-2">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="js">JavaScript</TabsTrigger>
              </TabsList>
              <TabsContent value="curl">
                <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
                  <code>{curlExample}</code>
                </pre>
                <CopyButton text={curlExample} />
              </TabsContent>
              <TabsContent value="js">
                <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
                  <code>{jsExample}</code>
                </pre>
                <CopyButton text={jsExample} />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* API Playground Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            API Playground
          </CardTitle>
          <CardDescription>
            Select an action, edit the JSON payload, and test API calls. Copy the JSON to use elsewhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action selector - clickable cards */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Select action</Label>
            <div className="flex flex-wrap gap-2">
              {PLAYGROUND_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleSelectAction(action)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-left transition-colors ${
                    playgroundActionId === action.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50"
                  }`}
                >
                  <Badge variant={action.method === "GET" ? "secondary" : "default"} className="text-xs shrink-0">
                    {action.method}
                  </Badge>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick select — pick lead/property/conversation from your account */}
          {(needsLeadId || needsPropertyId || needsConversationId) && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <Label className="text-sm font-medium">Quick select from your account</Label>
              <div className="flex flex-wrap gap-4">
                {needsLeadId && (
                  <div className="min-w-[260px]">
                    <Label className="text-xs text-muted-foreground block mb-1">Select lead</Label>
                    <Select
                      value={payloadLeadId || "__none__"}
                      onValueChange={(v) => applyQuickSelect("leadId", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a lead…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {leads.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.email || l.phone || l.name || l.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {needsPropertyId && (
                  <div className="min-w-[260px]">
                    <Label className="text-xs text-muted-foreground block mb-1">Select property</Label>
                    <Select
                      value={(() => {
                        try {
                          const p = JSON.parse(playgroundPayload) as Record<string, unknown>;
                          return String(p.propertyId ?? "") || "__none__";
                        } catch {
                          return "__none__";
                        }
                      })()}
                      onValueChange={(v) => applyQuickSelect("propertyId", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a property…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {properties.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name || p.address || p.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {needsConversationId && (
                  <div className="min-w-[260px]">
                    <Label className="text-xs text-muted-foreground block mb-1">Select conversation</Label>
                    <Select
                      value={(() => {
                        try {
                          const p = JSON.parse(playgroundPayload) as Record<string, unknown>;
                          return String(p.conversationId ?? "") || "__none__";
                        } catch {
                          return "__none__";
                        }
                      })()}
                      onValueChange={(v) => applyQuickSelect("conversationId", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a conversation…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {conversations.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.channel || "Conversation"} — {c.id?.slice(0, 8)}…
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Parameters / payload editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                Parameters — {selectedAction.description}
              </Label>
              <Button variant="outline" size="sm" onClick={() => setPlaygroundPayload(JSON.stringify(selectedAction.defaultPayload, null, 2))}>
                Reset
              </Button>
            </div>
            <Textarea
              value={playgroundPayload}
              onChange={(e) => setPlaygroundPayload(e.target.value)}
              className="font-mono text-sm min-h-[140px] resize-y"
              placeholder="{}"
            />
          </div>

          {/* API key input */}
          <div>
            <Label className="text-sm font-medium">Your API key</Label>
            <Input
              type="password"
              value={playgroundApiKey}
              onChange={(e) => setPlaygroundApiKey(e.target.value)}
              placeholder="Paste your API key — it will appear in the complete request below"
              className="font-mono text-sm mt-1 max-w-lg"
            />
          </div>

          {/* Complete request - everything Lead2Lease needs, copy & paste ready */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Complete request — copy & paste to your API client</Label>
              <CopyButton
                text={fullRequestJson ?? "{}"}
                label="Copy full request"
              />
            </div>
            <Textarea
              readOnly
              value={fullRequestJson ?? "Invalid JSON in parameters"}
              className="font-mono text-sm min-h-[160px] resize-y bg-muted/30"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(() => {
                let needsSelection = false;
                try {
                  const p = JSON.parse(playgroundPayload) as Record<string, unknown>;
                  needsSelection = (requiresLeadId && !p.leadId) || (requiresPropertyId && !p.propertyId) || (requiresConversationId && !p.conversationId);
                } catch {
                  /* ignore */
                }
                return needsSelection ? (
                  <>Use the dropdowns above to select a lead, property, or conversation — the URL and request will update with the chosen IDs.</>
                ) : (
                  <>Includes method, URL, headers (with your API key), and body. Paste into Postman, curl, or your code.</>
                );
              })()}
            </p>
          </div>

          <Button onClick={sendPlaygroundRequest} disabled={playgroundLoading}>
            <Send className="h-4 w-4 mr-2" />
            {playgroundLoading ? "Sending…" : "Send request"}
          </Button>

          {/* Response */}
          {playgroundResponse && (
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                <span className="text-sm font-medium">Response</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={playgroundResponse.body} label="Copy response JSON" />
                  <Badge variant={playgroundResponse.ok ? "default" : "destructive"}>
                    {playgroundResponse.status} {playgroundResponse.statusText}
                  </Badge>
                </div>
              </div>
              <pre className="p-4 text-sm overflow-x-auto max-h-[320px] overflow-y-auto bg-muted/30">
                <code>{playgroundResponse.body}</code>
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipes Card */}
      <Card>
        <CardHeader>
          <CardTitle>Common Recipes</CardTitle>
          <CardDescription>Copy-paste examples for typical API actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {recipes.map((r, i) => (
              <AccordionItem key={i} value={`recipe-${i}`}>
                <AccordionTrigger>{r.title}</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-3">{r.desc}</p>
                  <Tabs defaultValue="curl">
                    <TabsList>
                      <TabsTrigger value="curl">cURL</TabsTrigger>
                      <TabsTrigger value="js">JS</TabsTrigger>
                    </TabsList>
                    <TabsContent value="curl">
                      <pre className="p-3 rounded bg-muted text-xs overflow-x-auto mt-2">
                        <code>{r.curl}</code>
                      </pre>
                      <CopyButton text={r.curl} />
                    </TabsContent>
                    <TabsContent value="js">
                      <pre className="p-3 rounded bg-muted text-xs overflow-x-auto mt-2">
                        <code>{r.js}</code>
                      </pre>
                      <CopyButton text={r.js} />
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* API Documentation Card - in-app view */}
      <ApiDocsView />

      {/* Webhooks Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Receive events when leads, messages, or tours change.</CardDescription>
            </div>
            <Button onClick={() => setCreateWebhookOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook Endpoint
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks configured. Add one to receive events.</p>
          ) : (
            <div className="space-y-2">
              {webhooks.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <span className="font-mono text-sm">{w.url}</span>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(w.events || []).slice(0, 3).map((e: string) => (
                        <Badge key={e} variant="outline" className="text-xs">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={w.isEnabled ? "default" : "secondary"}>{w.isEnabled ? "Enabled" : "Disabled"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => rotateSecretMutation.mutate(w.id)} disabled={rotateSecretMutation.isPending}>
                      Rotate Secret
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteWebhookId(w.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Webhooks use HMAC SHA256. Verify with headers: <code>X-Lead2Lease-Signature</code>, <code>X-Lead2Lease-Timestamp</code>.
          </p>
        </CardContent>
      </Card>

      {/* Activity / Audit Log Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>Recent API calls from your integration.</CardDescription>
        </CardHeader>
        <CardContent>
          {!audit?.items?.length ? (
            <p className="text-sm text-muted-foreground">No API activity yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Method</th>
                    <th className="text-left p-2">Path</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Duration</th>
                    <th className="text-left p-2">Key</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.items.slice(0, 20).map((row: any) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                      <td className="p-2 font-mono">{row.method}</td>
                      <td className="p-2 font-mono truncate max-w-[200px]">{row.path}</td>
                      <td className="p-2">
                        <Badge variant={row.statusCode >= 200 && row.statusCode < 300 ? "default" : row.statusCode >= 400 ? "destructive" : "secondary"}>
                          {row.statusCode ?? "—"}
                        </Badge>
                      </td>
                      <td className="p-2">{row.durationMs != null ? `${row.durationMs}ms` : "—"}</td>
                      <td className="p-2 text-muted-foreground">{row.keyPrefix ? `…${row.keyPrefix}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Enter a name for the key. The full key will be shown once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Key name</Label>
              <Input
                placeholder="e.g. Production, Development"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>Cancel</Button>
            <Button onClick={() => createKeyMutation.mutate(newKeyName.trim() || "API Key")} disabled={createKeyMutation.isPending}>
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Key - show once */}
      <Dialog open={!!createdKey} onOpenChange={(open) => !open && setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              <span className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Copy now — you won&apos;t be able to see it again.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={createdKey?.rawKey ?? ""} className="font-mono" />
            <CopyButton text={createdKey?.rawKey ?? ""} />
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Modal */}
      <Dialog open={createWebhookOpen} onOpenChange={setCreateWebhookOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>Enter the URL that will receive webhook events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Endpoint URL</Label>
              <Input
                placeholder="https://your-server.com/webhooks/lead2lease"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
              />
            </div>
            <div>
              <Label>Events (select all that apply)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {WEBHOOK_EVENTS.map((e) => (
                  <Badge
                    key={e}
                    variant={newWebhookEvents.includes(e) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      setNewWebhookEvents((prev) =>
                        prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
                      )
                    }
                  >
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWebhookOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createWebhookMutation.mutate({ url: newWebhookUrl, events: newWebhookEvents })}
              disabled={!newWebhookUrl.trim() || createWebhookMutation.isPending}
            >
              Add Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotated Webhook Secret - show once */}
      <Dialog open={!!rotatedSecret} onOpenChange={(open) => !open && setRotatedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret Rotated</DialogTitle>
            <DialogDescription>
              <span className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Copy the new secret now — you won&apos;t be able to see it again.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={rotatedSecret?.secret ?? ""} className="font-mono" />
            <CopyButton text={rotatedSecret?.secret ?? ""} />
          </div>
          <DialogFooter>
            <Button onClick={() => setRotatedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Webhook - show secret once */}
      <Dialog open={!!createdWebhook} onOpenChange={(open) => !open && setCreatedWebhook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Created</DialogTitle>
            <DialogDescription>
              <span className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Copy the secret now — you won&apos;t be able to see it again.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-sm">Secret</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={createdWebhook?.secret ?? ""} className="font-mono" />
              <CopyButton text={createdWebhook?.secret ?? ""} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedWebhook(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Key Confirmation */}
      <AlertDialog open={!!revokeKeyId} onOpenChange={(open) => !open && setRevokeKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Any applications using this key will stop working.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => revokeKeyId && revokeKeyMutation.mutate(revokeKeyId)}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Webhook Confirmation */}
      <AlertDialog open={!!deleteWebhookId} onOpenChange={(open) => !open && setDeleteWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>This endpoint will no longer receive events.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => deleteWebhookId && deleteWebhookMutation.mutate(deleteWebhookId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
