use std::fmt;

use crate::generator::{
    generate_pin as gen_pin, generate_short_id as gen_short_id, PinSettings, ShortIdSettings,
};
use crate::settings::{load_safeq_settings, SafeQSettings, SettingsLoadError};
use crate::url_utils::UrlUtils;
use reqwest::{Client, StatusCode};
use serde_json::Value;
use tauri::AppHandle;

const USER_AGENT: &str = "SQC-User-Manager/0.1";
const ACCOUNT_PATH: &str = "api/v1/account";
const AUTH_PROVIDERS_PATH: &str = "api/v1/authproviders";
const LIST_ALL_USERS_PATH: &str = "api/v1/users/all";
const UPDATE_USER_PATH: &str = "api/v1/users";
const DEFAULT_API_PORT: u16 = 7300;

/// User detail types for SAFEQ Cloud API
#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub enum UserDetailType {
    FullName = 0,
    Email = 1,
    HomeFolder = 2,
    Password = 3,
    CardId = 4,
    Pin = 5,  // detailtype=5 is PIN in SAFEQ API
    Otp = 10, // detailtype=10 is OTP (One Time Password) in SAFEQ API
    Department = 11,
    Expiration = 12,
    ExternalId = 14,
}

pub struct SafeQClient {
    base_url: String,
    api_key: String,
    http: Client,
}

impl SafeQClient {
    pub fn from_store(app: &AppHandle) -> Result<Self, SafeQApiError> {
        let settings = load_safeq_settings(app)
            .map_err(SafeQApiError::Settings)?
            .ok_or(SafeQApiError::MissingSettings)?;
        Self::from_settings(settings)
    }

    pub fn from_settings(settings: SafeQSettings) -> Result<Self, SafeQApiError> {
        let base_url = UrlUtils::build_base_url(&settings.tenant_url, DEFAULT_API_PORT)
            .map_err(SafeQApiError::InvalidBaseUrl)?;
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .map_err(SafeQApiError::HttpClient)?;

        Ok(Self {
            base_url,
            api_key: settings.api_key.trim().to_owned(),
            http: client,
        })
    }

    pub async fn list_auth_providers(&self) -> Result<Value, SafeQApiError> {
        // Step 1: Get account info to retrieve account ID
        let account_info = self.get_json(ACCOUNT_PATH).await?;
        let account_id = account_info
            .get("id")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| SafeQApiError::MissingField("account.id".to_string()))?;

