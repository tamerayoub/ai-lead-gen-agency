/**
 * API Connector configuration dialog - manage API keys and webhooks.
 * See server/API_CONNECTOR_ARCHITECTURE.md
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ApiConnectorConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiConnectorConfigDialog({ open, onOpenChange }: ApiConnectorConfigDialogProps) {
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<{ rawKey: string; name: string } | null>(null);

  const { data: keys = [], refetch: refetchKeys } = useQuery<any[]>({
    queryKey: ["/api/integrations/api-connector/keys"],
    enabled: open,
  });

  const { data: webhooks = [], refetch: refetchWebhooks } = useQuery<any[]>({
    queryKey: ["/api/integrations/api-connector/webhooks"],
    enabled: open,
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", "/api/integrations/api-connector/keys", { name }),
    onSuccess: async (res) => {
      const data = await res.json();
      setCreatedKey({ rawKey: data.rawKey, name: data.name });
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/status"] });
    },
    onError: () => toast({ title: "Failed to create API key", variant: "destructive" }),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/integrations/api-connector/keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-connector/status"] });
      toast({ title: "API key revoked" });
    },
  });

  const copyKey = () => {
    if (createdKey?.rawKey) {
      navigator.clipboard.writeText(createdKey.rawKey);
      toast({ title: "API key copied to clipboard" });
    }
  };

  const dismissCreatedKey = () => setCreatedKey(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Connector
          </DialogTitle>
          <DialogDescription>
            Create API keys to authenticate external systems. Use the base URL:{" "}
            <code className="rounded bg-muted px-1">{typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/api/v1</code>
          </DialogDescription>
        </DialogHeader>

        {createdKey && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4 space-y-2">
            <p className="text-sm font-medium">API key created — save it now. It won&apos;t be shown again.</p>
            <div className="flex gap-2">
              <Input readOnly value={createdKey.rawKey} className="font-mono text-sm" />
              <Button size="icon" variant="outline" onClick={copyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="secondary" onClick={dismissCreatedKey}>
              Dismiss
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">API Keys</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                placeholder="Key name (e.g. Production)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createKeyMutation.mutate(newKeyName || "API Key")}
                className="flex-1 min-w-[180px]"
              />
              <Button
                size="sm"
                onClick={() => createKeyMutation.mutate(newKeyName.trim() || "API Key")}
                disabled={createKeyMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Generate Key
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Leave name blank to use &quot;API Key&quot;, or enter a label (e.g. Production, Development).
            </p>
          </div>

          <div className="space-y-2">
            {keys.filter((k) => !k.revokedAt).map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <div>
                  <span className="font-medium">{k.name}</span>
                  <span className="text-muted-foreground ml-2">…{k.keyPrefix}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => revokeKeyMutation.mutate(k.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {keys.length === 0 && (
              <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">Webhooks</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {webhooks.length} endpoint(s) configured. Webhooks notify your system when leads or tours change.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
