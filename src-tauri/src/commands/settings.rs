use std::collections::HashMap;
use std::path::Path;

use tauri::State;

use crate::db::models::{AppPaths, StorageUsage};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

fn dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    let mut total = 0u64;
    let walker = walkdir::WalkDir::new(path).into_iter().filter_map(|e| e.ok());
    for entry in walker {
        if entry.file_type().is_file() {
            if let Ok(meta) = entry.metadata() {
                total = total.saturating_add(meta.len());
            }
        }
    }
    total
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppResult<HashMap<String, String>> {
    state.with_db(|conn| {
        let pairs = repos::get_all_settings(conn)?;
        Ok(pairs.into_iter().collect())
    })
}

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> AppResult<Option<String>> {
    state.with_db(|conn| repos::get_setting(conn, &key))
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> AppResult<()> {
    state.with_db(|conn| repos::set_setting(conn, &key, &value))
}

#[tauri::command]
pub fn get_app_paths(state: State<'_, AppState>) -> AppResult<AppPaths> {
    Ok(AppPaths {
        data_dir: state.data_dir.to_string_lossy().to_string(),
        database_path: state.db_path.to_string_lossy().to_string(),
        covers_dir: state.covers_dir.to_string_lossy().to_string(),
        cache_dir: state.cache_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn backup_database(state: State<'_, AppState>, destination: String) -> AppResult<String> {
    let dest = std::path::PathBuf::from(&destination);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(&state.db_path, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_database(state: State<'_, AppState>, source: String) -> AppResult<()> {
    let src = std::path::PathBuf::from(&source);
    if !src.is_file() {
        return Err(AppError::Message("Backup file not found".into()));
    }
    let tmp = state.db_path.with_extension("db.restore-tmp");
    std::fs::copy(&src, &tmp)?;
    std::fs::rename(&tmp, &state.db_path)?;
    Ok(())
}

#[tauri::command]
pub fn get_storage_usage(state: State<'_, AppState>) -> AppResult<StorageUsage> {
    let covers = dir_size(&state.covers_dir);
    let chapters = dir_size(&state.cache_dir.join("chapters"));
    let cache_total = dir_size(&state.cache_dir);
    let other = cache_total.saturating_sub(chapters);
    let database_bytes = std::fs::metadata(&state.db_path)
        .map(|m| m.len())
        .unwrap_or(0);
    let available_bytes = fs2_available(&state.data_dir);

    Ok(StorageUsage {
        saved_manga_bytes: covers,
        pages_cache_bytes: chapters,
        other_cache_bytes: other.saturating_add(database_bytes),
        database_bytes,
        available_bytes,
    })
}

#[tauri::command]
pub fn clear_pages_cache(state: State<'_, AppState>) -> AppResult<u64> {
    let chapters = state.cache_dir.join("chapters");
    let before = dir_size(&chapters);
    if chapters.exists() {
        std::fs::remove_dir_all(&chapters)?;
        std::fs::create_dir_all(&chapters)?;
    }
    Ok(before)
}

fn fs2_available(path: &Path) -> Option<u64> {
    // Best-effort free space via std on Windows is awkward; report None if unknown.
    let _ = path;
    None
}
