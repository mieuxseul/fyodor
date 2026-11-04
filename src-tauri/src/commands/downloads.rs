use std::path::PathBuf;

use tauri::State;
use uuid::Uuid;

use crate::db::models::{
    AddRemoteLibraryInput, Chapter, DownloadRecord, EnqueueDownloadInput, LocalFile,
};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::providers::{atsu, mangadex};
use crate::state::AppState;

fn ext_from_url(url: &str) -> &'static str {
    let lower = url.to_ascii_lowercase();
    if lower.contains(".png") {
        "png"
    } else if lower.contains(".webp") {
        "webp"
    } else if lower.contains(".avif") {
        "avif"
    } else if lower.contains(".gif") {
        "gif"
    } else {
        "jpg"
    }
}

async fn fetch_page_bytes(provider_id: &str, url: &str) -> AppResult<Vec<u8>> {
    match provider_id {
        "atsu" => atsu::fetch_cdn_bytes(url).await,
        "mangadex" => mangadex::fetch_https_image_bytes(url).await,
        _ => Err(AppError::Message(format!(
            "Offline downloads are not supported for provider `{provider_id}` yet."
        ))),
    }
}

async fn resolve_page_urls(
    provider_id: &str,
    provider_title_id: &str,
    remote_chapter_id: &str,
) -> AppResult<Vec<String>> {
    match provider_id {
        "atsu" => Ok(atsu::chapter_pages(provider_title_id, remote_chapter_id)
            .await?
            .pages),
        "mangadex" => Ok(mangadex::chapter_pages(provider_title_id, remote_chapter_id)
            .await?
            .pages),
        _ => Err(AppError::Message(format!(
            "Offline downloads are not supported for provider `{provider_id}` yet."
        ))),
    }
}

