use std::fs;
use std::path::{Path, PathBuf};

use tauri::State;

use crate::db::models::{
    AddRemoteLibraryInput, LibraryItem, RemoteLibraryRef, TitleDetails, UpdateTitleInput,
};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::providers::{atsu, mangadex};
use crate::state::AppState;

#[tauri::command]
pub fn list_library(
    state: State<'_, AppState>,
    status: Option<String>,
    query: Option<String>,
    sort: Option<String>,
    local_only: Option<bool>,
) -> AppResult<Vec<LibraryItem>> {
    state.with_db(|conn| {
        repos::list_library(
            conn,
            status.as_deref(),
            query.as_deref(),
            sort.as_deref().unwrap_or("recent"),
            local_only.unwrap_or(false),
        )
    })
}

#[tauri::command]
pub fn get_title_details(state: State<'_, AppState>, title_id: String) -> AppResult<TitleDetails> {
    state.with_db(|conn| repos::title_details(conn, &title_id))
}

#[tauri::command]
pub fn update_title(state: State<'_, AppState>, input: UpdateTitleInput) -> AppResult<()> {
    state.with_db(|conn| repos::update_title_fields(conn, &input))
}

#[tauri::command]
pub fn remove_from_library(state: State<'_, AppState>, title_id: String) -> AppResult<()> {
    state.with_db(|conn| repos::remove_library_title(conn, &title_id))
}

#[tauri::command]
pub fn search_library(state: State<'_, AppState>, query: String) -> AppResult<Vec<LibraryItem>> {
    state.with_db(|conn| repos::search_library(conn, &query))
}

#[tauri::command]
pub fn get_remote_library_ref(
    state: State<'_, AppState>,
    provider_id: String,
    provider_title_id: String,
) -> AppResult<RemoteLibraryRef> {
    state.with_db(|conn| repos::get_remote_library_ref(conn, &provider_id, &provider_title_id))
}

#[tauri::command]
pub async fn add_remote_to_library(
    state: State<'_, AppState>,
    input: AddRemoteLibraryInput,
) -> AppResult<RemoteLibraryRef> {
    let cover_url = input.cover_url.clone();
    let result = state.with_db(|conn| repos::add_remote_title_to_library(conn, &input))?;
    if let Some(url) = cover_url.as_deref().filter(|u| needs_remote_cover_cache(u)) {
        if let Ok(path) = cache_remote_cover(&state.covers_dir, &result.title_id, url).await {
            let _ = state.with_db(|conn| repos::set_title_cover_path(conn, &result.title_id, &path));
        }
    }
    Ok(result)
}

/// Download a remote cover into the local covers dir and update `titles.cover_path`.
#[tauri::command]
pub async fn sync_title_cover(
    state: State<'_, AppState>,
    title_id: String,
) -> AppResult<Option<String>> {
    let (current_cover, editions) = state.with_db(|conn| {
        let title = repos::get_title(conn, &title_id)?
            .ok_or_else(|| AppError::Message("Title not found".into()))?;
        let editions = repos::list_editions_for_title(conn, &title_id)?;
        Ok((title.cover_path, editions))
    })?;

    if let Some(path) = current_cover.as_deref() {
        if !needs_remote_cover_cache(path) && Path::new(path).is_file() {
            return Ok(Some(path.to_string()));
        }
    }

    let mut cover_url = current_cover
        .as_deref()
        .filter(|u| needs_remote_cover_cache(u))
        .map(|u| u.to_string());

    if cover_url.is_none() {
        for edition in &editions {
            let Some(provider) = edition.provider_id.as_deref() else {
                continue;
            };
            let Some(provider_title_id) = edition.provider_title_id.as_deref() else {
                continue;
            };
            cover_url = match provider {
                "atsu" => atsu::title_details(provider_title_id)
                    .await
                    .ok()
                    .and_then(|d| d.cover_url),
                "mangadex" => mangadex::title_details(provider_title_id)
                    .await
                    .ok()
                    .and_then(|d| d.cover_url),
                _ => None,
            };
            if cover_url.is_some() {
                break;
            }
        }
    }

    let Some(url) = cover_url else {
        return Ok(None);
    };

    let path = cache_remote_cover(&state.covers_dir, &title_id, &url).await?;
    state.with_db(|conn| repos::set_title_cover_path(conn, &title_id, &path))?;
    Ok(Some(path))
}

fn needs_remote_cover_cache(path: &str) -> bool {
    path.starts_with("https://cdn.atsu.moe/")
        || path.starts_with("http://cdn.atsu.moe/")
        || path.starts_with("https://uploads.mangadex.org/")
        || path.starts_with("http://uploads.mangadex.org/")
}

async fn cache_remote_cover(covers_dir: &Path, title_id: &str, cover_url: &str) -> AppResult<String> {
    let bytes = if cover_url.contains("cdn.atsu.moe") {
        atsu::fetch_cdn_bytes(cover_url).await?
    } else if cover_url.contains("uploads.mangadex.org") {
        mangadex::fetch_cover_bytes(cover_url).await?
    } else {
        return Err(AppError::Message(
            "Cover sync only supports Atsumaru and MangaDex CDN URLs".into(),
        ));
    };

    fs::create_dir_all(covers_dir)?;
    let ext = extension_from_url(cover_url, &bytes);
    let dest: PathBuf = covers_dir.join(format!("{title_id}.{ext}"));
    fs::write(&dest, &bytes)?;
    Ok(dest.to_string_lossy().to_string())
}

fn extension_from_url(url: &str, bytes: &[u8]) -> &'static str {
    let lower = url.to_ascii_lowercase();
    if lower.contains(".png") || bytes_start_png(bytes) {
        "png"
    } else if lower.contains(".webp") || bytes_start_webp(bytes) {
        "webp"
    } else if lower.contains(".gif") {
        "gif"
    } else {
        "jpg"
    }
}

fn bytes_start_png(bytes: &[u8]) -> bool {
    bytes.len() >= 8 && &bytes[..8] == b"\x89PNG\r\n\x1a\n"
}

fn bytes_start_webp(bytes: &[u8]) -> bool {
    bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP"
}
