import { FormEvent, useEffect, useMemo, useState } from "react";
import { loadSettings, normalizeTenantUrl, saveSettings, type SafeQSettings } from "../services/settingsStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Notice = {
  tone: "success" | "error";
  message: string;
};

function SettingsPage() {
  const [tenantUrl, setTenantUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pinLength, setPinLength] = useState(4);
  const [shortIdLength, setShortIdLength] = useState(6);
  const [shortIdUseUppercase, setShortIdUseUppercase] = useState(true);
  const [shortIdUseLowercase, setShortIdUseLowercase] = useState(true);
  const [shortIdUseNumbers, setShortIdUseNumbers] = useState(true);
  const [shortIdUseSpecial, setShortIdUseSpecial] = useState(false);
  const [initialSettings, setInitialSettings] = useState<SafeQSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadSettings()
      .then((stored) => {
        if (!isMounted || !stored) {
          return;
        }

        setTenantUrl(stored.tenantUrl);
        setApiKey(stored.apiKey);
        setPinLength(stored.pinLength ?? 4);
        setShortIdLength(stored.shortIdLength ?? 6);
        setShortIdUseUppercase(stored.shortIdUseUppercase ?? true);
        setShortIdUseLowercase(stored.shortIdUseLowercase ?? true);
        setShortIdUseNumbers(stored.shortIdUseNumbers ?? true);
        setShortIdUseSpecial(stored.shortIdUseSpecial ?? false);
        setInitialSettings(stored);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const hasChanges = useMemo(() => {
    if (!initialSettings) {
      return tenantUrl.trim().length > 0 || apiKey.trim().length > 0;
    }

    return (
      normalizeTenantUrlWithFallback(tenantUrl) !== initialSettings.tenantUrl ||
      apiKey.trim() !== initialSettings.apiKey ||
      pinLength !== (initialSettings.pinLength ?? 4) ||
      shortIdLength !== (initialSettings.shortIdLength ?? 6) ||
      shortIdUseUppercase !== (initialSettings.shortIdUseUppercase ?? true) ||
      shortIdUseLowercase !== (initialSettings.shortIdUseLowercase ?? true) ||
      shortIdUseNumbers !== (initialSettings.shortIdUseNumbers ?? true) ||
      shortIdUseSpecial !== (initialSettings.shortIdUseSpecial ?? false)
    );
  }, [initialSettings, tenantUrl, apiKey, pinLength, shortIdLength, shortIdUseUppercase, shortIdUseLowercase, shortIdUseNumbers, shortIdUseSpecial]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const prepared = prepareSettings(
      tenantUrl,
      apiKey,
      pinLength,
      shortIdLength,
      shortIdUseUppercase,
      shortIdUseLowercase,
      shortIdUseNumbers,
      shortIdUseSpecial
    );
    if (prepared.problem) {
      setNotice({ tone: "error", message: prepared.problem });
      return;
    }

    const settings = prepared.settings;
    if (!settings) {
      setNotice({ tone: "error", message: "Unable to resolve settings." });
      return;
    }

    setIsSaving(true);
    try {
      await saveSettings(settings);
      setTenantUrl(settings.tenantUrl);
      setApiKey(settings.apiKey);
      setPinLength(settings.pinLength ?? 4);
      setShortIdLength(settings.shortIdLength ?? 6);
      setShortIdUseUppercase(settings.shortIdUseUppercase ?? true);
      setShortIdUseLowercase(settings.shortIdUseLowercase ?? true);
      setShortIdUseNumbers(settings.shortIdUseNumbers ?? true);
      setShortIdUseSpecial(settings.shortIdUseSpecial ?? false);
      setInitialSettings(settings);
      setNotice({ tone: "success", message: "Settings saved locally." });
    } catch (error) {
      setNotice({ tone: "error", message: toErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Tenant Settings</h2>
        <p className="mt-2 text-muted-foreground">
          Provide the SAFEQ Cloud tenant URL and API key used for authenticated requests. These values stay on-device via the encrypted Tauri store.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>Configure your SAFEQ Cloud tenant connection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-url">Tenant URL</Label>
              <Input
                id="tenant-url"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://tenant.safeq.cloud"
                value={tenantUrl}
                onChange={(event) => setTenantUrl(event.currentTarget.value)}
                disabled={isLoading || isSaving}
              />
              <p className="text-sm text-muted-foreground">
                Use the base URL of your SAFEQ Cloud deployment. The value must begin with <code className="rounded bg-muted px-1 py-0.5">https://</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Textarea
                id="api-key"
                placeholder="Paste an API key with user management scopes"
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
                disabled={isLoading || isSaving}
                className="min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground">The key is stored locally and sent only when invoking SAFEQ Cloud API requests.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>Configure PIN and OTP generation parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin-length">PIN Length</Label>
              <Input
                id="pin-length"
                type="number"
                min="4"
                max="8"
                value={pinLength}
                onChange={(e) => setPinLength(parseInt(e.target.value) || 4)}
                disabled={isLoading || isSaving}
              />
              <p className="text-sm text-muted-foreground">Number of digits for generated PINs (4-8 digits, numeric only).</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={!hasChanges || isSaving || isLoading}>
            {isSaving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </form>

      {notice && (
        <div
          className={`mt-6 flex items-center gap-2 rounded-md border p-4 ${
            notice.tone === "success"
              ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
          }`}
        >
          {notice.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{notice.message}</span>
        </div>
      )}
    </div>
  );
}

function prepareSettings(
  tenantUrl: string,
  apiKey: string,
  pinLength: number,
  shortIdLength: number,
  shortIdUseUppercase: boolean,
  shortIdUseLowercase: boolean,
  shortIdUseNumbers: boolean,
  shortIdUseSpecial: boolean
): {
  settings?: SafeQSettings;
  problem?: string;
} {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { problem: "API key is required." };
  }

  const normalizedUrl = normalizeTenantUrlWithFallback(tenantUrl);
  if (!normalizedUrl) {
    return { problem: "Tenant URL is required." };
  }

  try {
    // Throws if invalid
    new URL(normalizedUrl);
  } catch (error) {
    return { problem: "Tenant URL is not a valid address." };
  }

  return {
    settings: {
      tenantUrl: normalizedUrl,
      apiKey: trimmedKey,
      pinLength,
      shortIdLength,
      shortIdUseUppercase,
      shortIdUseLowercase,
      shortIdUseNumbers,
      shortIdUseSpecial,
    },
  };
}

function normalizeTenantUrlWithFallback(input: string): string {
  const candidate = input.trim();
  if (!candidate) {
    return "";
  }

  return normalizeTenantUrl(candidate);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error while saving settings.";
}

export default SettingsPage;
