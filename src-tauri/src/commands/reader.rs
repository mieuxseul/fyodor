use tauri::State;
use uuid::Uuid;

use crate::db::models::{ChapterPages, ReadingProgress, SaveProgressInput};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[tauri::command]
pub fn get_chapter_pages(
    state: State<'_, AppState>,
    chapter_id: String,
) -> AppResult<ChapterPages> {
    state.with_db(|conn| {
        let chapter = repos::get_chapter(conn, &chapter_id)?
            .ok_or_else(|| AppError::Message("Chapter not found".into()))?;
        let file = repos::get_local_file_for_chapter(conn, &chapter_id)?
            .ok_or_else(|| AppError::Message("No local pages for this chapter".into()))?;

        let missing = file
            .page_paths
            .iter()
            .filter(|p| !std::path::Path::new(p).exists())
            .count();
        if missing > 0 && missing == file.page_paths.len() {
            return Err(AppError::Message(
                "Chapter files are missing. Re-import or relink the local source.".into(),
            ));
        }

        Ok(ChapterPages {
            chapter,
            pages: file.page_paths,
            source_path: Some(file.source_path),
            kind: file.kind,
        })
    })
}

#[tauri::command]
pub fn get_reading_progress(
    state: State<'_, AppState>,
    edition_id: String,
) -> AppResult<Option<ReadingProgress>> {
    state.with_db(|conn| repos::get_progress(conn, &edition_id))
}

#[tauri::command]
pub fn save_reading_progress(
    state: State<'_, AppState>,
    input: SaveProgressInput,
) -> AppResult<ReadingProgress> {
    state.with_db(|conn| {
        let existing = repos::get_progress(conn, &input.edition_id)?;
        let progress = ReadingProgress {
            id: existing
                .map(|p| p.id)
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
            edition_id: input.edition_id.clone(),
            chapter_id: input.chapter_id.clone(),
            page_index: input.page_index,
            scroll_ratio: input.scroll_ratio,
            completed: input.completed,
            updated_at: now(),
        };
        repos::upsert_progress(conn, &progress)?;

        let suppress = input.suppress_activity.unwrap_or(false);
        if !suppress {
            if let Some(edition) = repos::get_edition(conn, &input.edition_id)? {
                repos::touch_library_opened(conn, &edition.title_id, &progress.updated_at)?;
            }
        }

        Ok(progress)
    })
}

#[tauri::command]
pub fn open_edition_for_reading(
    state: State<'_, AppState>,
    edition_id: String,
    incognito: Option<bool>,
) -> AppResult<serde_json::Value> {
    state.with_db(|conn| {
        let edition = repos::get_edition(conn, &edition_id)?
            .ok_or_else(|| AppError::Message("Edition not found".into()))?;
        let title = repos::get_title(conn, &edition.title_id)?
            .ok_or_else(|| AppError::Message("Title not found".into()))?;
        let chapters = repos::list_chapters(conn, &edition_id)?;
        let progress = repos::get_progress(conn, &edition_id)?;

        if !incognito.unwrap_or(false) {
            let opened_at = now();
            repos::touch_library_opened(conn, &title.id, &opened_at)?;
            repos::insert_history(
                conn,
                &Uuid::new_v4().to_string(),
                &title.id,
                &edition_id,
                progress.as_ref().and_then(|p| p.chapter_id.as_deref()),
                &opened_at,
            )?;
        }

        Ok(serde_json::json!({
            "title": title,
            "edition": edition,
            "chapters": chapters,
            "progress": progress,
        }))
    })
}