#[tauri::command]
pub async fn list_downloads(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> AppResult<Vec<DownloadRecord>> {
    let limit = limit.unwrap_or(100).clamp(1, 500);
    state.with_db(|conn| repos::list_download_records(conn, limit))
}

/// Remove a download job, its offline chapter pages on disk, and related DB rows.
#[tauri::command]
pub async fn delete_download(
    state: State<'_, AppState>,
    download_id: String,
) -> AppResult<()> {
    let download_id = download_id.trim().to_string();
    if download_id.is_empty() {
        return Err(AppError::Message("Missing download id".into()));
    }

    let record = state
        .with_db(|conn| repos::get_download_record(conn, &download_id))?
        .ok_or_else(|| AppError::Message("Download not found".into()))?;

    let mut disk_paths: Vec<PathBuf> = Vec::new();
    disk_paths.push(
        state
            .cache_dir
            .join("chapters")
            .join(format!("dl_{download_id}")),
    );

    let edition_id = record.edition_id.clone();
    let title_id = if let Some(ref edition_id) = edition_id {
        state
            .with_db(|conn| {
                Ok(repos::get_edition(conn, edition_id)?
                    .map(|e| e.title_id))
            })?
    } else {
        None
    };

    state.with_db(|conn| {
        if let Some(chapter_id) = record.chapter_id.as_deref() {
            let paths = repos::delete_local_files_for_chapter(conn, chapter_id)?;
            for path in paths {
                disk_paths.push(PathBuf::from(path));
            }
            repos::delete_chapter(conn, chapter_id)?;
        }
        repos::delete_download_record(conn, &download_id)?;

        if let (Some(edition_id), Some(title_id)) = (edition_id.as_deref(), title_id.as_deref()) {
            let remaining = repos::count_download_local_files(conn, edition_id)?;
            if remaining == 0 {
                repos::set_library_downloaded(conn, title_id, false)?;
            }
        }
        Ok(())
    })?;

    for path in disk_paths {
        if path.is_dir() {
            let _ = std::fs::remove_dir_all(&path);
        } else if path.is_file() {
            let _ = std::fs::remove_file(&path);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn download_remote_chapter(
    state: State<'_, AppState>,
    input: EnqueueDownloadInput,
) -> AppResult<DownloadRecord> {
    let provider_id = input.provider_id.trim().to_string();
    let provider_title_id = input.provider_title_id.trim().to_string();
    let remote_chapter_id = input.remote_chapter_id.trim().to_string();
    if provider_id.is_empty() || provider_title_id.is_empty() || remote_chapter_id.is_empty() {
        return Err(AppError::Message("Missing download identifiers".into()));
    }
    if provider_id != "atsu" && provider_id != "mangadex" {
        return Err(AppError::Message(
            "Offline downloads currently support Atsumaru and MangaDex only.".into(),
        ));
    }

    if let Some(existing) = state.with_db(|conn| {
        repos::find_completed_download(conn, &provider_id, &provider_title_id, &remote_chapter_id)
    })? {
        return Ok(existing);
    }

    let now = chrono::Utc::now().to_rfc3339();
    let job_id = Uuid::new_v4().to_string();
    let mut record = DownloadRecord {
        id: job_id.clone(),
        edition_id: None,
        chapter_id: None,
        provider_id: Some(provider_id.clone()),
        provider_title_id: Some(provider_title_id.clone()),
        remote_chapter_id: Some(remote_chapter_id.clone()),
        title_label: Some(input.primary_title.clone()),
        chapter_title: Some(input.chapter_title.clone()),
        status: "running".into(),
        progress: 0.0,
        error: None,
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    state.with_db(|conn| repos::insert_download_record(conn, &record))?;

    let result = run_download(&state, &input, &mut record).await;
    match result {
        Ok(()) => {
            record.status = "completed".into();
            record.progress = 1.0;
            record.error = None;
            record.updated_at = chrono::Utc::now().to_rfc3339();
            let _ = state.with_db(|conn| repos::update_download_record(conn, &record));
            Ok(record)
        }
        Err(err) => {
            record.status = "failed".into();
            record.error = Some(err.to_string());
            record.updated_at = chrono::Utc::now().to_rfc3339();
            let _ = state.with_db(|conn| repos::update_download_record(conn, &record));
            Err(err)
        }
    }
}

async fn run_download(
    state: &AppState,
    input: &EnqueueDownloadInput,
    record: &mut DownloadRecord,
) -> AppResult<()> {
    let provider_id = input.provider_id.trim();
    let provider_title_id = input.provider_title_id.trim();
    let remote_chapter_id = input.remote_chapter_id.trim();

    let library = state.with_db(|conn| {
        repos::add_remote_title_to_library(
            conn,
            &AddRemoteLibraryInput {
                provider_id: provider_id.to_string(),
                provider_name: input.provider_name.clone(),
                provider_title_id: provider_title_id.to_string(),
                primary_title: input.primary_title.clone(),
                alternate_titles: vec![],
                description: None,
                author: None,
                artist: None,
                genres: vec![],
                tags: vec![],
                content_type: input
                    .content_type
                    .clone()
                    .unwrap_or_else(|| "manga".into()),
                publication_status: None,
                cover_url: input.cover_url.clone(),
                website_url: None,
                reading_direction: None,
                reading_mode: None,
            },
        )
    })?;

    record.edition_id = Some(library.edition_id.clone());
    record.updated_at = chrono::Utc::now().to_rfc3339();
    state.with_db(|conn| repos::update_download_record(conn, record))?;

    let page_urls = resolve_page_urls(provider_id, provider_title_id, remote_chapter_id).await?;
    let dest_dir: PathBuf = state
        .cache_dir
        .join("chapters")
        .join(format!("dl_{}", record.id));
    std::fs::create_dir_all(&dest_dir)?;

    let mut page_paths: Vec<String> = Vec::with_capacity(page_urls.len());
    for (index, url) in page_urls.iter().enumerate() {
        let bytes = fetch_page_bytes(provider_id, url).await?;
        let ext = ext_from_url(url);
        let file_path = dest_dir.join(format!("{:04}.{}", index + 1, ext));
        std::fs::write(&file_path, &bytes)?;
        page_paths.push(file_path.to_string_lossy().to_string());
        record.progress = (index + 1) as f64 / page_urls.len() as f64;
        record.updated_at = chrono::Utc::now().to_rfc3339();
        let _ = state.with_db(|conn| repos::update_download_record(conn, record));
    }

    if page_paths.is_empty() {
        return Err(AppError::Message("Downloaded chapter has no pages".into()));
    }

    let now = chrono::Utc::now().to_rfc3339();
    let chapter_id = Uuid::new_v4().to_string();
    let sort_index =
        state.with_db(|conn| repos::next_chapter_sort_index(conn, &library.edition_id))?;

    let chapter = Chapter {
        id: chapter_id.clone(),
        edition_id: library.edition_id.clone(),
        number: None,
        title: input.chapter_title.clone(),
        sort_index,
        page_count: page_paths.len() as i64,
        created_at: now.clone(),
    };
    let local_file = LocalFile {
        id: Uuid::new_v4().to_string(),
        edition_id: library.edition_id.clone(),
        chapter_id: Some(chapter_id.clone()),
        kind: "download".into(),
        source_path: dest_dir.to_string_lossy().to_string(),
        managed_path: Some(dest_dir.to_string_lossy().to_string()),
        page_paths,
        exists_on_disk: true,
        created_at: now,
    };

    state.with_db(|conn| {
        repos::insert_chapter(conn, &chapter)?;
        repos::insert_local_file(conn, &local_file)?;
        repos::set_library_downloaded(conn, &library.title_id, true)?;
        Ok(())
    })?;

    record.chapter_id = Some(chapter_id);
    Ok(())
}
