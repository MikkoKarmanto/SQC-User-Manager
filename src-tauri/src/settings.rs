use std::fmt;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use url::Url;

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
    pub short_id_length: Option<usize>,
    #[serde(default)]
    pub short_id_use_uppercase: Option<bool>,
    #[serde(default)]
    pub short_id_use_lowercase: Option<bool>,
    #[serde(default)]
    pub short_id_use_numbers: Option<bool>,
    #[serde(default)]
    pub short_id_use_special: Option<bool>,
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
    short_id_length: Option<usize>,
    #[serde(default)]
    short_id_use_uppercase: Option<bool>,
    #[serde(default)]
    short_id_use_lowercase: Option<bool>,
    #[serde(default)]
    short_id_use_numbers: Option<bool>,
    #[serde(default)]
    short_id_use_special: Option<bool>,
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

        let tenant_url = normalize_tenant_url(&stored.tenant_url);
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
            short_id_length: stored.short_id_length,
            short_id_use_uppercase: stored.short_id_use_uppercase,
            short_id_use_lowercase: stored.short_id_use_lowercase,
            short_id_use_numbers: stored.short_id_use_numbers,
            short_id_use_special: stored.short_id_use_special,
        }))
    } else {
        Ok(None)
    }
}

fn normalize_tenant_url(candidate: &str) -> String {
    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    match Url::parse(trimmed) {
        Ok(parsed) => {
            let host = match parsed.host_str() {
                Some(host) if !host.is_empty() => host,
                _ => return trimmed.to_string(),
            };

            let mut authority = host.to_owned();
            if let Some(port) = parsed.port() {
                authority.push(':');
                authority.push_str(&port.to_string());
            }

            let path = match parsed.path() {
                "/" => "",
                other => other,
            };

            let mut normalized = format!("{}://{}{}", parsed.scheme(), authority, path);

            if normalized.ends_with('/') {
                // Mirror the frontend normalization by trimming a single trailing slash.
                normalized.pop();
            }

            normalized
        }
        Err(_) => trimmed.to_string(),
    }
}
