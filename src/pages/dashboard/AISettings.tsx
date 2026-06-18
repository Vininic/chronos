import { useState, useEffect } from "react";
import { useAISettings } from "@/lib/ai/settings/store";
import { getRegisteredProviders, testProviderConnection, createProviderFromSettings } from "@/lib/ai/core/registry";
import type { ProviderId } from "@/lib/ai/core/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Key, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function AISettings() {
  const {
    settings,
    updateProvider,
    setApiKey,
    setModel,
    setBaseUrl,
    setFeatureToggle,
    resetSettings,
    clearChatHistory,
    resetLearningProfile,
  } = useAISettings();

  const [connectionStatus, setConnectionStatus] = useState<Record<ProviderId, "idle" | "testing" | "ok" | "error">>(() => {
    const status: Record<string, "idle" | "testing" | "ok" | "error"> = {};
    for (const p of getRegisteredProviders()) status[p.id] = "idle";
    return status as Record<ProviderId, "idle" | "testing" | "ok" | "error">;
  });

  const [connectionError, setConnectionError] = useState<string | null>(null);

  const providers = getRegisteredProviders();

  const currentProviderInfo = providers.find((p) => p.id === settings.providerId);

  const handleTestConnection = async (providerId: ProviderId) => {
    setConnectionStatus((prev) => ({ ...prev, [providerId]: "testing" }));
    setConnectionError(null);

    try {
      const apiKey = settings.apiKeys[providerId] ?? "";
      const provider = createProviderFromSettings({
        providerId,
        apiKey,
        model: settings.models[providerId],
        baseUrl: settings.baseUrls[providerId],
      });

      const result = await testProviderConnection(provider);
      setConnectionStatus((prev) => ({
        ...prev,
        [providerId]: result.ok ? "ok" : "error",
      }));
      if (!result.ok) {
        setConnectionError(result.error ?? "Connection failed");
      }
    } catch {
      setConnectionStatus((prev) => ({ ...prev, [providerId]: "error" }));
      setConnectionError("Connection failed");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl text-primary tracking-tight">AI Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AI providers, API keys, and feature toggles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Provider</CardTitle>
          <CardDescription>Choose which AI provider powers Aetheris analysis and suggestions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select
              value={settings.providerId}
              onValueChange={(v) => updateProvider(v as ProviderId)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.name}
                      {p.capabilities.functionCalling ? (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">tools</Badge>
                      ) : null}
                      {!p.requiresApiKey ? (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">free</Badge>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Model</Label>
            <Input
              value={settings.models[settings.providerId] ?? currentProviderInfo?.defaultModel ?? ""}
              onChange={(e) => setModel(settings.providerId, e.target.value)}
              placeholder={currentProviderInfo?.defaultModel ?? "model-name"}
            />
            {currentProviderInfo && (
              <p className="text-xs text-muted-foreground">
                Default: {currentProviderInfo.defaultModel}
              </p>
            )}
          </div>

          {currentProviderInfo?.requiresApiKey && (
            <div className="grid gap-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={settings.apiKeys[settings.providerId] ?? ""}
                  onChange={(e) => setApiKey(settings.providerId, e.target.value)}
                  placeholder="sk-..."
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleTestConnection(settings.providerId)}
                  disabled={connectionStatus[settings.providerId] === "testing"}
                >
                  {connectionStatus[settings.providerId] === "testing" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : connectionStatus[settings.providerId] === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {connectionError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {connectionError}
                </p>
              )}
            </div>
          )}

          {settings.providerId === "ollama" && (
            <div className="grid gap-2">
              <Label>Base URL</Label>
              <Input
                value={settings.baseUrls[settings.providerId] ?? ""}
                onChange={(e) => setBaseUrl(settings.providerId, e.target.value)}
                placeholder="http://localhost:11434"
              />
              <p className="text-xs text-muted-foreground">
                Default: http://localhost:11434
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider API Keys</CardTitle>
          <CardDescription>Set API keys for all providers. Keys are stored locally in your browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers
            .filter((p) => p.requiresApiKey)
            .map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 grid gap-1">
                  <Label className="text-xs">{p.name}</Label>
                  <Input
                    type="password"
                    value={settings.apiKeys[p.id] ?? ""}
                    onChange={(e) => setApiKey(p.id, e.target.value)}
                    placeholder={`${p.name} API key`}
                    className="text-sm"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTestConnection(p.id)}
                  disabled={connectionStatus[p.id] === "testing"}
                  className="shrink-0"
                >
                  {connectionStatus[p.id] === "testing" ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : connectionStatus[p.id] === "ok" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : connectionStatus[p.id] === "error" ? (
                    <WifiOff className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Wifi className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
          <CardDescription>Enable or disable AI features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeatureToggle
            id="proactive"
            label="Proactive Mode"
            description="Allow Aetheris to proactively analyze your schedule and push suggestions."
            checked={settings.featureToggles.proactiveMode}
            onChange={(v) => setFeatureToggle("proactiveMode", v)}
          />
          <Separator />
          <FeatureToggle
            id="function-calling"
            label="Function Calling"
            description="Allow AI to directly modify your schedule (create, move, delete blocks)."
            checked={settings.featureToggles.functionCalling}
            onChange={(v) => setFeatureToggle("functionCalling", v)}
          />
          <Separator />
          <FeatureToggle
            id="learning"
            label="Learning Profile"
            description="Track your patterns over time for personalized suggestions."
            checked={settings.featureToggles.learning}
            onChange={(v) => setFeatureToggle("learning", v)}
          />
          <Separator />
          <FeatureToggle
            id="auto-suggestions"
            label="Auto Suggestions"
            description="Automatically generate schedule suggestions based on gaps and imbalances."
            checked={settings.featureToggles.autoSuggestions}
            onChange={(v) => setFeatureToggle("autoSuggestions", v)}
          />
          <Separator />
          <FeatureToggle
            id="digest-auto"
            label="Digest Generation"
            description="Automatically generate daily reports. When off, generate manually from the Reports panel."
            checked={settings.featureToggles.digestAuto}
            onChange={(v) => setFeatureToggle("digestAuto", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy Controls</CardTitle>
          <CardDescription>Manage your local AI data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Chat History</p>
              <p className="text-xs text-muted-foreground">Clear all Aetheris chat messages.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearChatHistory();
                toast({ title: "Chat history cleared" });
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Learning Profile</p>
              <p className="text-xs text-muted-foreground">Reset all tracked patterns and preferences.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetLearningProfile();
                toast({ title: "Learning profile reset" });
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pb-8">
        <p className="text-xs text-muted-foreground">
          All data is stored locally in your browser. No data is sent to any server except the configured AI provider.
        </p>
        <Button variant="ghost" size="sm" onClick={resetSettings}>
          Reset all settings
        </Button>
      </div>
    </div>
  );
}

function FeatureToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
