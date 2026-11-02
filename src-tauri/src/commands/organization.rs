use tauri::State;
use uuid::Uuid;

use crate::db::models::{Bookmark, CreateBookmarkInput, HistoryItem};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[tauri::command]
pub fn list_history(state: State<'_, AppState>, limit: Option<i64>) -> AppResult<Vec<HistoryItem>> {
    state.with_db(|conn| repos::list_history(conn, limit.unwrap_or(100)))
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>) -> AppResult<()> {
    state.with_db(|conn| repos::clear_history(conn))
}

#[tauri::command]
pub fn list_bookmarks(state: State<'_, AppState>) -> AppResult<Vec<Bookmark>> {
    state.with_db(|conn| repos::list_bookmarks(conn))
}

#[tauri::command]
pub fn create_bookmark(
    state: State<'_, AppState>,
    input: CreateBookmarkInput,
) -> AppResult<Bookmark> {
    state.with_db(|conn| {
        let title = repos::get_title(conn, &input.title_id)?
            .ok_or_else(|| AppError::Message("Title not found".into()))?;
        let edition = input
            .edition_id
            .as_ref()
            .and_then(|id| repos::get_edition(conn, id).ok().flatten());
        let chapter = input
            .chapter_id
            .as_ref()
            .and_then(|id| repos::get_chapter(conn, id).ok().flatten());

        if let Some(existing) = repos::find_matching_bookmark(
            conn,
            &input.title_id,
            input.edition_id.as_deref(),
            input.chapter_id.as_deref(),
            input.page_index,
        )? {
            let bookmarks = repos::list_bookmarks(conn)?;
            if let Some(found) = bookmarks.into_iter().find(|b| b.id == existing) {
                return Ok(found);
            }
        }

        let bookmark = Bookmark {
            id: Uuid::new_v4().to_string(),
            title_id: input.title_id,
            edition_id: input.edition_id,
            chapter_id: input.chapter_id,
            page_index: input.page_index,
            scroll_ratio: input.scroll_ratio,
            note: input.note,
            created_at: now(),
            title,
            edition,
            chapter,
        };
        repos::insert_bookmark(conn, &bookmark)?;
        Ok(bookmark)
    })
}

#[tauri::command]
pub fn delete_bookmark(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_db(|conn| repos::delete_bookmark(conn, &id))
}
