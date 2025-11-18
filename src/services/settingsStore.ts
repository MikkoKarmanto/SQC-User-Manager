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
  otpLength?: number;
  otpUseUppercase?: boolean;
  otpUseLowercase?: boolean;
  otpUseNumbers?: boolean;
  otpUseSpecial?: boolean;
  otpExcludeCharacters?: string;
  shortIdLength?: number;
  shortIdUseUppercase?: boolean;
  shortIdUseLowercase?: boolean;
  shortIdUseNumbers?: boolean;
  shortIdUseSpecial?: boolean;
  emailSettings?: EmailSettings;
};

export const DEFAULT_PIN_TEMPLATE: EmailTemplate = {
  subject: "SAFEQ Cloud PIN",
  body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>SAFEQ Cloud PIN</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            color: #333333;
            background-color: #f9f9f9;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border: 1px solid #dddddd;
            border-radius: 6px;
            padding: 20px;
        }
        h2 {
            color: #2c3e50;
        }
        .pin {
            font-size: 24px;
            font-weight: bold;
            color: #0078d4;
            margin: 15px 0;
        }
        p {
            line-height: 1.6;
        }
        .footer {
            margin-top: 20px;
            font-size: 14px;
            color: #777777;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Hello {{fullName || userName}},</h2>
        <p>Your new SAFEQ Cloud PIN is:</p>
        <div class="pin">{{pin}}</div>
        <p>
            Use this code to access printers that require a PIN.
        </p>
        <div class="footer">
            Thanks,<br>
            SAFEQ Cloud Administrator
        </div>
    </div>
</body>
</html>`,
};

export const DEFAULT_OTP_TEMPLATE: EmailTemplate = {
  subject: "SAFEQ Cloud OTP",
  body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>SAFEQ Cloud One-Time Password</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            color: #333333;
            background-color: #f9f9f9;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border: 1px solid #dddddd;
            border-radius: 6px;
            padding: 20px;
        }
        h2 {
            color: #2c3e50;
        }
        .otp {
            font-size: 24px;
            font-weight: bold;
            color: #0078d4;
            margin: 15px 0;
        }
        p {
            line-height: 1.6;
        }
        .footer {
            margin-top: 20px;
            font-size: 14px;
            color: #777777;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Hello {{fullName || userName}},</h2>
        <p>Your one-time password is:</p>
        <div class="otp">{{otp}}</div>
        <p>
            You can use this code to register your access card / tag at the MFD.
        </p>
        <p>
            Show your card / tag to the MFD's card reader, then enter your username and this code when prompted.
        </p>
        <div class="footer">
            Thanks,<br>
            SAFEQ Cloud Administrator
        </div>
    </div>
</body>
</html>`,
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
