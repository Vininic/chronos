import { useState, useEffect, useCallback } from "react";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/dictionaries";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, CheckCircle2, Cloud, Key, RefreshCw, RotateCcw, Sun, Moon, Trash2, Wifi, WifiOff, Keyboard, Globe } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAISettings } from "@/lib/ai/settings/store";
import { getRegisteredProviders, testProviderConnection, createProviderFromSettings } from "@/lib/ai/core/registry";
import { isAiProxyAvailable } from "@/lib/ai/core/adapters/geminiProxy";
import type { ProviderId } from "@/lib/ai/core/provider";
import { getAllShortcuts, getEffectiveBinding, setCustomBinding, resetBinding, resetAllBindings, useBindings, formatBinding } from "@/lib/keyboard/shortcuts";
import type { ShortcutBinding } from "@/lib/keyboard/shortcuts";
import { hasSupabaseConfig, loadSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from "@/lib/supabase/client";
import type { SupabaseConfig } from "@/lib/supabase/client";
import { getPushState, requestPermission, subscribeToPush, unsubscribeFromPush, getVapidPublicKey, setVapidPublicKey, clearVapidPublicKey } from "@/lib/notifications/push";
import type { PushState } from "@/lib/notifications/push";
import DataPortabilityCard from "@/components/dashboard/DataPortabilityCard";

export default function Settings() {
  const t = useT();
  const s = t.chronos.settingsPage;
  const { locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { bindings, refresh } = useBindings();
  const [capturing, setCapturing] = useState<string | null>(null);
  const existingConfig = loadSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(existingConfig?.url ?? "");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(existingConfig?.anonKey ?? "");
  const isSupabaseConnected = hasSupabaseConfig();
  const [pushState, setPushState] = useState<PushState>(getPushState);
  const existingVapidKey = getVapidPublicKey();
  const [vapidKey, setVapidKey] = useState(existingVapidKey ?? "");

  const handleCapture = (id: string) => {
    setCapturing(id);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") { setCapturing(null); return; }
    const binding: ShortcutBinding = {
      key: e.key === " " ? "Space" : e.key,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };
    setCustomBinding(capturing, binding);
    setCapturing(null);
    refresh();
    toast({ title: s.shortcuts.updated });
  }, [capturing, refresh, s]);

  useEffect(() => {
    if (capturing) {
      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [capturing, handleKeyDown]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-2">
      <div>
        <h1 className="font-display text-2xl text-primary tracking-tight">{s.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {s.subtitle}
        </p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {s.general.title}
          </CardTitle>
          <CardDescription>{s.general.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label>{s.general.language}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LOCALE_LABELS[l].long} ({LOCALE_LABELS[l].short})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div>
            <Label>{s.general.theme}</Label>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                {s.general.light}
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                {s.general.dark}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Portability */}
      <DataPortabilityCard />

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            {s.shortcuts.title}
          </CardTitle>
          <CardDescription>{s.shortcuts.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {getAllShortcuts().map((def) => {
            const b = bindings[def.id] ?? def.defaultBinding;
            const isDefault = JSON.stringify(b) === JSON.stringify(def.defaultBinding);
            return (
              <div key={def.id} className="flex items-center justify-between gap-4">
                <span className="text-sm text-primary">{def.label}</span>
                <div className="flex items-center gap-2">
                  {capturing === def.id ? (
                    <span className="text-xs text-secondary animate-pulse px-3 py-1 rounded border border-secondary/40 bg-secondary/5">
                      {s.shortcuts.pressKeys}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCapture(def.id)}
                      className="text-xs font-mono px-3 py-1 rounded border border-border hover:border-secondary/40 hover:bg-secondary/5 transition-colors"
                    >
                      {formatBinding(b)}
                    </button>
                  )}
                  {!isDefault && (
                    <button
                      onClick={() => { resetBinding(def.id); refresh(); }}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                      title={s.shortcuts.resetOne}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="pt-2">
            <Button variant="ghost" size="sm" onClick={() => { resetAllBindings(); refresh(); toast({ title: s.shortcuts.allReset }); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {s.shortcuts.resetAll}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cloud Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            {s.cloud.title}
          </CardTitle>
          <CardDescription>{s.cloud.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{s.cloud.url}</Label>
            <Input value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://your-project.supabase.co" />
          </div>
          <div className="grid gap-2">
            <Label>{s.cloud.anonKey}</Label>
            <Input type="password" value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs..." />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => {
              if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
                toast({ title: s.cloud.missingTitle, description: s.cloud.missingDesc, variant: "destructive" });
                return;
              }
              saveSupabaseConfig({ url: supabaseUrl.trim(), anonKey: supabaseAnonKey.trim() });
              toast({ title: s.cloud.savedTitle, description: s.cloud.savedDesc });
              setTimeout(() => window.location.reload(), 1000);
            }}>
              <Cloud className="h-4 w-4 mr-1.5" />
              {s.cloud.connect}
            </Button>
            {isSupabaseConnected && (
              <Button variant="outline" onClick={() => {
                clearSupabaseConfig();
                setSupabaseUrl("");
                setSupabaseAnonKey("");
                toast({ title: s.cloud.removedTitle, description: s.cloud.removedDesc });
                setTimeout(() => window.location.reload(), 1000);
              }}>
                {s.cloud.disconnect}
              </Button>
            )}
            {isSupabaseConnected && (
              <Badge variant="outline" className="text-green-500 border-green-500/30 ml-auto">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {s.cloud.connected}
              </Badge>
            )}
          </div>
          {isSupabaseConnected && (
            <p className="text-xs text-muted-foreground">
              {s.cloud.note}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {s.push.title}
          </CardTitle>
          <CardDescription>{s.push.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushState.supported && (
            <p className="text-sm text-muted-foreground">{s.push.unsupported}</p>
          )}
          {pushState.supported && (
            <>
              <div className="grid gap-2">
                <Label>{s.push.vapid}</Label>
                <Input value={vapidKey} onChange={(e) => setVapidKey(e.target.value)} placeholder="BEl62iUY..." />
                <p className="text-xs text-muted-foreground">{s.push.vapidNote}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button disabled={!vapidKey.trim() || pushState.permission === "denied"} onClick={async () => {
                  if (pushState.permission === "default") {
                    const result = await requestPermission();
                    if (result !== "granted") {
                      toast({ title: s.push.deniedTitle, description: s.push.deniedDesc, variant: "destructive" });
                      return;
                    }
                    setPushState((prev) => ({ ...prev, permission: result }));
                  }
                  setVapidPublicKey(vapidKey.trim());
                  const ok = await subscribeToPush(vapidKey.trim());
                  if (ok) {
                    setPushState((prev) => ({ ...prev, subscribed: true }));
                    toast({ title: s.push.subscribedTitle, description: s.push.subscribedDesc });
                  } else {
                    toast({ title: s.push.failedTitle, description: s.push.failedDesc, variant: "destructive" });
                  }
                }}>
                  <Bell className="h-4 w-4 mr-1.5" />
                  {pushState.subscribed ? s.push.resubscribe : s.push.subscribe}
                </Button>
                {pushState.subscribed && (
                  <Button variant="outline" onClick={async () => {
                    await unsubscribeFromPush();
                    setPushState((prev) => ({ ...prev, subscribed: false }));
                    toast({ title: s.push.unsubscribedTitle, description: s.push.unsubscribedDesc });
                  }}>
                    {s.push.unsubscribe}
                  </Button>
                )}
                {pushState.subscribed && (
                  <Badge variant="outline" className="text-green-500 border-green-500/30 ml-auto">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {s.push.subscribed}
                  </Badge>
                )}
              </div>
              {pushState.permission === "denied" && (
                <p className="text-xs text-destructive">{s.push.blocked}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Settings */}
      <AISettingsContent />
    </div>
  );
}

function AISettingsContent() {
  const s = useT().chronos.settingsPage;
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
      setConnectionStatus((prev) => ({ ...prev, [providerId]: result.ok ? "ok" : "error" }));
      if (!result.ok) setConnectionError(result.error ?? s.ai.connectionFailed);
    } catch {
      setConnectionStatus((prev) => ({ ...prev, [providerId]: "error" }));
      setConnectionError(s.ai.connectionFailed);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.ai.activeProvider}</CardTitle>
          <CardDescription>{s.ai.activeProviderDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{s.ai.provider}</Label>
            <Select value={settings.providerId} onValueChange={(v) => updateProvider(v as ProviderId)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.name}
                      {p.capabilities.functionCalling ? <Badge variant="outline" className="text-[10px] px-1 py-0">{s.ai.tools}</Badge> : null}
                      {!p.requiresApiKey ? <Badge variant="secondary" className="text-[10px] px-1 py-0">{s.ai.free}</Badge> : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{s.ai.model}</Label>
            <Input value={settings.models[settings.providerId] ?? currentProviderInfo?.defaultModel ?? ""}
              onChange={(e) => setModel(settings.providerId, e.target.value)}
              placeholder={currentProviderInfo?.defaultModel ?? "model-name"} />
            {currentProviderInfo && <p className="text-xs text-muted-foreground">{s.ai.default}: {currentProviderInfo.defaultModel}</p>}
          </div>
          {currentProviderInfo?.requiresApiKey && (
            <div className="grid gap-2">
              <Label>{s.ai.apiKey}</Label>
              <div className="flex gap-2">
                <Input type="password" value={settings.apiKeys[settings.providerId] ?? ""}
                  onChange={(e) => setApiKey(settings.providerId, e.target.value)} placeholder="sk-..." />
                <Button variant="outline" size="icon" onClick={() => handleTestConnection(settings.providerId)}
                  disabled={connectionStatus[settings.providerId] === "testing"}>
                  {connectionStatus[settings.providerId] === "testing" ? <RefreshCw className="h-4 w-4 animate-spin" /> :
                   connectionStatus[settings.providerId] === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                   <Wifi className="h-4 w-4" />}
                </Button>
              </div>
              {connectionError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {connectionError}</p>}
            </div>
          )}
          {(settings.providerId === "gemini-local" || settings.providerId === "openrouter-local") && (
            <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
              {isAiProxyAvailable() ? (
                <><CheckCircle2 className="h-3 w-3 text-green-500" /> {s.ai.proxyOk}</>
              ) : (
                <><AlertCircle className="h-3 w-3 text-amber-500" /> {s.ai.proxyMissing}</>
              )}
            </p>
          )}
          {settings.providerId === "ollama" && (
            <div className="grid gap-2">
              <Label>{s.ai.baseUrl}</Label>
              <Input value={settings.baseUrls[settings.providerId] ?? ""}
                onChange={(e) => setBaseUrl(settings.providerId, e.target.value)}
                placeholder="http://localhost:11434" />
              <p className="text-xs text-muted-foreground">Default: http://localhost:11434</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.ai.keysTitle}</CardTitle>
          <CardDescription>{s.ai.keysDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.filter((p) => p.requiresApiKey).map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 grid gap-1">
                <Label className="text-xs">{p.name}</Label>
                <Input type="password" value={settings.apiKeys[p.id] ?? ""}
                  onChange={(e) => setApiKey(p.id, e.target.value)}
                  placeholder={`${p.name} API key`} className="text-sm" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleTestConnection(p.id)}
                disabled={connectionStatus[p.id] === "testing"} className="shrink-0">
                {connectionStatus[p.id] === "testing" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> :
                 connectionStatus[p.id] === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> :
                 connectionStatus[p.id] === "error" ? <WifiOff className="h-3.5 w-3.5 text-destructive" /> :
                 <Wifi className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.features.title}</CardTitle>
          <CardDescription>{s.features.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeatureToggle id="proactive" label={s.features.proactive}
            description={s.features.proactiveDesc}
            checked={settings.featureToggles.proactiveMode}
            onChange={(v) => setFeatureToggle("proactiveMode", v)} />
          <Separator />
          <FeatureToggle id="function-calling" label={s.features.functionCalling}
            description={s.features.functionCallingDesc}
            checked={settings.featureToggles.functionCalling}
            onChange={(v) => setFeatureToggle("functionCalling", v)} />
          <Separator />
          <FeatureToggle id="learning" label={s.features.learning}
            description={s.features.learningDesc}
            checked={settings.featureToggles.learning}
            onChange={(v) => setFeatureToggle("learning", v)} />
          <Separator />
          <FeatureToggle id="auto-suggestions" label={s.features.autoSuggestions}
            description={s.features.autoSuggestionsDesc}
            checked={settings.featureToggles.autoSuggestions}
            onChange={(v) => setFeatureToggle("autoSuggestions", v)} />
          <Separator />
          <FeatureToggle id="digest-auto" label={s.features.digestAuto}
            description={s.features.digestAutoDesc}
            checked={settings.featureToggles.digestAuto}
            onChange={(v) => setFeatureToggle("digestAuto", v)} />
          <div className="pt-2 px-1">
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              {s.features.reportsNote}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.privacy.title}</CardTitle>
          <CardDescription>{s.privacy.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{s.privacy.chatHistory}</p>
              <p className="text-xs text-muted-foreground">{s.privacy.chatHistoryDesc}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { clearChatHistory(); toast({ title: s.privacy.chatCleared }); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {s.privacy.clear}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{s.privacy.learningProfile}</p>
              <p className="text-xs text-muted-foreground">{s.privacy.learningProfileDesc}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetLearningProfile(); toast({ title: s.privacy.learningReset }); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {s.privacy.reset}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pb-8">
        <p className="text-xs text-muted-foreground">
          {s.footerNote}
        </p>
        <Button variant="ghost" size="sm" onClick={resetSettings}>{s.resetAll}</Button>
      </div>
    </>
  );
}

function FeatureToggle({ id, label, description, checked, onChange }: {
  id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
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
