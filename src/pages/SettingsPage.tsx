import { FormEvent, useEffect, useMemo, useState } from "react";
import { loadSettings, normalizeTenantUrl, saveSettings, type SafeQSettings } from "../services/settingsStore";

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
    <section className="page">
      <header className="page-header">
        <h2>Tenant Settings</h2>
        <p>
          Provide the SAFEQ Cloud tenant URL and API key used for authenticated requests. These values stay on-device via the encrypted Tauri store.
        </p>
      </header>

      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="tenant-url">
          Tenant URL
          <input
            id="tenant-url"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://tenant.safeq.cloud"
            value={tenantUrl}
            onChange={(event) => setTenantUrl(event.currentTarget.value)}
            disabled={isLoading || isSaving}
          />
          <span className="helper-text">
            Use the base URL of your SAFEQ Cloud deployment. The value must begin with <code>https://</code>.
          </span>
        </label>

        <label htmlFor="api-key">
          API key
          <textarea
            id="api-key"
            placeholder="Paste an API key with user management scopes"
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
            disabled={isLoading || isSaving}
          />
          <span className="helper-text">The key is stored locally and sent only when invoking SAFEQ Cloud API requests.</span>
        </label>

        <h3>Generation Settings</h3>

        <label htmlFor="pin-length">
          PIN Length
          <input
            id="pin-length"
            type="number"
            min="4"
            max="8"
            value={pinLength}
            onChange={(e) => setPinLength(parseInt(e.target.value) || 4)}
            disabled={isLoading || isSaving}
          />
          <span className="helper-text">Number of digits for generated PINs (4-8 digits, numeric only).</span>
        </label>

        <div className="settings-actions">
          <button type="submit" disabled={!hasChanges || isSaving || isLoading}>
            {isSaving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      {notice ? <div className={`status ${notice.tone}`}>{notice.message}</div> : null}
    </section>
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
