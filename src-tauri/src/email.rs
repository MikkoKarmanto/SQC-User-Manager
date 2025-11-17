use std::fmt;

use reqwest::{Client, StatusCode};
use serde::Deserialize;
use serde_json::json;
use url::form_urlencoded;

use crate::settings::{EmailDeliveryMethod, EmailSettings};

const GRAPH_SCOPE: &str = "https://graph.microsoft.com/.default";
const GRAPH_BASE_URL: &str = "https://graph.microsoft.com/v1.0";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedEmailPayload {
    pub to: String,
    pub subject: String,
    pub body: String,
    #[serde(default)]
    pub content_type: EmailContentType,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EmailContentType {
    Text,
    Html,
}

impl Default for EmailContentType {
    fn default() -> Self {
        Self::Text
    }
}

impl EmailContentType {
    fn graph_value(&self) -> &'static str {
        match self {
            Self::Text => "Text",
            Self::Html => "HTML",
        }
    }
}

#[derive(Debug, Default)]
pub struct EmailSendSummary {
    pub success: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

#[derive(Debug)]
pub enum EmailDeliveryError {
    MethodNotGraph,
    MissingGraphField(&'static str),
    TokenRequest(reqwest::Error),
    TokenStatus(StatusCode, String),
    TokenParse(serde_json::Error),
    HttpClient(reqwest::Error),
}

impl fmt::Display for EmailDeliveryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MethodNotGraph => write!(f, "Email delivery is configured for desktop drafts. Switch to Microsoft Graph to send directly."),
            Self::MissingGraphField(field) => {
                write!(f, "Email delivery via Microsoft Graph is missing the required setting: {field}")
            }
            Self::TokenRequest(error) => write!(f, "Unable to request Microsoft Graph token: {error}"),
            Self::TokenStatus(status, body) => {
                write!(f, "Microsoft Graph token endpoint returned {}: {}", status.as_u16(), body)
            }
            Self::TokenParse(error) => write!(f, "Unable to parse Microsoft Graph token response: {error}"),
            Self::HttpClient(error) => write!(f, "Unable to build HTTP client for Microsoft Graph: {error}"),
        }
    }
}

impl std::error::Error for EmailDeliveryError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::TokenRequest(error) | Self::HttpClient(error) => Some(error),
            Self::TokenParse(error) => Some(error),
            Self::TokenStatus(_, _) | Self::MethodNotGraph | Self::MissingGraphField(_) => None,
        }
    }
}

pub async fn send_graph_emails(
    settings: &EmailSettings,
    messages: &[PreparedEmailPayload],
) -> Result<EmailSendSummary, EmailDeliveryError> {
    if settings.method != EmailDeliveryMethod::Graph {
        return Err(EmailDeliveryError::MethodNotGraph);
    }

    if messages.is_empty() {
        return Ok(EmailSendSummary::default());
    }

    let tenant_id = settings
        .graph_tenant_id
        .as_deref()
        .ok_or(EmailDeliveryError::MissingGraphField("graphTenantId"))?;
    let client_id = settings
        .graph_client_id
        .as_deref()
        .ok_or(EmailDeliveryError::MissingGraphField("graphClientId"))?;
    let client_secret = settings
        .graph_client_secret
        .as_deref()
        .ok_or(EmailDeliveryError::MissingGraphField("graphClientSecret"))?;
    let sender_address = settings
        .graph_sender_address
        .as_deref()
        .ok_or(EmailDeliveryError::MissingGraphField("graphSenderAddress"))?;

    let http_client = Client::builder()
        .user_agent("SQC-User-Manager/0.1")
        .build()
        .map_err(EmailDeliveryError::HttpClient)?;

    let token = fetch_access_token(&http_client, tenant_id, client_id, client_secret).await?;
    let encoded_sender: String =
        form_urlencoded::byte_serialize(sender_address.as_bytes()).collect();
    let send_url = format!("{GRAPH_BASE_URL}/users/{encoded_sender}/sendMail");

    let mut summary = EmailSendSummary::default();

    for message in messages {
        if message.to.trim().is_empty() {
            summary.failed += 1;
            summary
                .errors
                .push("Recipient address is required for every email".to_string());
            continue;
        }

        let payload = json!({
            "message": {
                "subject": message.subject,
                "body": {
                    "contentType": message.content_type.graph_value(),
                    "content": message.body,
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": message.to
                        }
                    }
                ]
            },
            "saveToSentItems": false
        });

        match http_client
            .post(&send_url)
            .bearer_auth(&token)
            .json(&payload)
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();

                if status.is_success() {
                    summary.success += 1;
                } else {
                    summary.failed += 1;
                    let body = response
                        .text()
                        .await
                        .unwrap_or_else(|_| "(no details)".to_string());
                    summary.errors.push(format!(
                        "{}: Graph returned {} {}",
                        message.to,
                        status.as_u16(),
                        truncate_for_log(&body)
                    ));
                }
            }
            Err(error) => {
                summary.failed += 1;
                summary
                    .errors
                    .push(format!("{}: failed to send email ({error})", message.to));
            }
        }
    }

    Ok(summary)
}

async fn fetch_access_token(
    client: &Client,
    tenant_id: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<String, EmailDeliveryError> {
    let token_url = format!("https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token");
    let params = [
        ("client_id", client_id),
        ("scope", GRAPH_SCOPE),
        ("client_secret", client_secret),
        ("grant_type", "client_credentials"),
    ];

    let response = client
        .post(token_url)
        .form(&params)
        .send()
        .await
        .map_err(EmailDeliveryError::TokenRequest)?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(EmailDeliveryError::TokenRequest)?;

    if !status.is_success() {
        return Err(EmailDeliveryError::TokenStatus(
            status,
            truncate_for_log(&body),
        ));
    }

    #[derive(Deserialize)]
    struct GraphTokenResponse {
        access_token: String,
    }

    let parsed: GraphTokenResponse =
        serde_json::from_str(&body).map_err(EmailDeliveryError::TokenParse)?;
    Ok(parsed.access_token)
}

fn truncate_for_log(input: &str) -> String {
    const MAX_LEN: usize = 180;
    if input.len() <= MAX_LEN {
        input.to_string()
    } else {
        format!("{}…", &input[..MAX_LEN])
    }
}
