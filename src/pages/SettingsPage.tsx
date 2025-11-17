import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  loadSettings,
  normalizeTenantUrl,
  saveSettings,
  type SafeQSettings,
  type EmailSettings,
  type EmailDeliveryMethod,
  type EmailTemplate,
  getDefaultEmailSettings,
  DEFAULT_PIN_TEMPLATE,
  DEFAULT_OTP_TEMPLATE,
} from "../services/settingsStore";
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

type TemplateKind = "pin" | "otp";

function SettingsPage() {
  const [tenantUrl, setTenantUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pinLength, setPinLength] = useState(4);
  const [otpLength, setOtpLength] = useState(8);
  const [otpUseUppercase, setOtpUseUppercase] = useState(true);
  const [otpUseLowercase, setOtpUseLowercase] = useState(true);
  const [otpUseNumbers, setOtpUseNumbers] = useState(true);
  const [otpUseSpecial, setOtpUseSpecial] = useState(false);
  const [otpExcludeCharacters, setOtpExcludeCharacters] = useState("1lI0Oo");
  const [shortIdLength, setShortIdLength] = useState(6);
  const [shortIdUseUppercase, setShortIdUseUppercase] = useState(true);
  const [shortIdUseLowercase, setShortIdUseLowercase] = useState(true);
  const [shortIdUseNumbers, setShortIdUseNumbers] = useState(true);
  const [shortIdUseSpecial, setShortIdUseSpecial] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(getDefaultEmailSettings());
  const [initialSettings, setInitialSettings] = useState<SafeQSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleEmailSettingChange = <K extends keyof EmailSettings>(field: K, value: EmailSettings[K]) => {
    setEmailSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTemplateChange = (kind: TemplateKind, field: keyof EmailTemplate, value: string) => {
    setEmailSettings((prev) => {
      const key: "pinTemplate" | "otpTemplate" = kind === "pin" ? "pinTemplate" : "otpTemplate";
      return {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        },
      };
    });
  };

  const resetTemplateToDefault = (kind: TemplateKind) => {
    setEmailSettings((prev) => ({
      ...prev,
      pinTemplate: kind === "pin" ? { ...DEFAULT_PIN_TEMPLATE } : prev.pinTemplate,
      otpTemplate: kind === "otp" ? { ...DEFAULT_OTP_TEMPLATE } : prev.otpTemplate,
    }));
  };

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
        setOtpLength(stored.otpLength ?? 8);
        setOtpUseUppercase(stored.otpUseUppercase ?? true);
        setOtpUseLowercase(stored.otpUseLowercase ?? true);
        setOtpUseNumbers(stored.otpUseNumbers ?? true);
        setOtpUseSpecial(stored.otpUseSpecial ?? false);
        setOtpExcludeCharacters(stored.otpExcludeCharacters ?? "1lI0Oo");
        setShortIdLength(stored.shortIdLength ?? 6);
        setShortIdUseUppercase(stored.shortIdUseUppercase ?? true);
        setShortIdUseLowercase(stored.shortIdUseLowercase ?? true);
        setShortIdUseNumbers(stored.shortIdUseNumbers ?? true);
        setShortIdUseSpecial(stored.shortIdUseSpecial ?? false);
        const normalizedEmail = cloneEmailSettings(stored.emailSettings ?? getDefaultEmailSettings());
        setEmailSettings(normalizedEmail);
        setInitialSettings({ ...stored, emailSettings: normalizedEmail });
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
      otpLength !== (initialSettings.otpLength ?? 8) ||
      otpUseUppercase !== (initialSettings.otpUseUppercase ?? true) ||
      otpUseLowercase !== (initialSettings.otpUseLowercase ?? true) ||
      otpUseNumbers !== (initialSettings.otpUseNumbers ?? true) ||
      otpUseSpecial !== (initialSettings.otpUseSpecial ?? false) ||
      otpExcludeCharacters !== (initialSettings.otpExcludeCharacters ?? "1lI0Oo") ||
      shortIdLength !== (initialSettings.shortIdLength ?? 6) ||
      shortIdUseUppercase !== (initialSettings.shortIdUseUppercase ?? true) ||
      shortIdUseLowercase !== (initialSettings.shortIdUseLowercase ?? true) ||
      shortIdUseNumbers !== (initialSettings.shortIdUseNumbers ?? true) ||
      shortIdUseSpecial !== (initialSettings.shortIdUseSpecial ?? false) ||
      !areEmailSettingsEqual(emailSettings, initialSettings.emailSettings ?? getDefaultEmailSettings())
    );
  }, [
    initialSettings,
    tenantUrl,
    apiKey,
    pinLength,
    otpLength,
    otpUseUppercase,
    otpUseLowercase,
    otpUseNumbers,
    otpUseSpecial,
    otpExcludeCharacters,
    shortIdLength,
    shortIdUseUppercase,
    shortIdUseLowercase,
    shortIdUseNumbers,
    shortIdUseSpecial,
    emailSettings,
  ]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const prepared = prepareSettings(
      tenantUrl,
      apiKey,
      pinLength,
      otpLength,
      otpUseUppercase,
      otpUseLowercase,
      otpUseNumbers,
      otpUseSpecial,
      otpExcludeCharacters,
      shortIdLength,
      shortIdUseUppercase,
      shortIdUseLowercase,
      shortIdUseNumbers,
      shortIdUseSpecial,
      cloneEmailSettings(emailSettings)
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
      setOtpLength(settings.otpLength ?? 8);
      setOtpUseUppercase(settings.otpUseUppercase ?? true);
      setOtpUseLowercase(settings.otpUseLowercase ?? true);
      setOtpUseNumbers(settings.otpUseNumbers ?? true);
      setOtpUseSpecial(settings.otpUseSpecial ?? false);
      setOtpExcludeCharacters(settings.otpExcludeCharacters ?? "1lI0Oo");
      setShortIdLength(settings.shortIdLength ?? 6);
      setShortIdUseUppercase(settings.shortIdUseUppercase ?? true);
      setShortIdUseLowercase(settings.shortIdUseLowercase ?? true);
      setShortIdUseNumbers(settings.shortIdUseNumbers ?? true);
      setShortIdUseSpecial(settings.shortIdUseSpecial ?? false);
      const normalizedEmail = cloneEmailSettings(settings.emailSettings ?? getDefaultEmailSettings());
      setEmailSettings(normalizedEmail);
      setInitialSettings({ ...settings, emailSettings: normalizedEmail });
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
                Use the base URL of your SAFEQ Cloud deployment. The value must begin with{" "}
                <code className="rounded bg-muted px-1 py-0.5">https://</code>.
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
            <CardTitle>Email Delivery</CardTitle>
            <CardDescription>Choose how PIN and OTP notifications are sent to users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-method">Delivery Method</Label>
              <select
                id="email-method"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={emailSettings.method}
                onChange={(event) => handleEmailSettingChange("method", event.currentTarget.value as EmailDeliveryMethod)}
                disabled={isLoading || isSaving}
              >
                <option value="desktop">Desktop mail client</option>
                <option value="graph">Microsoft Graph (app registration)</option>
              </select>
              <p className="text-sm text-muted-foreground">
                Desktop mail opens your default email app with a pre-filled draft. Microsoft Graph sends messages directly from the configured
                application.
              </p>
            </div>

            {emailSettings.method === "graph" && (
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  id="graph-tenant"
                  label="Tenant ID"
                  value={emailSettings.graphTenantId ?? ""}
                  onChange={(value) => handleEmailSettingChange("graphTenantId", value)}
                  disabled={isLoading || isSaving}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
                <InputField
                  id="graph-client"
                  label="Client ID"
                  value={emailSettings.graphClientId ?? ""}
                  onChange={(value) => handleEmailSettingChange("graphClientId", value)}
                  disabled={isLoading || isSaving}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="graph-secret">Client Secret</Label>
                  <Textarea
                    id="graph-secret"
                    value={emailSettings.graphClientSecret ?? ""}
                    onChange={(event) => handleEmailSettingChange("graphClientSecret", event.currentTarget.value)}
                    disabled={isLoading || isSaving}
                    placeholder="Paste a client secret generated for the SAFEQ mailer app registration"
                    className="min-h-[80px]"
                  />
                </div>
                <InputField
                  id="graph-sender"
                  label="Sender Address"
                  value={emailSettings.graphSenderAddress ?? ""}
                  onChange={(value) => handleEmailSettingChange("graphSenderAddress", value)}
                  disabled={isLoading || isSaving}
                  placeholder="printer-notify@contoso.com"
                  helperText="Must match a mailbox the app registration can send from"
                />
              </div>
            )}

            <div className="space-y-6">
              <TemplateEditor
                title="PIN Template"
                template={emailSettings.pinTemplate}
                onChange={(field, value) => handleTemplateChange("pin", field, value)}
                disabled={isLoading || isSaving}
                onReset={() => resetTemplateToDefault("pin")}
              />
              <TemplateEditor
                title="OTP Template"
                template={emailSettings.otpTemplate}
                onChange={(field, value) => handleTemplateChange("otp", field, value)}
                disabled={isLoading || isSaving}
                onReset={() => resetTemplateToDefault("otp")}
              />
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

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="otp-length">OTP Length</Label>
                <Input
                  id="otp-length"
                  type="number"
                  min="4"
                  max="16"
                  value={otpLength}
                  onChange={(e) => setOtpLength(parseInt(e.target.value) || 8)}
                  disabled={isLoading || isSaving}
                />
                <p className="text-sm text-muted-foreground">Number of characters for generated OTPs (4-16 characters).</p>
              </div>

              <div className="space-y-2">
                <Label>OTP Character Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={otpUseUppercase}
                      onChange={(e) => setOtpUseUppercase(e.target.checked)}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Uppercase (A-Z)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={otpUseLowercase}
                      onChange={(e) => setOtpUseLowercase(e.target.checked)}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Lowercase (a-z)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={otpUseNumbers}
                      onChange={(e) => setOtpUseNumbers(e.target.checked)}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Numbers (0-9)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={otpUseSpecial}
                      onChange={(e) => setOtpUseSpecial(e.target.checked)}
                      disabled={isLoading || isSaving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Special (!@#$%^&*)</span>
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">At least one character type must be selected.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp-exclude">Exclude Characters</Label>
                <Input
                  id="otp-exclude"
                  type="text"
                  value={otpExcludeCharacters}
                  onChange={(e) => setOtpExcludeCharacters(e.target.value)}
                  disabled={isLoading || isSaving}
                  placeholder="1lI0Oo"
                />
                <p className="text-sm text-muted-foreground">
                  Characters to exclude from generation (e.g., <code className="rounded bg-muted px-1 py-0.5">1lI0Oo</code> to avoid confusion between
                  similar-looking characters).
                </p>
              </div>
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
  otpLength: number,
  otpUseUppercase: boolean,
  otpUseLowercase: boolean,
  otpUseNumbers: boolean,
  otpUseSpecial: boolean,
  otpExcludeCharacters: string,
  shortIdLength: number,
  shortIdUseUppercase: boolean,
  shortIdUseLowercase: boolean,
  shortIdUseNumbers: boolean,
  shortIdUseSpecial: boolean,
  email: EmailSettings
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

  const emailValidationProblem = validateEmailSettings(email);
  if (emailValidationProblem) {
    return { problem: emailValidationProblem };
  }

  return {
    settings: {
      tenantUrl: normalizedUrl,
      apiKey: trimmedKey,
      pinLength,
      otpLength,
      otpUseUppercase,
      otpUseLowercase,
      otpUseNumbers,
      otpUseSpecial,
      otpExcludeCharacters,
      shortIdLength,
      shortIdUseUppercase,
      shortIdUseLowercase,
      shortIdUseNumbers,
      shortIdUseSpecial,
      emailSettings: cloneEmailSettings(email),
    },
  };
}

function validateEmailSettings(settings: EmailSettings): string | undefined {
  if (!settings.pinTemplate.subject.trim() || !settings.pinTemplate.body.trim()) {
    return "Provide both a subject and body for the PIN template.";
  }

  if (!settings.otpTemplate.subject.trim() || !settings.otpTemplate.body.trim()) {
    return "Provide both a subject and body for the OTP template.";
  }

  if (settings.method === "graph") {
    if (!settings.graphTenantId?.trim() || !settings.graphClientId?.trim() || !settings.graphClientSecret?.trim()) {
      return "Graph mail delivery requires tenant ID, client ID, and client secret.";
    }

    if (!settings.graphSenderAddress?.trim()) {
      return "Graph mail delivery requires a sender address.";
    }
  }

  return undefined;
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

function cloneEmailSettings(settings: EmailSettings): EmailSettings {
  return {
    ...settings,
    pinTemplate: { ...settings.pinTemplate },
    otpTemplate: { ...settings.otpTemplate },
  };
}

function areEmailSettingsEqual(a: EmailSettings, b: EmailSettings): boolean {
  return (
    a.method === b.method &&
    normalizeScalar(a.graphTenantId) === normalizeScalar(b.graphTenantId) &&
    normalizeScalar(a.graphClientId) === normalizeScalar(b.graphClientId) &&
    normalizeScalar(a.graphClientSecret) === normalizeScalar(b.graphClientSecret) &&
    normalizeScalar(a.graphSenderAddress) === normalizeScalar(b.graphSenderAddress) &&
    areTemplatesEqual(a.pinTemplate, b.pinTemplate) &&
    areTemplatesEqual(a.otpTemplate, b.otpTemplate)
  );
}

function normalizeScalar(value?: string | null): string {
  return value?.trim() ?? "";
}

function areTemplatesEqual(a: EmailTemplate, b: EmailTemplate): boolean {
  return a.subject.trim() === b.subject.trim() && a.body.trim() === b.body.trim();
}

type InputFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
};

function InputField({ id, label, value, onChange, disabled, placeholder, helperText }: InputFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
      {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}
    </div>
  );
}

type TemplateEditorProps = {
  title: string;
  template: EmailTemplate;
  onChange: (field: keyof EmailTemplate, value: string) => void;
  disabled?: boolean;
  onReset: () => void;
};

function TemplateEditor({ title, template, onChange, disabled, onReset }: TemplateEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{title}</h4>
        <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={disabled}>
          Reset to default
        </Button>
      </div>
      <div className="grid gap-3">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input value={template.subject} onChange={(event) => onChange("subject", event.currentTarget.value)} disabled={disabled} />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            value={template.body}
            onChange={(event) => onChange("body", event.currentTarget.value)}
            disabled={disabled}
            className="min-h-[150px]"
          />
          <p className="text-sm text-muted-foreground">
            Available tokens: <code>{"{{userName}}"}</code>, <code>{"{{fullName}}"}</code>, <code>{"{{pin}}"}</code>, <code>{"{{otp}}"}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
