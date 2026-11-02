use std::fs;
use std::path::{Path, PathBuf};

use tauri::State;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use crate::archive::{self, title_from_path};
use crate::db::models::{
    Chapter, Edition, ImportResult, LibraryEntry, LocalFile, Title,
};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn copy_cover(covers_dir: &Path, title_id: &str, first_page: &Path) -> AppResult<String> {
    fs::create_dir_all(covers_dir)?;
    let ext = first_page
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");
    let dest = covers_dir.join(format!("{title_id}.{ext}"));
    fs::copy(first_page, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

fn import_pages_as_title(
    state: &AppState,
    source_path: &Path,
    title_name: &str,
    pages: Vec<String>,
    kind: &str,
    warnings: Vec<String>,
) -> AppResult<ImportResult> {
    if pages.is_empty() {
        return Err(AppError::Message("No pages to import".into()));
    }

    let timestamp = now();
    let title_id = Uuid::new_v4().to_string();
    let edition_id = Uuid::new_v4().to_string();
    let chapter_id = Uuid::new_v4().to_string();
    let entry_id = Uuid::new_v4().to_string();
    let file_id = Uuid::new_v4().to_string();

    let first = PathBuf::from(&pages[0]);
    let cover_path = copy_cover(&state.covers_dir, &title_id, &first).ok();

    let title = Title {
        id: title_id.clone(),
        primary_title: title_name.to_string(),
        alternate_titles: vec![],
        description: None,
        author: None,
        artist: None,
        genres: vec![],
        tags: vec![],
        content_type: "manga".into(),
        original_language: None,
        publication_status: None,
        cover_path,
        created_at: timestamp.clone(),
        updated_at: timestamp.clone(),
    };

    let edition = Edition {
        id: edition_id.clone(),
        title_id: title_id.clone(),
        label: "Local".into(),
        language: None,
        reading_direction: "ltr".into(),
        reading_mode: "page".into(),
        source_kind: "local".into(),
        provider_id: None,
        provider_title_id: None,
        created_at: timestamp.clone(),
        updated_at: timestamp.clone(),
    };

    let chapter = Chapter {
        id: chapter_id.clone(),
        edition_id: edition_id.clone(),
        number: Some(1.0),
        title: "Chapter 1".into(),
        sort_index: 0,
        page_count: pages.len() as i64,
        created_at: timestamp.clone(),
    };

    let local_file = LocalFile {
        id: file_id,
        edition_id: edition_id.clone(),
        chapter_id: Some(chapter_id),
        kind: kind.into(),
        source_path: source_path.to_string_lossy().to_string(),
        managed_path: Path::new(&pages[0])
            .parent()
            .map(|p| p.to_string_lossy().to_string()),
        page_paths: pages.clone(),
        exists_on_disk: true,
        created_at: timestamp.clone(),
    };

    let entry = LibraryEntry {
        id: entry_id,
        title_id: title_id.clone(),
        status: "planned".into(),
        preferred_edition_id: Some(edition_id.clone()),
        added_at: timestamp,
        last_opened_at: None,
        is_local: true,
        is_downloaded: false,
    };

    state.with_db(|conn| {
        let tx = conn.transaction()?;
        repos::insert_title(&tx, &title)?;
        repos::insert_edition(&tx, &edition)?;
        repos::insert_chapter(&tx, &chapter)?;
        repos::insert_local_file(&tx, &local_file)?;
        repos::insert_library_entry(&tx, &entry)?;
        tx.commit()?;
        Ok(())
    })?;

    Ok(ImportResult {
        title_id,
        edition_id,
        primary_title: title_name.to_string(),
        chapter_count: 1,
        page_count: pages.len() as i64,
        warnings,
    })
}

fn import_archive_path(state: &AppState, path: &Path) -> AppResult<ImportResult> {
    let title_name = title_from_path(path);
    let chapter_dir = state
        .cache_dir
        .join("chapters")
        .join(Uuid::new_v4().to_string());
    let (pages, warnings) = archive::extract_archive_images(path, &chapter_dir)?;
    import_pages_as_title(state, path, &title_name, pages, "archive", warnings)
}

fn import_folder_path(state: &AppState, path: &Path) -> AppResult<ImportResult> {
    let title_name = title_from_path(path);
    let chapter_dir = state
        .cache_dir
        .join("chapters")
        .join(Uuid::new_v4().to_string());
    let pages = archive::copy_folder_images(path, &chapter_dir)?;
    import_pages_as_title(state, path, &title_name, pages, "folder", vec![])
}

#[tauri::command]
pub async fn pick_and_import_archives(app: tauri::AppHandle, state: State<'_, AppState>) -> AppResult<Vec<ImportResult>> {
    let files = app
        .dialog()
        .file()
        .add_filter("Comic archives", &["cbz", "zip"])
        .set_title("Import CBZ / ZIP")
        .blocking_pick_files();

    let Some(files) = files else {
        return Ok(vec![]);
    };

    let mut results = Vec::new();
    let mut warnings_all = Vec::new();

    for file in files {
        let path = file
            .into_path()
            .map_err(|e| AppError::Message(e.to_string()))?;
        match import_archive_path(&state, &path) {
            Ok(result) => results.push(result),
            Err(err) => warnings_all.push(format!("{}: {err}", path.display())),
        }
    }

    if results.is_empty() && !warnings_all.is_empty() {
        return Err(AppError::Message(warnings_all.join("\n")));
    }

    if let Some(first) = results.first_mut() {
        first.warnings.extend(warnings_all);
    }

    Ok(results)
}

#[tauri::command]
pub async fn pick_and_import_folder(app: tauri::AppHandle, state: State<'_, AppState>) -> AppResult<ImportResult> {
    let folder = app
        .dialog()
        .file()
        .set_title("Import image folder")
        .blocking_pick_folder();

    let Some(folder) = folder else {
        return Err(AppError::Message("Import cancelled".into()));
    };

    let path = folder
        .into_path()
        .map_err(|e| AppError::Message(e.to_string()))?;
    import_folder_path(&state, &path)
}

#[tauri::command]
pub fn import_path(state: State<'_, AppState>, path: String) -> AppResult<ImportResult> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err(AppError::Message("Path does not exist".into()));
    }
    if path.is_dir() {
        return import_folder_path(&state, &path);
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(ext.as_str(), "cbz" | "zip") {
        import_archive_path(&state, &path)
    } else {
        Err(AppError::Message(
            "Unsupported file type. Use CBZ, ZIP, or an image folder.".into(),
        ))
    }
}

fn extract_pages_from_path(state: &AppState, path: &Path) -> AppResult<(Vec<String>, String, Vec<String>)> {
    let chapter_dir = state
        .cache_dir
        .join("chapters")
        .join(Uuid::new_v4().to_string());
    if path.is_dir() {
        let pages = archive::copy_folder_images(path, &chapter_dir)?;
        return Ok((pages, "folder".into(), vec![]));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(ext.as_str(), "cbz" | "zip") {
        let (pages, warnings) = archive::extract_archive_images(path, &chapter_dir)?;
        Ok((pages, "archive".into(), warnings))
    } else {
        Err(AppError::Message(
            "Unsupported file type. Use CBZ, ZIP, or an image folder.".into(),
        ))
    }
}

#[tauri::command]
pub async fn relink_local_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    local_file_id: String,
) -> AppResult<LocalFile> {
    let existing = state.with_db(|conn| {
        repos::get_local_file(conn, &local_file_id)?
            .ok_or_else(|| AppError::Message("Local file record not found".into()))
    })?;

    let picked = app
        .dialog()
        .file()
        .add_filter("Comic archives", &["cbz", "zip"])
        .set_title("Relink missing local file")
        .blocking_pick_file();

    let path = if let Some(file) = picked {
        file.into_path()
            .map_err(|e| AppError::Message(e.to_string()))?
    } else {
        let folder = app
            .dialog()
            .file()
            .set_title("Or choose an image folder to relink")
            .blocking_pick_folder();
        let Some(folder) = folder else {
            return Err(AppError::Message("Relink cancelled".into()));
        };
        folder
            .into_path()
            .map_err(|e| AppError::Message(e.to_string()))?
    };

    let (pages, kind, _warnings) = extract_pages_from_path(&state, &path)?;
    let managed = Path::new(&pages[0])
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    state.with_db(|conn| {
        repos::update_local_file_pages(
            conn,
            &local_file_id,
            &path.to_string_lossy(),
            managed.as_deref(),
            &pages,
            &kind,
        )?;
        let mut file = repos::get_local_file(conn, &local_file_id)?
            .ok_or_else(|| AppError::Message("Local file record missing after relink".into()))?;
        repos::refresh_local_file_existence(conn, &mut file)?;

        if let Some(edition) = repos::get_edition(conn, &existing.edition_id)? {
            if let Some(first) = pages.first() {
                if let Ok(cover) = copy_cover(&state.covers_dir, &edition.title_id, Path::new(first))
                {
                    conn.execute(
                        "UPDATE titles SET cover_path = ?2, updated_at = ?3 WHERE id = ?1",
                        rusqlite::params![edition.title_id, cover, now()],
                    )?;
                }
            }
        }
        Ok(file)
    })
}
