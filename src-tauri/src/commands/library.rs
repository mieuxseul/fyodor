use tauri::State;

use crate::db::models::{
    AddRemoteLibraryInput, LibraryItem, RemoteLibraryRef, TitleDetails, UpdateTitleInput,
};
use crate::db::repos;
use crate::error::AppResult;
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
pub fn add_remote_to_library(
    state: State<'_, AppState>,
    input: AddRemoteLibraryInput,
) -> AppResult<RemoteLibraryRef> {
    state.with_db(|conn| repos::add_remote_title_to_library(conn, &input))
}
