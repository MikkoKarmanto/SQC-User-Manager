import type { SafeQUser } from "@/types/safeq";
import { loadSettings, getDefaultEmailSettings, type EmailDeliveryMethod } from "./settingsStore";
import { sendGraphEmails } from "./safeqClient";

export type CredentialType = "pin" | "otp";

export interface EmailDeliveryRequest {
  user: SafeQUser;
  pinOverride?: string | null;
  otpOverride?: string | null;
}

export interface EmailDeliveryResult {
  method: EmailDeliveryMethod;
  success: number;
  failed: number;
  errors: string[];
}

interface DraftEmail {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

interface PreparedMessage extends DraftEmail {
  contentType: "text" | "html";
}

/**
 * Detects if the content contains HTML tags
 */
function isHtmlContent(content: string): boolean {
  // Check for common HTML tags
  const htmlTagPattern = /<(p|div|br|span|strong|em|h[1-6]|ul|ol|li|table|tr|td|th|a|img|html|body|head)[^>]*>/i;
  return htmlTagPattern.test(content);
}

/**
 * Strips HTML tags and converts to plain text for mailto
 */
function stripHtml(html: string): string {
  // Remove DOCTYPE, comments, and CDATA
  let text = html.replace(/<!DOCTYPE[^>]*>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  // Remove entire <head>, <style>, and <script> sections with their content
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Remove <html>, <body>, and other structural tags
  text = text.replace(/<\/?html[^>]*>/gi, "");
  text = text.replace(/<\/?body[^>]*>/gi, "");
  text = text.replace(/<\/?head[^>]*>/gi, "");

  // Replace heading tags with their content followed by newlines
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "$1\n\n");

  // Replace <br>, <br/>, <br /> with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Replace </p>, </div>, </li> with double newlines for separation
  text = text.replace(/<\/(?:p|div|li)>/gi, "\n\n");

  // Replace </tr>, </th>, </td> with newlines for table formatting
  text = text.replace(/<\/(?:tr|th|td)>/gi, "\n");

  // Remove opening tags for block elements
  text = text.replace(/<(?:p|div|ul|ol|li|table|tr|td|th)[^>]*>/gi, "");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");

  // Clean up excessive whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/ *\n */g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing whitespace from each line
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Remove empty lines at the start and end
  text = text.replace(/^\n+/, "").replace(/\n+$/, "");

  return text;
}

export async function sendCredentialEmails(requests: EmailDeliveryRequest[], type: CredentialType): Promise<EmailDeliveryResult> {
  const settings = (await loadSettings()) ?? null;
  if (!settings || !settings.emailSettings) {
    throw new Error("Email settings are not configured. Save the email delivery section in Settings first.");
  }

  const emailSettings = settings.emailSettings ?? getDefaultEmailSettings();
  const template = type === "pin" ? emailSettings.pinTemplate : emailSettings.otpTemplate;

  const templateErrors: string[] = [];
  const drafts: DraftEmail[] = [];

  const contexts = requests.map((request) => createContext(request, type));

  contexts.forEach((context) => {
    if ("error" in context) {
      templateErrors.push(context.error);
      return;
    }

    const tokens = context.tokens;
    const subject = renderTemplate(template.subject, tokens).trim();
    const body = renderTemplate(template.body, tokens).trim();
    const isHtml = isHtmlContent(body);

    if (!subject || !body) {
      templateErrors.push(`${tokens.userName}: template subject or body is empty after rendering.`);
      return;
    }

    drafts.push({ to: tokens.email, subject, body, isHtml });
  });

  if (drafts.length === 0) {
    return {
      method: emailSettings.method,
      success: 0,
      failed: templateErrors.length,
      errors: templateErrors,
    };
  }

  if (emailSettings.method === "graph") {
    const graphResult = await sendGraphEmails(
      drafts.map<PreparedMessage>((draft) => ({
        ...draft,
        contentType: draft.isHtml ? "html" : "text",
      }))
    );

    return {
      method: "graph",
      success: graphResult.success,
      failed: graphResult.failed + templateErrors.length,
      errors: [...templateErrors, ...graphResult.errors],
    };
  }

  const desktopResult = await openMailDrafts(drafts);
  const failedDrafts = drafts.length - desktopResult.opened;

  return {
    method: "desktop",
    success: desktopResult.opened,
    failed: templateErrors.length + failedDrafts,
    errors: [...templateErrors, ...desktopResult.errors],
  };
}

type TemplateTokens = {
  userName: string;
  fullName: string;
  email: string;
  pin: string;
  otp: string;
};

type TemplateContextResult = { tokens: TemplateTokens } | { error: string };

function createContext(request: EmailDeliveryRequest, type: CredentialType): TemplateContextResult {
  const email = request.user.email?.trim();
  if (!email) {
    return { error: `${request.user.userName}: user is missing an email address.` };
  }

  const pinValue = request.pinOverride ?? request.user.shortId ?? null;
  const otpValue = request.otpOverride ?? request.user.otp ?? null;

  const credentialValue = type === "pin" ? pinValue : otpValue;
  if (!credentialValue) {
    return { error: `${request.user.userName}: no ${type.toUpperCase()} value is available to send.` };
  }

  const tokens = {
    userName: request.user.userName ?? "",
    fullName: request.user.fullName ?? "",
    email,
    pin: pinValue ?? "",
    otp: otpValue ?? "",
  };

  return { tokens };
}

const TOKEN_PATTERN = /{{\s*([^}]+)\s*}}/g;

function renderTemplate(template: string, tokens: TemplateTokens) {
  return template.replace(TOKEN_PATTERN, (_, expression: string) => {
    const fallbacks = expression.split("||").map((chunk) => chunk.trim());

    for (const candidate of fallbacks) {
      const key = candidate as keyof typeof tokens;
      const value = tokens[key];
      if (value && value.length > 0) {
        return value;
      }
    }

    return "";
  });
}

async function openMailDrafts(drafts: DraftEmail[]) {
  let opened = 0;
  const errors: string[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    // Strip HTML tags for mailto protocol (doesn't support HTML)
    const plainBody = draft.isHtml ? stripHtml(draft.body) : draft.body;
    const mailtoUrl = buildMailtoUrl(draft.to, draft.subject, plainBody);

    try {
      await openMailtoUrl(mailtoUrl, index * 150);
      opened += 1;
    } catch (error) {
      errors.push(`${draft.to}: ${error instanceof Error ? error.message : "Unable to open mail client"}`);
    }
  }

  return { opened, errors };
}

async function openMailtoUrl(url: string, delayMs: number = 0) {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (isTauriEnvironment()) {
    const open = await getTauriOpen();
    await open(url);
    return;
  }

  const newWindow = window.open(url, "_blank");
  if (!newWindow) {
    throw new Error("Mail draft was blocked by the browser");
  }
}

function buildMailtoUrl(to: string, subject: string, body: string) {
  const encodedSubject = encodeURIComponent(subject);
  const normalizedBody = body.replace(/\r?\n/g, "\r\n");
  const encodedBody = encodeURIComponent(normalizedBody);
  return `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
}

type TauriOpenFn = (url: string | URL, openWith?: string) => Promise<void>;
let cachedTauriOpen: TauriOpenFn | null = null;

async function getTauriOpen(): Promise<TauriOpenFn> {
  if (!cachedTauriOpen) {
    const mod = await import("@tauri-apps/plugin-opener");
    cachedTauriOpen = mod.openUrl;
  }

  return cachedTauriOpen;
}

function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean((window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}