        // Step 2: Get auth providers using account ID
        let providers_url = format!("{}?accountid={}", AUTH_PROVIDERS_PATH, account_id);
        self.get_json(&providers_url).await
    }

    pub async fn list_users_for_provider(&self, provider_id: i64) -> Result<Value, SafeQApiError> {
        let users_url = format!("{}?providerid={}", LIST_ALL_USERS_PATH, provider_id);
        self.get_json(&users_url).await
    }

    pub async fn list_users(&self) -> Result<Value, SafeQApiError> {
        // Step 1: Get account info to retrieve account ID
        let account_info = self.get_json(ACCOUNT_PATH).await?;
        let account_id = account_info
            .get("id")
            .and_then(|v| v.as_i64())
            .ok_or_else(|| SafeQApiError::MissingField("account.id".to_string()))?;

        // Step 2: Get auth providers using account ID
        let providers_url = format!("{}?accountid={}", AUTH_PROVIDERS_PATH, account_id);
        let providers_info = self.get_json(&providers_url).await?;

        // Step 3: Extract first provider ID from the array
        let provider_id = providers_info
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|provider| provider.get("id"))
            .and_then(|v| v.as_i64())
            .ok_or_else(|| SafeQApiError::MissingField("authprovider.id".to_string()))?;

        // Step 4: Get all users for this provider
        let users_url = format!("{}?providerid={}", LIST_ALL_USERS_PATH, provider_id);
        self.get_json(&users_url).await
    }

    /// Update a user detail in SAFEQ Cloud
    ///
    /// # Arguments
    /// * `username` - Username of the user to update
    /// * `provider_id` - Optional provider ID (if None, uses local provider)
    /// * `detail_type` - Type of detail to update
    /// * `detail_data` - Optional detail data (if None, deletes the detail)
    pub async fn update_user_detail(
        &self,
        username: &str,
        provider_id: Option<i64>,
        detail_type: UserDetailType,
        detail_data: Option<&str>,
    ) -> Result<Value, SafeQApiError> {
        let path = format!("{}/{}", UPDATE_USER_PATH, username);

        let mut form = vec![("detailtype", (detail_type as i32).to_string())];

        if let Some(pid) = provider_id {
            form.push(("providerid", pid.to_string()));
        }

        if let Some(data) = detail_data {
            form.push(("detaildata", data.to_string()));
        }

        self.post_form(&path, &form).await
    }

    /// Generate a new PIN for a user
    pub async fn generate_pin(
        &self,
        username: &str,
        provider_id: Option<i64>,
        settings: &SafeQSettings,
    ) -> Result<Value, SafeQApiError> {
        // Generate a random numeric PIN using settings or defaults
        let gen_settings = PinSettings {
            length: settings.pin_length.unwrap_or(4),
        };
        let pin = gen_pin(&gen_settings);

        // Update the user with the generated PIN (detailtype=5)
        self.update_user_detail(username, provider_id, UserDetailType::Pin, Some(&pin))
            .await
    }

    /// Generate a new OTP (One Time Password) for a user
    pub async fn generate_otp(
        &self,
        username: &str,
        provider_id: Option<i64>,
        settings: &SafeQSettings,
    ) -> Result<Value, SafeQApiError> {
        // Generate a random OTP using settings or defaults
        let gen_settings = ShortIdSettings {
            length: settings.short_id_length.unwrap_or(6),
            use_uppercase: settings.short_id_use_uppercase.unwrap_or(true),
            use_lowercase: settings.short_id_use_lowercase.unwrap_or(true),
            use_numbers: settings.short_id_use_numbers.unwrap_or(true),
            use_special: settings.short_id_use_special.unwrap_or(false),
        };
        let otp = gen_short_id(&gen_settings);

        // Update the user with the generated OTP (detailtype=10)
        self.update_user_detail(username, provider_id, UserDetailType::Otp, Some(&otp))
            .await?;

        // Return the generated OTP so the user can see it
        Ok(serde_json::json!({ "otp": otp }))
    }

    /// Create a new user in SAFEQ Cloud
    ///
    /// Creates a user with all details in a single PUT request per the API
    pub async fn create_user(
        &self,
        username: &str,
        provider_id: Option<i64>,
        full_name: Option<&str>,
        email: Option<&str>,
        card_id: Option<&str>,
        short_id: Option<&str>,
        otp: Option<&str>,
    ) -> Result<Value, SafeQApiError> {
        let path = UPDATE_USER_PATH;

        let mut form: Vec<(&str, String)> = vec![("username", username.to_string())];

        if let Some(pid) = provider_id {
            form.push(("providerid", pid.to_string()));
        }

        // Add full name if provided (detailtype=0)
        if let Some(name) = full_name {
            if !name.is_empty() {
                form.push(("detailtype", (UserDetailType::FullName as i32).to_string()));
                form.push(("detaildata", name.to_string()));
            }
        }

        // Add email if provided (detailtype=1)
        if let Some(email_addr) = email {
            if !email_addr.is_empty() {
                form.push(("detailtype", (UserDetailType::Email as i32).to_string()));
                form.push(("detaildata", email_addr.to_string()));
            }
        }

        // Add card ID if provided (detailtype=4)
        if let Some(card) = card_id {
            if !card.is_empty() {
                form.push(("detailtype", (UserDetailType::CardId as i32).to_string()));
                form.push(("detaildata", card.to_string()));
            }
        }

        // Add short ID/PIN if provided (detailtype=5)
        if let Some(short) = short_id {
            if !short.is_empty() {
                form.push(("detailtype", (UserDetailType::Pin as i32).to_string()));
                form.push(("detaildata", short.to_string()));
            }
        }

        // Add OTP if provided (detailtype=10)
        if let Some(otp_val) = otp {
            if !otp_val.is_empty() {
                form.push(("detailtype", (UserDetailType::Otp as i32).to_string()));
                form.push(("detaildata", otp_val.to_string()));
            }
        }

        self.put_form(&path, &form).await
    }

    async fn put_form(
        &self,
        path: &str,
        form_data: &[(&str, String)],
    ) -> Result<Value, SafeQApiError> {
        let request_url = self.endpoint(path);

        let response = self
            .http
            .put(&request_url)
            .header("X-Api-Key", &self.api_key)
            .form(form_data)
            .send()
            .await
            .map_err(SafeQApiError::Request)?;

        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(SafeQApiError::HttpStatus {
                status,
                url: request_url.clone(),
                body: truncate_body(&body),
            });
        }

        response.json().await.map_err(SafeQApiError::ResponseJson)
    }

    async fn post_form(
        &self,
        path: &str,
        form_data: &[(&str, String)],
    ) -> Result<Value, SafeQApiError> {
        let request_url = self.endpoint(path);

        let response = self
            .http
            .post(&request_url)
            .header("X-Api-Key", &self.api_key)
            .form(form_data)
            .send()
            .await
            .map_err(SafeQApiError::Request)?;

        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(SafeQApiError::HttpStatus {
                status,
                body: truncate_body(&body),
                url: request_url,
            });
        }

        let response_body = response.text().await.map_err(SafeQApiError::Request)?;

        serde_json::from_str(&response_body).map_err(|e| SafeQApiError::JsonParse(e))
    }

    async fn get_json(&self, path: &str) -> Result<Value, SafeQApiError> {
        let request_url = self.endpoint(path);

        let response = self
            .http
            .get(&request_url)
            .header("X-Api-Key", &self.api_key)
            .send()
            .await
            .map_err(SafeQApiError::Request)?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(SafeQApiError::HttpStatus {
                status,
                body: truncate_body(&body),
                url: request_url,
            });
        }

        response.json().await.map_err(SafeQApiError::ResponseJson)
    }

    fn endpoint(&self, path: &str) -> String {
        let trimmed = path.trim_start_matches('/');
        format!("{}/{}", self.base_url, trimmed)
    }
}

