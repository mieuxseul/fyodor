use std::collections::HashMap;

use tauri::State;

use crate::db::models::AppPaths;
use crate::db::repos;
use crate::error::AppResult;
use crate::state::AppState;

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
