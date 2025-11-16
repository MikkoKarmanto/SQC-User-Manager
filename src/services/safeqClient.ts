import { invoke } from "@tauri-apps/api/core";

export type SafeQUsersPayload = unknown;
export type SafeQProvidersPayload = unknown;

export async function listSafeQUsers(): Promise<SafeQUsersPayload> {
  return invoke<SafeQUsersPayload>("list_safeq_users");
}

export async function listAuthProviders(): Promise<SafeQProvidersPayload> {
  return invoke<SafeQProvidersPayload>("list_auth_providers");
}

export async function listUsersForProvider(providerId: number): Promise<SafeQUsersPayload> {
  return invoke<SafeQUsersPayload>("list_users_for_provider", { providerId });
}

export async function updateUserCard(username: string, providerId: number | null, cardId: string | null): Promise<unknown> {
  return invoke("update_user_card", { username, providerId, cardId });
}

export async function updateUserShortId(username: string, providerId: number | null, shortId: string | null): Promise<unknown> {
  return invoke("update_user_short_id", { username, providerId, shortId });
}

export async function updateUserPin(username: string, providerId: number | null, pin: string | null): Promise<unknown> {
  return invoke("update_user_pin", { username, providerId, pin });
}

export async function generateUserPin(username: string, providerId: number | null): Promise<{ pin: string }> {
  return invoke("generate_user_pin", { username, providerId });
}

export async function generateUserOtp(username: string, providerId: number | null): Promise<{ otp: string }> {
  return invoke("generate_user_otp", { username, providerId });
}

export async function createUsers(
  users: unknown[],
  autoGeneratePin: boolean = false,
  autoGenerateOtp: boolean = false
): Promise<{ success: number; failed: number }> {
  return invoke("create_users", { users, autoGeneratePin, autoGenerateOtp });
}

export interface BulkGenerationResult {
  success: number;
  failed: number;
  results: Array<{
    user: unknown;
    success: boolean;
    value?: string;
    error?: string;
  }>;
}

export async function generateBulkPins(users: unknown[]): Promise<BulkGenerationResult> {
  return invoke("generate_bulk_pins", { users });
}

export async function generateBulkOtps(users: unknown[]): Promise<BulkGenerationResult> {
  return invoke("generate_bulk_otps", { users });
}

export type PreparedEmailMessage = {
  to: string;
  subject: string;
  body: string;
  contentType?: "text" | "html";
};

export async function sendGraphEmails(messages: PreparedEmailMessage[]): Promise<{ success: number; failed: number; errors: string[] }> {
  return invoke("send_graph_emails", { messages });
}
