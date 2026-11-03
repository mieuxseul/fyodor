use serde::Serialize;

use crate::error::AppResult;
use crate::providers::http;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const RELEASES_URL: &str =
    "https://api.github.com/repos/rickshank-rickdemption/fyodor/releases/latest";
const RELEASES_PAGE: &str = "https://github.com/rickshank-rickdemption/fyodor/releases";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
    pub release_url: String,
    pub download_url: Option<String>,
    pub notes: Option<String>,
}

fn normalize_version(raw: &str) -> String {
    raw.trim().trim_start_matches('v').trim().to_string()
}

#[tauri::command]
pub async fn check_for_updates() -> AppResult<UpdateCheckResult> {
    let response = http::client()
        .get(RELEASES_URL)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Update check failed: {e}"))?;

    if response.status().as_u16() == 404 {
        return Ok(UpdateCheckResult {
            current_version: CURRENT_VERSION.to_string(),
            latest_version: None,
            update_available: false,
            release_url: RELEASES_PAGE.to_string(),
            download_url: None,
            notes: Some("No GitHub releases published yet.".into()),
        });
    }

    if !response.status().is_success() {
        return Err(format!("GitHub returned HTTP {}", response.status()).into());
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid release JSON: {e}"))?;

    let tag = body
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let latest = normalize_version(tag);
    let current = normalize_version(CURRENT_VERSION);
    let html_url = body
        .get("html_url")
        .and_then(|v| v.as_str())
        .unwrap_or(RELEASES_PAGE)
        .to_string();
    let notes = body
        .get("body")
        .and_then(|v| v.as_str())
        .map(|s| s.chars().take(500).collect::<String>());

    let download_url = body
        .get("assets")
        .and_then(|a| a.as_array())
        .into_iter()
        .flatten()
        .find_map(|asset| {
            let name = asset.get("name")?.as_str()?;
            if name.ends_with(".exe") || name.ends_with(".msi") {
                asset
                    .get("browser_download_url")
                    .and_then(|u| u.as_str())
                    .map(|s| s.to_string())
            } else {
                None
            }
        });

    Ok(UpdateCheckResult {
        current_version: current.clone(),
        latest_version: if latest.is_empty() {
            None
        } else {
            Some(latest.clone())
        },
        update_available: !latest.is_empty() && latest != current,
        release_url: html_url,
        download_url,
        notes,
    })
}
