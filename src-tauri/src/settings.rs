use std::fmt;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::url_utils::UrlUtils;

const SETTINGS_FILE: &str = "safeq-settings.json";
const SETTINGS_KEY: &str = "safeqCredentials";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeQSettings {
    pub tenant_url: String,
    pub api_key: String,
    #[serde(default)]
    pub pin_length: Option<usize>,
    #[serde(default)]
    pub otp_length: Option<usize>,
    #[serde(default)]
    pub otp_use_uppercase: Option<bool>,
    #[serde(default)]
    pub otp_use_lowercase: Option<bool>,
    #[serde(default)]
    pub otp_use_numbers: Option<bool>,
    #[serde(default)]
    pub otp_use_special: Option<bool>,
    #[serde(default)]
    pub otp_exclude_characters: Option<String>,
    #[serde(default)]
    pub short_id_length: Option<usize>,
    #[serde(default)]
    pub short_id_use_uppercase: Option<bool>,
    #[serde(default)]
    pub short_id_use_lowercase: Option<bool>,
    #[serde(default)]
    pub short_id_use_numbers: Option<bool>,
    #[serde(default)]
    pub short_id_use_special: Option<bool>,
    #[serde(default)]
    pub email_settings: EmailSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EmailDeliveryMethod {
    Desktop,
    Graph,
}

impl Default for EmailDeliveryMethod {
    fn default() -> Self {
        Self::Desktop
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailTemplateSettings {
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub body: String,
}

impl EmailTemplateSettings {
    pub fn default_pin_template() -> Self {
        Self {
            subject: "Your SAFEQ PIN".to_string(),
            body: "Hello {{fullName || userName}},\n\nYour new SAFEQ PIN is {{pin}}.\nUse this code to access printers that require a numeric PIN.\n\nThanks,\nSAFEQ Cloud Administrator".to_string(),
        }
    }

    pub fn default_otp_template() -> Self {
        Self {
            subject: "Your SAFEQ OTP".to_string(),
            body: "Hello {{fullName || userName}},\n\nYour one-time password is {{otp}}.\nEnter this code when the portal or device asks for an OTP.\n\nThanks,\nSAFEQ Cloud Administrator".to_string(),
        }
    }
}

impl Default for EmailTemplateSettings {
    fn default() -> Self {
        Self {
            subject: String::new(),
            body: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSettings {
    #[serde(default)]
    pub method: EmailDeliveryMethod,
    #[serde(default)]
    pub graph_tenant_id: Option<String>,
    #[serde(default)]
    pub graph_client_id: Option<String>,
    #[serde(default)]
    pub graph_client_secret: Option<String>,
    #[serde(default)]
    pub graph_sender_address: Option<String>,
    #[serde(default = "EmailTemplateSettings::default_pin_template")]
    pub pin_template: EmailTemplateSettings,
    #[serde(default = "EmailTemplateSettings::default_otp_template")]
    pub otp_template: EmailTemplateSettings,
}

impl Default for EmailSettings {
    fn default() -> Self {
        Self {
            method: EmailDeliveryMethod::Desktop,
            graph_tenant_id: None,
            graph_client_id: None,
            graph_client_secret: None,
            graph_sender_address: None,
            pin_template: EmailTemplateSettings::default_pin_template(),
            otp_template: EmailTemplateSettings::default_otp_template(),
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredSafeQSettings {
    #[serde(default)]
    tenant_url: String,
    #[serde(default)]
    api_key: String,
    #[serde(default)]
    pin_length: Option<usize>,
    #[serde(default)]
    otp_length: Option<usize>,
    #[serde(default)]
    otp_use_uppercase: Option<bool>,
    #[serde(default)]
    otp_use_lowercase: Option<bool>,
    #[serde(default)]
    otp_use_numbers: Option<bool>,
    #[serde(default)]
    otp_use_special: Option<bool>,
    #[serde(default)]
    otp_exclude_characters: Option<String>,
    #[serde(default)]
    short_id_length: Option<usize>,
    #[serde(default)]
    short_id_use_uppercase: Option<bool>,
    #[serde(default)]
    short_id_use_lowercase: Option<bool>,
    #[serde(default)]
    short_id_use_numbers: Option<bool>,
    #[serde(default)]
    short_id_use_special: Option<bool>,
    #[serde(default)]
    email_settings: EmailSettings,
}

#[derive(Debug)]
pub enum SettingsLoadError {
    Store(tauri_plugin_store::Error),
    Deserialize(serde_json::Error),
    MissingTenantUrl,
    MissingApiKey,
}

impl fmt::Display for SettingsLoadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Store(error) => write!(f, "failed to access SAFEQ settings store: {error}"),
            Self::Deserialize(error) => write!(f, "failed to parse SAFEQ settings: {error}"),
            Self::MissingTenantUrl => write!(f, "tenant URL is not configured"),
            Self::MissingApiKey => write!(f, "API key is not configured"),
        }
    }
}

impl std::error::Error for SettingsLoadError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Store(error) => Some(error),
            Self::Deserialize(error) => Some(error),
            Self::MissingTenantUrl | Self::MissingApiKey => None,
        }
    }
}

pub fn load_safeq_settings(app: &AppHandle) -> Result<Option<SafeQSettings>, SettingsLoadError> {
    let store = app.store(SETTINGS_FILE).map_err(SettingsLoadError::Store)?;

    if let Some(raw_value) = store.get(SETTINGS_KEY) {
        let stored: StoredSafeQSettings =
            serde_json::from_str(&raw_value.to_string()).map_err(SettingsLoadError::Deserialize)?;

        let tenant_url = UrlUtils::normalize_tenant_url(&stored.tenant_url);
        let api_key = stored.api_key.trim().to_owned();

        if tenant_url.is_empty() && api_key.is_empty() {
            return Ok(None);
        }

        if tenant_url.is_empty() {
            return Err(SettingsLoadError::MissingTenantUrl);
        }

        if api_key.is_empty() {
            return Err(SettingsLoadError::MissingApiKey);
        }

        Ok(Some(SafeQSettings {
            tenant_url,
            api_key,
            pin_length: stored.pin_length,
            otp_length: stored.otp_length,
            otp_use_uppercase: stored.otp_use_uppercase,
            otp_use_lowercase: stored.otp_use_lowercase,
            otp_use_numbers: stored.otp_use_numbers,
            otp_use_special: stored.otp_use_special,
            otp_exclude_characters: stored.otp_exclude_characters,
            short_id_length: stored.short_id_length,
            short_id_use_uppercase: stored.short_id_use_uppercase,
            short_id_use_lowercase: stored.short_id_use_lowercase,
            short_id_use_numbers: stored.short_id_use_numbers,
            short_id_use_special: stored.short_id_use_special,
            email_settings: stored.email_settings,
        }))
    } else {
        Ok(None)
    }
}
