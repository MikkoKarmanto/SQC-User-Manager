mod email;
mod generator;
mod safeq_api;
mod settings;
mod url_utils;

use tauri::Manager;

#[tauri::command]
fn get_safeq_settings(app: tauri::AppHandle) -> Result<Option<settings::SafeQSettings>, String> {
    settings::load_safeq_settings(&app).map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_safeq_users(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let client = safeq_api::SafeQClient::from_store(&app).map_err(|error| error.to_string())?;

    client.list_users().await.map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_auth_providers(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let client = safeq_api::SafeQClient::from_store(&app).map_err(|error| error.to_string())?;

    client
        .list_auth_providers()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_users_for_provider(
    app: tauri::AppHandle,
    provider_id: i64,
) -> Result<serde_json::Value, String> {
    let client = safeq_api::SafeQClient::from_store(&app).map_err(|error| error.to_string())?;

    client
        .list_users_for_provider(provider_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_user_card(
    app: tauri::AppHandle,
    username: String,
    provider_id: Option<i64>,
    card_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = safeq_api::SafeQClient::from_store(&app).map_err(|error| error.to_string())?;

    client
        .update_user_detail(
            &username,
            provider_id,
            safeq_api::UserDetailType::CardId,
            card_id.as_deref(),
        )
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_user_short_id(
    app: tauri::AppHandle,
    username: String,
    provider_id: Option<i64>,
    short_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = safeq_api::SafeQClient::from_store(&app).map_err(|error| error.to_string())?;

    client
        .update_user_detail(
            &username,
            provider_id,
            safeq_api::UserDetailType::Otp, // Short ID uses detailtype=6 (OTP)
            short_id.as_deref(),
        )
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn update_user_pin(
    app: tauri::AppHandle,
    username: String,
    provider_id: Option<i64>,
    pin: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = safeq_api::SafeQClient::from_store(&app).map_err(|error| error.to_string())?;

    client
        .update_user_detail(
            &username,
            provider_id,
            safeq_api::UserDetailType::Pin, // PIN uses detailtype=5
            pin.as_deref(),
        )
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn generate_user_pin(
    app: tauri::AppHandle,
    username: String,
    provider_id: Option<i64>,
) -> Result<serde_json::Value, String> {
    let settings = settings::load_safeq_settings(&app)
        .map_err(|error| error.to_string())?
        .ok_or("Settings not configured")?;

    let client = safeq_api::SafeQClient::from_settings(settings.clone())
        .map_err(|error| error.to_string())?;

    client
        .generate_pin(&username, provider_id, &settings)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn generate_user_otp(
    app: tauri::AppHandle,
    username: String,
    provider_id: Option<i64>,
) -> Result<serde_json::Value, String> {
    let settings = settings::load_safeq_settings(&app)
        .map_err(|error| error.to_string())?
        .ok_or("Settings not configured")?;

    let client = safeq_api::SafeQClient::from_settings(settings.clone())
        .map_err(|error| error.to_string())?;

    client
        .generate_otp(&username, provider_id, &settings)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn generate_bulk_pins(
    app: tauri::AppHandle,
    users: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let settings = settings::load_safeq_settings(&app)
        .map_err(|error| error.to_string())?
        .ok_or("Settings not configured")?;

    let client = safeq_api::SafeQClient::from_settings(settings.clone())
        .map_err(|error| error.to_string())?;

    let mut success_count = 0;
    let mut failed_count = 0;
    let mut results: Vec<serde_json::Value> = Vec::new();

    for user in users {
        let username = user["userName"].as_str().unwrap_or("");
        let provider_id = user["providerId"].as_i64();

        match client.generate_pin(username, provider_id, &settings).await {
            Ok(result) => {
                success_count += 1;
                results.push(serde_json::json!({
                    "user": user,
                    "success": true,
                    "value": result["pin"]
                }));
            }
            Err(e) => {
                failed_count += 1;
                results.push(serde_json::json!({
                    "user": user,
                    "success": false,
                    "error": e.to_string()
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "success": success_count,
        "failed": failed_count,
        "results": results
    }))
}

#[tauri::command]
async fn generate_bulk_otps(
    app: tauri::AppHandle,
    users: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let settings = settings::load_safeq_settings(&app)
        .map_err(|error| error.to_string())?
        .ok_or("Settings not configured")?;

    let client = safeq_api::SafeQClient::from_settings(settings.clone())
        .map_err(|error| error.to_string())?;

    let mut success_count = 0;
    let mut failed_count = 0;
    let mut results: Vec<serde_json::Value> = Vec::new();

    for user in users {
        let username = user["userName"].as_str().unwrap_or("");
        let provider_id = user["providerId"].as_i64();

        match client.generate_otp(username, provider_id, &settings).await {
            Ok(result) => {
                success_count += 1;
                results.push(serde_json::json!({
                    "user": user,
                    "success": true,
                    "value": result["otp"]
                }));
            }
            Err(e) => {
                failed_count += 1;
                results.push(serde_json::json!({
                    "user": user,
                    "success": false,
                    "error": e.to_string()
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "success": success_count,
        "failed": failed_count,
        "results": results
    }))
}

#[tauri::command]
async fn create_users(
    app: tauri::AppHandle,
    users: Vec<serde_json::Value>,
    auto_generate_pin: bool,
    auto_generate_otp: bool,
) -> Result<serde_json::Value, String> {
    let settings = settings::load_safeq_settings(&app)
        .map_err(|error| error.to_string())?
        .ok_or("Settings not configured")?;

    let client = safeq_api::SafeQClient::from_settings(settings.clone())
        .map_err(|error| error.to_string())?;

    let mut success_count = 0;
    let mut failed_count = 0;
    let mut results: Vec<serde_json::Value> = Vec::new();

    for user in users {
        let username = user["userName"].as_str().unwrap_or("");
        let provider_id = user["providerId"].as_i64();
        let full_name = user["fullName"].as_str();
        let email = user["email"].as_str();
        let card_id = user["cardId"].as_str();
        let mut short_id = user["shortId"].as_str().map(|s| s.to_string());
        let mut otp = user["otp"].as_str().map(|s| s.to_string());

        // Auto-generate PIN if requested and empty
        if auto_generate_pin && short_id.as_ref().map_or(true, |s| s.is_empty()) {
            short_id = Some(safeq_api::generate_pin_value(&settings));
        }

        // Auto-generate OTP if requested and empty
        if auto_generate_otp && otp.as_ref().map_or(true, |s| s.is_empty()) {
            otp = Some(safeq_api::generate_otp_value(&settings));
        }

        match client
            .create_user(
                username,
                provider_id,
                full_name,
                email,
                card_id,
                short_id.as_deref(),
                otp.as_deref(),
            )
            .await
        {
            Ok(_) => {
                success_count += 1;
                let mut result_json = serde_json::json!({
                    "user": {
                        "userName": username,
                        "fullName": full_name,
                        "email": email,
                        "providerId": provider_id,
                    },
                    "success": true,
                });
                // Include generated credentials in the result
                if let Some(pin_value) = &short_id {
                    result_json["pin"] = serde_json::json!(pin_value);
                }
                if let Some(otp_value) = &otp {
                    result_json["otp"] = serde_json::json!(otp_value);
                }
                results.push(result_json);
            }
            Err(err) => {
                failed_count += 1;
                results.push(serde_json::json!({
                    "user": {
                        "userName": username,
                        "fullName": full_name,
                        "email": email,
                        "providerId": provider_id,
                    },
                    "success": false,
                    "error": err.to_string(),
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "success": success_count,
        "failed": failed_count,
        "results": results,
    }))
}

#[tauri::command]
async fn send_graph_emails(
    app: tauri::AppHandle,
    messages: Vec<email::PreparedEmailPayload>,
) -> Result<serde_json::Value, String> {
    let settings = settings::load_safeq_settings(&app)
        .map_err(|error| error.to_string())?
        .ok_or("Settings not configured")?;

    let summary = email::send_graph_emails(&settings.email_settings, &messages)
        .await
        .map_err(|error| error.to_string())?;

    Ok(serde_json::json!({
        "success": summary.success,
        "failed": summary.failed,
        "errors": summary.errors,
    }))
}

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = if let Some(main_window) = app.get_webview_window("main") {
        println!("Main window already exists, showing it");
        // Main window already exists, just show it
        main_window.show().map_err(|e| e.to_string())?;
        main_window
    } else {
        // Create the main window
        let main_url = if cfg!(dev) {
            "http://localhost:1420/"
        } else {
            "index.html"
        };

        let window = tauri::WebviewWindowBuilder::new(
            &app,
            "main",
            tauri::WebviewUrl::External(main_url.parse().unwrap()),
        )
        .title("SAFEQ Cloud User Manager")
        .inner_size(1200.0, 800.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

        window.show().map_err(|e| e.to_string())?;
        window
    };

    // Focus the main window
    main_window.set_focus().map_err(|e| e.to_string())?;

    // Close the splashscreen window AFTER main window is shown
    if let Some(splashscreen) = app.get_webview_window("splashscreen") {
        splashscreen.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Create the splash screen window first
            let splash_url = if cfg!(dev) {
                "http://localhost:1420/splash.html"
            } else {
                "splash.html"
            };

            tauri::WebviewWindowBuilder::new(
                app,
                "splashscreen",
                tauri::WebviewUrl::External(splash_url.parse().unwrap()),
            )
            .title("SAFEQ Cloud User Manager")
            .inner_size(600.0, 400.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .center()
            .build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_safeq_settings,
            list_safeq_users,
            list_auth_providers,
            list_users_for_provider,
            update_user_card,
            update_user_short_id,
            update_user_pin,
            generate_user_pin,
            generate_user_otp,
            generate_bulk_pins,
            generate_bulk_otps,
            create_users,
            send_graph_emails,
            close_splashscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
