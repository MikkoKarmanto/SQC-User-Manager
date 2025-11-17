# Microsoft 365 Email Integration Setup Guide

This guide explains how the SQC-User-Manager application sends emails via Microsoft Graph API and provides step-by-step instructions for creating and configuring the required Entra ID (Azure AD) application registration.

## Table of Contents

- [Overview](#overview)
- [How Email Sending Works](#how-email-sending-works)
- [Entra ID Application Setup](#entra-id-application-setup)
- [Configuration in SQC-User-Manager](#configuration-in-sqc-user-manager)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

SQC-User-Manager supports two email delivery methods:

1. **Desktop Mail Client** - Opens pre-filled email drafts in your default email application
2. **Microsoft Graph** - Sends emails directly through Microsoft 365 using an Entra ID application

This document focuses on the **Microsoft Graph** method, which requires an Entra ID application registration with specific permissions.

## How Email Sending Works

### Authentication Flow

The application uses **OAuth 2.0 Client Credentials Flow** to authenticate with Microsoft Graph:

1. **Token Request**: The application requests an access token from Microsoft's token endpoint:

   ```http
   POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
   ```

2. **Token Parameters**:

   - `client_id` - The application (client) ID
   - `client_secret` - The client secret value
   - `scope` - Always `https://graph.microsoft.com/.default`
   - `grant_type` - Always `client_credentials`

3. **Access Token**: Microsoft returns a JWT access token that's valid for 60-90 minutes

4. **Send Email**: The application uses the token to call Microsoft Graph:

   ```http
   POST https://graph.microsoft.com/v1.0/users/{sender_address}/sendMail
   ```

### Email Sending Process

When sending credential emails (PIN or OTP):

1. The application loads email settings from the local Tauri store (`safeq-settings.json`)
2. For each user, it renders the email template with their credentials
3. It requests an OAuth access token (cached for subsequent sends)
4. For each recipient, it constructs a Microsoft Graph email payload:
   ```json
   {
     "message": {
       "subject": "Your SAFEQ PIN",
       "body": {
         "contentType": "Text",
         "content": "Hello John Doe,\n\nYour new PIN is 1234..."
       },
       "toRecipients": [
         {
           "emailAddress": {
             "address": "john.doe@contoso.com"
           }
         }
       ]
     },
     "saveToSentItems": false
   }
   ```
5. It sends the email via Microsoft Graph API with the bearer token
6. Results are collected and displayed to the user

### Technical Implementation

**Backend (Rust)**:

- `src-tauri/src/email.rs` - Contains the email sending logic
- `send_graph_emails()` - Main function that orchestrates email delivery
- `fetch_access_token()` - Handles OAuth token acquisition
- Uses `reqwest` HTTP client with rustls TLS

**Frontend (TypeScript)**:

- `src/services/emailDelivery.ts` - Prepares email payloads
- `src/services/safeqClient.ts` - Invokes Rust backend commands
- `src/pages/SettingsPage.tsx` - UI for configuring email settings

**Settings Storage**:

- Credentials stored in `safeq-settings.json` via Tauri plugin-store
- All values encrypted at rest by the Tauri store plugin
- Never exposed to frontend except during initial configuration

## Entra ID Application Setup

### Prerequisites

- Microsoft 365 tenant with administrative access
- Entra ID (Azure AD) admin privileges to create app registrations
- A mailbox that will be used as the sender (e.g., `printer-notify@contoso.com`)

### Step-by-Step Setup

#### 1. Create a New App Registration

1. Navigate to the [Azure Portal](https://portal.azure.com)
2. Go to **Entra ID** (formerly Azure Active Directory)
3. Select **App registrations** from the left menu
4. Click **+ New registration**

**Registration Settings**:

- **Name**: `SAFEQ User Manager Email Sender` (or your preferred name)
- **Supported account types**: Select **Accounts in this organizational directory only (Single tenant)**
- **Redirect URI**: Leave blank (not needed for client credentials flow)

Click **Register**.

#### 2. Note the Application (Client) ID and Tenant ID

After registration, you'll see the **Overview** page:

- **Application (client) ID**: Copy this value - you'll need it for the `graphClientId` setting
  - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: Copy this value - you'll need it for the `graphTenantId` setting
  - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

#### 3. Create a Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. Add a description: `SAFEQ User Manager Secret`
4. Select an expiration period:
   - **Recommended**: 24 months (renew before expiration)
   - **Maximum**: Custom (up to 24 months for most tenants)
5. Click **Add**

**Important**: Copy the **Value** immediately - it will only be shown once. This is your `graphClientSecret`.

> ⚠️ **Security Note**: Store this secret securely. If lost, you'll need to generate a new one. Set a calendar reminder before the expiration date to renew it.

#### 4. Configure API Permissions

1. Go to **API permissions** in your app registration
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Application permissions** (not Delegated)
5. Search for and add: **`Mail.Send`**
   - Expand the **Mail** category
   - Check **Mail.Send**
   - This allows the application to send mail as any user in your organization
6. Click **Add permissions**

**Grant Admin Consent**:

1. After adding the permission, click **✓ Grant admin consent for [Your Tenant]**
2. Confirm by clicking **Yes**
3. The status column should now show a green checkmark with "Granted for [Your Tenant]"

**Final Permission List**:
Your app should have these permissions:

- **Microsoft Graph - Application permissions**:
  - `Mail.Send` - ✓ Granted

> 📝 **Note**: `Mail.Send` is an application-level permission that allows sending mail on behalf of any user. It requires admin consent and should be used carefully.

#### 5. Configure Application Access Policy (Recommended)

To enhance security, restrict which mailboxes the application can send from:

1. Install **Exchange Online PowerShell** module (if not already installed):

   ```powershell
   Install-Module -Name ExchangeOnlineManagement
   ```

2. Connect to Exchange Online:

   ```powershell
   Connect-ExchangeOnline -UserPrincipalName admin@contoso.com
   ```

3. Create an application access policy:

   ```powershell
   New-ApplicationAccessPolicy `
     -AppId "YOUR_CLIENT_ID_HERE" `
     -PolicyScopeGroupId "printer-notify@contoso.com" `
     -AccessRight RestrictAccess `
     -Description "Restrict SAFEQ User Manager to send from printer-notify mailbox only"
   ```

   Replace:

   - `YOUR_CLIENT_ID_HERE` - With your Application (client) ID
   - `printer-notify@contoso.com` - With your sender mailbox address

4. Test the policy:

   ```powershell
   Test-ApplicationAccessPolicy `
     -AppId "YOUR_CLIENT_ID_HERE" `
     -Identity "printer-notify@contoso.com"
   ```

   Expected output: `AccessCheckResult : Granted`

> 💡 **Best Practice**: Always use application access policies to limit scope. This prevents the app from sending mail as any user if credentials are compromised.

## Configuration in SQC-User-Manager

### Entering Configuration

1. Open SQC-User-Manager
2. Navigate to **Settings**
3. Scroll to **Email Delivery** section
4. Set **Delivery Method** to `Microsoft Graph (app registration)`

Enter the values from your Entra ID app registration:

| Field              | Value                                  | Source                                                  |
| ------------------ | -------------------------------------- | ------------------------------------------------------- |
| **Tenant ID**      | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Entra ID → App Overview → Directory (tenant) ID         |
| **Client ID**      | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Entra ID → App Overview → Application (client) ID       |
| **Client Secret**  | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`        | Entra ID → Certificates & secrets → Client secret value |
| **Sender Address** | `printer-notify@contoso.com`           | Your designated sender mailbox                          |

### Customize Email Templates

The settings page also allows you to customize PIN and OTP email templates:

**Available Template Variables**:

- `{{userName}}` - User's login name
- `{{fullName}}` - User's display name (falls back to userName if not set)
- `{{email}}` - User's email address
- `{{pin}}` - Generated PIN (4-8 digits)
- `{{otp}}` - Generated OTP (4-16 characters)
- `{{fullName || userName}}` - Fallback pattern (prefers fullName)

**Default PIN Template**:

```
Subject: Your SAFEQ PIN

Body:
Hello {{fullName || userName}},

Your new SAFEQ PIN is {{pin}}.
Use this code to access printers that require a numeric PIN.

Thanks,
SAFEQ Cloud Administrator
```

### Save and Test

1. Click **Save Changes** to persist the configuration
2. Navigate to the **Users** page
3. Select one or more users
4. Click **Bulk Actions** → **Generate PIN** or **Generate OTP**
5. Select **Send via Email**
6. Monitor the results dialog for success/failure status

## Security Considerations

### Client Secret Protection

- **Storage**: Client secrets are stored in `safeq-settings.json`, encrypted by Tauri's store plugin
- **Access**: Only the Rust backend has access to decrypt and use credentials
- **Network**: Secrets are never sent to any server except Microsoft's token endpoint over TLS
- **Rotation**: Set calendar reminders to rotate secrets before expiration

### Scope Limitation

- The app requests `https://graph.microsoft.com/.default` scope
- With `Mail.Send` permission, this grants access to send mail as any user
- **Mitigation**: Use Exchange application access policies to restrict to specific mailboxes

### Audit and Monitoring

- Enable **Sign-in logs** in Entra ID to monitor application authentication
- Review **Audit logs** for permission changes
- Use **Exchange Online message trace** to track sent emails
- Monitor the app registration's **Sign-ins** blade for unusual activity

### Least Privilege

- The application only requests `Mail.Send` - no read or other mailbox permissions
- Consider using a service account mailbox (e.g., `printer-notify@`) instead of a personal mailbox
- Do not grant Global Admin or higher privileges to the app registration

### Network Security

- All communication with Microsoft uses TLS 1.2+
- The app validates TLS certificates using rustls
- Tokens are transmitted only over HTTPS
- Access tokens are short-lived (60-90 minutes) and not persisted

## Troubleshooting

### Error: "Email delivery is configured for desktop drafts"

**Cause**: Email delivery method is set to "Desktop" instead of "Microsoft Graph"

**Solution**:

1. Go to Settings → Email Delivery
2. Change Delivery Method to "Microsoft Graph (app registration)"
3. Save changes

### Error: "Missing the required setting: graphTenantId"

**Cause**: One or more required fields are empty

**Solution**: Verify all four fields are filled in Settings:

- Tenant ID
- Client ID
- Client Secret
- Sender Address

### Error: "Microsoft Graph token endpoint returned 401"

**Cause**: Invalid client ID, client secret, or tenant ID

**Solution**:

1. Verify Client ID and Tenant ID match your app registration exactly
2. Check if the client secret has expired in Entra ID → Certificates & secrets
3. If expired, generate a new secret and update the settings
4. Ensure no extra spaces or characters when copying values

### Error: "Microsoft Graph token endpoint returned 400: invalid_scope"

**Cause**: Incorrect scope configuration (uncommon with this app)

**Solution**: Verify the app requests `https://graph.microsoft.com/.default` (this is hardcoded)

### Error: "Graph returned 403"

**Cause**: Missing or not-granted API permissions

**Solution**:

1. Go to Entra ID → App registrations → Your app → API permissions
2. Verify `Mail.Send` is listed under Microsoft Graph Application permissions
3. Ensure admin consent is granted (green checkmark)
4. If not granted, click "Grant admin consent"

### Error: "Graph returned 401" when sending email

**Cause**: Token expired or invalid

**Solution**: This is rare as tokens are automatically refreshed. If persistent:

1. Regenerate the client secret
2. Update settings with the new secret
3. Restart the application

### Email Sent But Not Received

**Possible Causes**:

1. **Spam filter**: Check recipient's spam/junk folder
2. **Application access policy**: If configured, verify the sender address matches the policy
3. **Exchange Online Protection**: Check message trace in Exchange admin center

**Test with Exchange Online PowerShell**:

```powershell
Get-MessageTrace -SenderAddress "printer-notify@contoso.com" -StartDate (Get-Date).AddHours(-1) -EndDate (Get-Date)
```

### Error: "Application is not authorized to send mail on behalf of..."

**Cause**: Application access policy is blocking the sender address

**Solution**:

1. Connect to Exchange Online PowerShell
2. Check existing policies:
   ```powershell
   Get-ApplicationAccessPolicy | Where-Object {$_.AppId -eq "YOUR_CLIENT_ID"}
   ```
3. Either update the policy to include the sender or remove it:
   ```powershell
   Remove-ApplicationAccessPolicy -Identity "YOUR_POLICY_ID"
   ```
4. Or add the sender to the allowed scope group

### General Debugging

**Enable detailed error logging**:

1. Check the application console for detailed error messages
2. Errors include the HTTP status code and truncated response body
3. Token request errors show the full OAuth error response

**Verify configuration**:

```powershell
# Test the app registration can get a token
$tenantId = "YOUR_TENANT_ID"
$clientId = "YOUR_CLIENT_ID"
$clientSecret = "YOUR_CLIENT_SECRET"

$body = @{
    client_id     = $clientId
    scope         = "https://graph.microsoft.com/.default"
    client_secret = $clientSecret
    grant_type    = "client_credentials"
}

$tokenResponse = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" -Body $body
$tokenResponse.access_token
```

If this succeeds, your app registration is correctly configured.

## Additional Resources

- [Microsoft Graph Mail API Reference](https://learn.microsoft.com/en-us/graph/api/user-sendmail)
- [OAuth 2.0 Client Credentials Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
- [Application Access Policies in Exchange Online](https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access)
- [Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference)

## Support

For issues specific to SQC-User-Manager:

- Check the application logs in the terminal/console output
- Review the Results Dialog after sending emails for detailed error messages
- Ensure you're running the latest version of the application

For Microsoft 365/Entra ID issues:

- Consult Microsoft 365 admin center
- Review Entra ID sign-in and audit logs
- Contact your Microsoft support representative
