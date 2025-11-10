import { LazyStore } from "@tauri-apps/plugin-store";

export type SafeQSettings = {
  tenantUrl: string;
  apiKey: string;
  pinLength?: number;
  shortIdLength?: number;
  shortIdUseUppercase?: boolean;
  shortIdUseLowercase?: boolean;
  shortIdUseNumbers?: boolean;
  shortIdUseSpecial?: boolean;
};

const SETTINGS_FILE = "safeq-settings.json";
const SETTINGS_KEY = "safeqCredentials";

let store: LazyStore | null = null;

async function getStore(): Promise<LazyStore> {
  if (!store) {
    store = new LazyStore(SETTINGS_FILE);
  }

  return store;
}

export async function loadSettings(): Promise<SafeQSettings | null> {
  const storage = await getStore();
  const raw = await storage.get<SafeQSettings>(SETTINGS_KEY);

  if (!raw) {
    return null;
  }

  return {
    tenantUrl: raw.tenantUrl?.trim() ?? "",
    apiKey: raw.apiKey?.trim() ?? "",
    pinLength: raw.pinLength,
    shortIdLength: raw.shortIdLength,
    shortIdUseUppercase: raw.shortIdUseUppercase,
    shortIdUseLowercase: raw.shortIdUseLowercase,
    shortIdUseNumbers: raw.shortIdUseNumbers,
    shortIdUseSpecial: raw.shortIdUseSpecial,
  };
}

export async function saveSettings(settings: SafeQSettings) {
  const payload: SafeQSettings = {
    tenantUrl: settings.tenantUrl.trim(),
    apiKey: settings.apiKey.trim(),
    pinLength: settings.pinLength,
    shortIdLength: settings.shortIdLength,
    shortIdUseUppercase: settings.shortIdUseUppercase,
    shortIdUseLowercase: settings.shortIdUseLowercase,
    shortIdUseNumbers: settings.shortIdUseNumbers,
    shortIdUseSpecial: settings.shortIdUseSpecial,
  };

  const storage = await getStore();
  await storage.set(SETTINGS_KEY, payload);
  await storage.save();
}

export function normalizeTenantUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const normalized = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, "");
    return normalized;
  } catch (error) {
    return trimmed;
  }
}