/// Generate a PIN value using the given settings
pub fn generate_pin_value(settings: &SafeQSettings) -> String {
    let gen_settings = PinSettings {
        length: settings.pin_length.unwrap_or(4),
    };
    gen_pin(&gen_settings)
}

/// Generate an OTP value using the given settings
pub fn generate_otp_value(settings: &SafeQSettings) -> String {
    let gen_settings = ShortIdSettings {
        length: settings.short_id_length.unwrap_or(6),
        use_uppercase: settings.short_id_use_uppercase.unwrap_or(true),
        use_lowercase: settings.short_id_use_lowercase.unwrap_or(true),
        use_numbers: settings.short_id_use_numbers.unwrap_or(true),
        use_special: settings.short_id_use_special.unwrap_or(false),
    };
    gen_short_id(&gen_settings)
}

#[derive(Debug)]
pub enum SafeQApiError {
    Settings(SettingsLoadError),
    MissingSettings,
    InvalidBaseUrl(url::ParseError),
    HttpClient(reqwest::Error),
    Request(reqwest::Error),
    HttpStatus {
        status: StatusCode,
        body: String,
        url: String,
    },
    ResponseJson(reqwest::Error),
    JsonParse(serde_json::Error),
    MissingField(String),
}

impl fmt::Display for SafeQApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Settings(err) => write!(f, "failed to read SAFEQ settings: {err}"),
            Self::MissingSettings => write!(f, "SAFEQ settings are not configured"),
            Self::InvalidBaseUrl(err) => write!(f, "tenant URL is invalid: {err}"),
            Self::HttpClient(err) => write!(f, "failed to build HTTP client: {err}"),
            Self::Request(err) => write!(f, "SAFEQ request failed: {err}"),
            Self::HttpStatus { status, body, url } => {
                write!(f, "SAFEQ request to {url} failed with {status}")?;
                if !body.is_empty() {
                    write!(f, " (response: {body})")?;
                }
                Ok(())
            }
            Self::ResponseJson(err) => write!(f, "failed to parse SAFEQ response: {err}"),
            Self::JsonParse(err) => write!(f, "failed to parse JSON: {err}"),
            Self::MissingField(field) => write!(f, "required field missing: {field}"),
        }
    }
}

impl std::error::Error for SafeQApiError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Settings(err) => Some(err),
            Self::InvalidBaseUrl(err) => Some(err),
            Self::HttpClient(err) => Some(err),
            Self::Request(err) => Some(err),
            Self::ResponseJson(err) => Some(err),
            Self::JsonParse(err) => Some(err),
            Self::MissingSettings | Self::HttpStatus { .. } | Self::MissingField(_) => None,
        }
    }
}



fn truncate_body(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    const LIMIT: usize = 400;
    if trimmed.len() <= LIMIT {
        return trimmed.to_string();
    }

    let mut collected = String::new();
    for (count, ch) in trimmed.chars().enumerate() {
        if count >= LIMIT {
            collected.push_str("...");
            break;
        }
        collected.push(ch);
    }

    collected
}
