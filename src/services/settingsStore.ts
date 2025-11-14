import { LazyStore } from "@tauri-apps/plugin-store";

export type EmailDeliveryMethod = "desktop" | "graph";

export type EmailTemplate = {
  subject: string;
  body: string;
};

export type EmailSettings = {
  method: EmailDeliveryMethod;
  graphTenantId?: string;
  graphClientId?: string;
  graphClientSecret?: string;
  graphSenderAddress?: string;
  pinTemplate: EmailTemplate;
  otpTemplate: EmailTemplate;
};

export type SafeQSettings = {
  tenantUrl: string;
  apiKey: string;
  pinLength?: number;
  shortIdLength?: number;
  shortIdUseUppercase?: boolean;
  shortIdUseLowercase?: boolean;
  shortIdUseNumbers?: boolean;
  shortIdUseSpecial?: boolean;
  emailSettings?: EmailSettings;
};

export const DEFAULT_PIN_TEMPLATE: EmailTemplate = {
  subject: "Your SAFEQ PIN",
  body: [
    "Hello {{fullName || userName}},",
    "",
    "Your new SAFEQ PIN is {{pin}}.",
    "Use this code to access printers that require a numeric PIN.",
    "",
    "Thanks,",
    "SAFEQ Cloud Administrator",
  ].join("\n"),
};

export const DEFAULT_OTP_TEMPLATE: EmailTemplate = {
  subject: "Your SAFEQ OTP",
  body: [
    "Hello {{fullName || userName}},",
    "",
    "Your one-time password is {{otp}}.",
    "Enter this code when the portal or device asks for an OTP.",
    "",
    "Thanks,",
    "SAFEQ Cloud Administrator",
  ].join("\n"),
};

export function getDefaultEmailSettings(): EmailSettings {
  return {
    method: "desktop",
    graphTenantId: undefined,
    graphClientId: undefined,
    graphClientSecret: undefined,
    graphSenderAddress: undefined,
    pinTemplate: { ...DEFAULT_PIN_TEMPLATE },
    otpTemplate: { ...DEFAULT_OTP_TEMPLATE },
  };
}

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
    emailSettings: normalizeEmailSettings(raw.emailSettings),
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
    emailSettings: settings.emailSettings ? sanitizeEmailSettings(settings.emailSettings) : getDefaultEmailSettings(),
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

  // If no scheme is provided, default to https
  const urlWithScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(urlWithScheme);
    const normalized = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, "");
    return normalized;
  } catch (error) {
    return trimmed;
  }
}

function normalizeEmailSettings(raw?: SafeQSettings["emailSettings"]): EmailSettings {
  if (!raw) {
    return getDefaultEmailSettings();
  }

  return {
    method: raw.method ?? "desktop",
    graphTenantId: normalizeOptional(raw.graphTenantId),
    graphClientId: normalizeOptional(raw.graphClientId),
    graphClientSecret: normalizeOptional(raw.graphClientSecret),
    graphSenderAddress: normalizeOptional(raw.graphSenderAddress),
    pinTemplate: normalizeTemplate(raw.pinTemplate, DEFAULT_PIN_TEMPLATE),
    otpTemplate: normalizeTemplate(raw.otpTemplate, DEFAULT_OTP_TEMPLATE),
  };
}

function normalizeTemplate(candidate: EmailTemplate | undefined, fallback: EmailTemplate): EmailTemplate {
  if (!candidate) {
    return { ...fallback };
  }

  return {
    subject: candidate.subject?.trim() || fallback.subject,
    body: candidate.body?.trim() || fallback.body,
  };
}

function sanitizeEmailSettings(settings: EmailSettings): EmailSettings {
  return {
    method: settings.method,
    graphTenantId: normalizeOptional(settings.graphTenantId),
    graphClientId: normalizeOptional(settings.graphClientId),
    graphClientSecret: normalizeOptional(settings.graphClientSecret),
    graphSenderAddress: normalizeOptional(settings.graphSenderAddress),
    pinTemplate: {
      subject: settings.pinTemplate.subject.trim(),
      body: settings.pinTemplate.body.trim(),
    },
    otpTemplate: {
      subject: settings.otpTemplate.subject.trim(),
      body: settings.otpTemplate.body.trim(),
    },
  };
}

function normalizeOptional(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
