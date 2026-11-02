use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

use super::models::*;

fn parse_json_vec(raw: String) -> Vec<String> {
    serde_json::from_str(&raw).unwrap_or_default()
}

fn map_title(row: &rusqlite::Row<'_>) -> rusqlite::Result<Title> {
    Ok(Title {
        id: row.get(0)?,
        primary_title: row.get(1)?,
        alternate_titles: parse_json_vec(row.get::<_, String>(2)?),
        description: row.get(3)?,
        author: row.get(4)?,
        artist: row.get(5)?,
        genres: parse_json_vec(row.get::<_, String>(6)?),
        tags: parse_json_vec(row.get::<_, String>(7)?),
        content_type: row.get(8)?,
        original_language: row.get(9)?,
        publication_status: row.get(10)?,
        cover_path: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

fn map_edition(row: &rusqlite::Row<'_>) -> rusqlite::Result<Edition> {
    Ok(Edition {
        id: row.get(0)?,
        title_id: row.get(1)?,
        label: row.get(2)?,
        language: row.get(3)?,
        reading_direction: row.get(4)?,
        reading_mode: row.get(5)?,
        source_kind: row.get(6)?,
        provider_id: row.get(7)?,
        provider_title_id: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn map_chapter(row: &rusqlite::Row<'_>) -> rusqlite::Result<Chapter> {
    Ok(Chapter {
        id: row.get(0)?,
        edition_id: row.get(1)?,
        number: row.get(2)?,
        title: row.get(3)?,
        sort_index: row.get(4)?,
        page_count: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn map_local_file(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalFile> {
    Ok(LocalFile {
        id: row.get(0)?,
        edition_id: row.get(1)?,
        chapter_id: row.get(2)?,
        kind: row.get(3)?,
        source_path: row.get(4)?,
        managed_path: row.get(5)?,
        page_paths: parse_json_vec(row.get::<_, String>(6)?),
        exists_on_disk: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
    })
}

fn map_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<LibraryEntry> {
    Ok(LibraryEntry {
        id: row.get(0)?,
        title_id: row.get(1)?,
        status: row.get(2)?,
        preferred_edition_id: row.get(3)?,
        added_at: row.get(4)?,
        last_opened_at: row.get(5)?,
        is_local: row.get::<_, i64>(6)? != 0,
        is_downloaded: row.get::<_, i64>(7)? != 0,
    })
}

fn map_progress(row: &rusqlite::Row<'_>) -> rusqlite::Result<ReadingProgress> {
    Ok(ReadingProgress {
        id: row.get(0)?,
        edition_id: row.get(1)?,
        chapter_id: row.get(2)?,
        page_index: row.get(3)?,
        scroll_ratio: row.get(4)?,
        completed: row.get::<_, i64>(5)? != 0,
        updated_at: row.get(6)?,
    })
}

pub fn get_setting(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .optional()
    .map_err(AppError::from)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> AppResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn insert_title(conn: &Connection, title: &Title) -> AppResult<()> {
    conn.execute(
        "INSERT INTO titles (
            id, primary_title, alternate_titles, description, author, artist,
            genres, tags, content_type, original_language, publication_status,
            cover_path, created_at, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        params![
            title.id,
            title.primary_title,
            serde_json::to_string(&title.alternate_titles).unwrap_or_else(|_| "[]".into()),
            title.description,
            title.author,
            title.artist,
            serde_json::to_string(&title.genres).unwrap_or_else(|_| "[]".into()),
            serde_json::to_string(&title.tags).unwrap_or_else(|_| "[]".into()),
            title.content_type,
            title.original_language,
            title.publication_status,
            title.cover_path,
            title.created_at,
            title.updated_at,
        ],
    )?;
    Ok(())
}

pub fn insert_edition(conn: &Connection, edition: &Edition) -> AppResult<()> {
    conn.execute(
        "INSERT INTO editions (
            id, title_id, label, language, reading_direction, reading_mode,
            source_kind, provider_id, provider_title_id, created_at, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        params![
            edition.id,
            edition.title_id,
            edition.label,
            edition.language,
            edition.reading_direction,
            edition.reading_mode,
            edition.source_kind,
            edition.provider_id,
            edition.provider_title_id,
            edition.created_at,
            edition.updated_at,
        ],
    )?;
    Ok(())
}

pub fn insert_chapter(conn: &Connection, chapter: &Chapter) -> AppResult<()> {
    conn.execute(
        "INSERT INTO chapters (
            id, edition_id, number, title, sort_index, page_count, created_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            chapter.id,
            chapter.edition_id,
            chapter.number,
            chapter.title,
            chapter.sort_index,
            chapter.page_count,
            chapter.created_at,
        ],
    )?;
    Ok(())
}

pub fn insert_local_file(conn: &Connection, file: &LocalFile) -> AppResult<()> {
    conn.execute(
        "INSERT INTO local_files (
            id, edition_id, chapter_id, kind, source_path, managed_path,
            page_paths, exists_on_disk, created_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            file.id,
            file.edition_id,
            file.chapter_id,
            file.kind,
            file.source_path,
            file.managed_path,
            serde_json::to_string(&file.page_paths).unwrap_or_else(|_| "[]".into()),
            if file.exists_on_disk { 1 } else { 0 },
            file.created_at,
        ],
    )?;
    Ok(())
}

pub fn insert_library_entry(conn: &Connection, entry: &LibraryEntry) -> AppResult<()> {
    conn.execute(
        "INSERT INTO library_entries (
            id, title_id, status, preferred_edition_id, added_at, last_opened_at,
            is_local, is_downloaded
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            entry.id,
            entry.title_id,
            entry.status,
            entry.preferred_edition_id,
            entry.added_at,
            entry.last_opened_at,
            if entry.is_local { 1 } else { 0 },
            if entry.is_downloaded { 1 } else { 0 },
        ],
    )?;
    Ok(())
}

pub fn get_title(conn: &Connection, id: &str) -> AppResult<Option<Title>> {
    conn.query_row(
        "SELECT id, primary_title, alternate_titles, description, author, artist,
                genres, tags, content_type, original_language, publication_status,
                cover_path, created_at, updated_at
         FROM titles WHERE id = ?1",
        params![id],
        map_title,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn get_edition(conn: &Connection, id: &str) -> AppResult<Option<Edition>> {
    conn.query_row(
        "SELECT id, title_id, label, language, reading_direction, reading_mode,
                source_kind, provider_id, provider_title_id, created_at, updated_at
         FROM editions WHERE id = ?1",
        params![id],
        map_edition,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn list_editions_for_title(conn: &Connection, title_id: &str) -> AppResult<Vec<Edition>> {
    let mut stmt = conn.prepare(
        "SELECT id, title_id, label, language, reading_direction, reading_mode,
                source_kind, provider_id, provider_title_id, created_at, updated_at
         FROM editions WHERE title_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(params![title_id], map_edition)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)
}

pub fn list_chapters(conn: &Connection, edition_id: &str) -> AppResult<Vec<Chapter>> {
    let mut stmt = conn.prepare(
        "SELECT id, edition_id, number, title, sort_index, page_count, created_at
         FROM chapters WHERE edition_id = ?1 ORDER BY sort_index",
    )?;
    let rows = stmt.query_map(params![edition_id], map_chapter)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)
}

pub fn get_chapter(conn: &Connection, id: &str) -> AppResult<Option<Chapter>> {
    conn.query_row(
        "SELECT id, edition_id, number, title, sort_index, page_count, created_at
         FROM chapters WHERE id = ?1",
        params![id],
        map_chapter,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn list_local_files(conn: &Connection, edition_id: &str) -> AppResult<Vec<LocalFile>> {
    let mut stmt = conn.prepare(
        "SELECT id, edition_id, chapter_id, kind, source_path, managed_path,
                page_paths, exists_on_disk, created_at
         FROM local_files WHERE edition_id = ?1",
    )?;
    let rows = stmt.query_map(params![edition_id], map_local_file)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(AppError::from)
}

pub fn get_local_file_for_chapter(
    conn: &Connection,
    chapter_id: &str,
) -> AppResult<Option<LocalFile>> {
    conn.query_row(
        "SELECT id, edition_id, chapter_id, kind, source_path, managed_path,
                page_paths, exists_on_disk, created_at
         FROM local_files WHERE chapter_id = ?1 LIMIT 1",
        params![chapter_id],
        map_local_file,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn get_library_entry(conn: &Connection, title_id: &str) -> AppResult<Option<LibraryEntry>> {
    conn.query_row(
        "SELECT id, title_id, status, preferred_edition_id, added_at, last_opened_at,
                is_local, is_downloaded
         FROM library_entries WHERE title_id = ?1",
        params![title_id],
        map_entry,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn get_progress(conn: &Connection, edition_id: &str) -> AppResult<Option<ReadingProgress>> {
    conn.query_row(
        "SELECT id, edition_id, chapter_id, page_index, scroll_ratio, completed, updated_at
         FROM reading_progress WHERE edition_id = ?1",
        params![edition_id],
        map_progress,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn upsert_progress(conn: &Connection, progress: &ReadingProgress) -> AppResult<()> {
    conn.execute(
        "INSERT INTO reading_progress (
            id, edition_id, chapter_id, page_index, scroll_ratio, completed, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(edition_id) DO UPDATE SET
            chapter_id = excluded.chapter_id,
            page_index = excluded.page_index,
            scroll_ratio = excluded.scroll_ratio,
            completed = excluded.completed,
            updated_at = excluded.updated_at",
        params![
            progress.id,
            progress.edition_id,
            progress.chapter_id,
            progress.page_index,
            progress.scroll_ratio,
            if progress.completed { 1 } else { 0 },
            progress.updated_at,
        ],
    )?;
    Ok(())
}

pub fn touch_library_opened(conn: &Connection, title_id: &str, opened_at: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE library_entries SET last_opened_at = ?2 WHERE title_id = ?1",
        params![title_id, opened_at],
    )?;
    Ok(())
}

pub fn insert_history(
    conn: &Connection,
    id: &str,
    title_id: &str,
    edition_id: &str,
    chapter_id: Option<&str>,
    opened_at: &str,
) -> AppResult<()> {
    conn.execute(
        "INSERT INTO reading_history (id, title_id, edition_id, chapter_id, opened_at)
         VALUES (?1,?2,?3,?4,?5)",
        params![id, title_id, edition_id, chapter_id, opened_at],
    )?;
    Ok(())
}

pub fn list_library(
    conn: &Connection,
    status: Option<&str>,
    query: Option<&str>,
    sort: &str,
    local_only: bool,
) -> AppResult<Vec<LibraryItem>> {
    let mut sql = String::from(
        "SELECT t.id, t.primary_title, t.alternate_titles, t.description, t.author, t.artist,
                t.genres, t.tags, t.content_type, t.original_language, t.publication_status,
                t.cover_path, t.created_at, t.updated_at,
                e.id, e.title_id, e.status, e.preferred_edition_id, e.added_at, e.last_opened_at,
                e.is_local, e.is_downloaded
         FROM library_entries e
         JOIN titles t ON t.id = e.title_id
         WHERE 1=1",
    );

    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(status) = status {
        if status != "all" {
            sql.push_str(" AND e.status = ?");
            params_vec.push(Box::new(status.to_string()));
        }
    }
    if local_only {
        sql.push_str(" AND e.is_local = 1");
    }
    if let Some(q) = query {
        let trimmed = q.trim();
        if !trimmed.is_empty() {
            sql.push_str(" AND (LOWER(t.primary_title) LIKE ? OR LOWER(COALESCE(t.author,'')) LIKE ?)");
            let like = format!("%{}%", trimmed.to_lowercase());
            params_vec.push(Box::new(like.clone()));
            params_vec.push(Box::new(like));
        }
    }

    match sort {
        "title" => sql.push_str(" ORDER BY LOWER(t.primary_title) ASC"),
        "added" => sql.push_str(" ORDER BY e.added_at DESC"),
        "progress" => sql.push_str(" ORDER BY e.last_opened_at IS NULL, e.last_opened_at DESC"),
        _ => sql.push_str(" ORDER BY e.last_opened_at IS NULL, e.last_opened_at DESC, e.added_at DESC"),
    }

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        let title = Title {
            id: row.get(0)?,
            primary_title: row.get(1)?,
            alternate_titles: parse_json_vec(row.get::<_, String>(2)?),
            description: row.get(3)?,
            author: row.get(4)?,
            artist: row.get(5)?,
            genres: parse_json_vec(row.get::<_, String>(6)?),
            tags: parse_json_vec(row.get::<_, String>(7)?),
            content_type: row.get(8)?,
            original_language: row.get(9)?,
            publication_status: row.get(10)?,
            cover_path: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        };
        let entry = LibraryEntry {
            id: row.get(14)?,
            title_id: row.get(15)?,
            status: row.get(16)?,
            preferred_edition_id: row.get(17)?,
            added_at: row.get(18)?,
            last_opened_at: row.get(19)?,
            is_local: row.get::<_, i64>(20)? != 0,
            is_downloaded: row.get::<_, i64>(21)? != 0,
        };
        Ok((title, entry))
    })?;

    let mut items = Vec::new();
    for row in rows {
        let (title, entry) = row?;
        let preferred_edition = entry
            .preferred_edition_id
            .as_ref()
            .and_then(|id| get_edition(conn, id).ok().flatten());
        let progress = preferred_edition
            .as_ref()
            .and_then(|ed| get_progress(conn, &ed.id).ok().flatten());
        let chapter_count = preferred_edition
            .as_ref()
            .map(|ed| {
                conn.query_row(
                    "SELECT COUNT(*) FROM chapters WHERE edition_id = ?1",
                    params![ed.id],
                    |r| r.get::<_, i64>(0),
                )
                .unwrap_or(0)
            })
            .unwrap_or(0);
        let current_chapter_title = progress
            .as_ref()
            .and_then(|p| p.chapter_id.as_ref())
            .and_then(|cid| get_chapter(conn, cid).ok().flatten())
            .map(|c| c.title);

        items.push(LibraryItem {
            title,
            entry,
            preferred_edition,
            progress,
            chapter_count,
            current_chapter_title,
        });
    }

    Ok(items)
}

pub fn update_title_fields(conn: &Connection, input: &UpdateTitleInput) -> AppResult<()> {
    let mut title = get_title(conn, &input.id)?
        .ok_or_else(|| AppError::Message("Title not found".into()))?;

    if let Some(v) = &input.primary_title {
        title.primary_title = v.clone();
    }
    if let Some(v) = &input.description {
        title.description = Some(v.clone());
    }
    if let Some(v) = &input.author {
        title.author = Some(v.clone());
    }
    if let Some(v) = &input.artist {
        title.artist = Some(v.clone());
    }
    if let Some(v) = &input.content_type {
        title.content_type = v.clone();
    }
    title.updated_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE titles SET primary_title=?2, description=?3, author=?4, artist=?5,
         content_type=?6, updated_at=?7 WHERE id=?1",
        params![
            title.id,
            title.primary_title,
            title.description,
            title.author,
            title.artist,
            title.content_type,
            title.updated_at,
        ],
    )?;

    if let Some(status) = &input.status {
        conn.execute(
            "UPDATE library_entries SET status = ?2 WHERE title_id = ?1",
            params![title.id, status],
        )?;
    }

    if input.reading_direction.is_some() || input.reading_mode.is_some() {
        if let Some(entry) = get_library_entry(conn, &title.id)? {
            if let Some(edition_id) = entry.preferred_edition_id {
                if let Some(direction) = &input.reading_direction {
                    conn.execute(
                        "UPDATE editions SET reading_direction = ?2, updated_at = ?3 WHERE id = ?1",
                        params![edition_id, direction, chrono::Utc::now().to_rfc3339()],
                    )?;
                }
                if let Some(mode) = &input.reading_mode {
                    conn.execute(
                        "UPDATE editions SET reading_mode = ?2, updated_at = ?3 WHERE id = ?1",
                        params![edition_id, mode, chrono::Utc::now().to_rfc3339()],
                    )?;
                }
            }
        }
    }

    Ok(())
}

pub fn remove_library_title(conn: &Connection, title_id: &str) -> AppResult<()> {
    // Cascades remove editions/chapters/local_files metadata; originals on disk stay.
    conn.execute("DELETE FROM titles WHERE id = ?1", params![title_id])?;
    Ok(())
}

pub fn find_edition_by_provider(
    conn: &Connection,
    provider_id: &str,
    provider_title_id: &str,
) -> AppResult<Option<Edition>> {
    conn.query_row(
        "SELECT id, title_id, label, language, reading_direction, reading_mode,
                source_kind, provider_id, provider_title_id, created_at, updated_at
         FROM editions
         WHERE provider_id = ?1 AND provider_title_id = ?2
         LIMIT 1",
        params![provider_id, provider_title_id],
        map_edition,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn get_remote_library_ref(
    conn: &Connection,
    provider_id: &str,
    provider_title_id: &str,
) -> AppResult<RemoteLibraryRef> {
    if let Some(edition) = find_edition_by_provider(conn, provider_id, provider_title_id)? {
        let in_library = get_library_entry(conn, &edition.title_id)?.is_some();
        Ok(RemoteLibraryRef {
            title_id: edition.title_id,
            edition_id: edition.id,
            provider_id: provider_id.to_string(),
            provider_title_id: provider_title_id.to_string(),
            in_library,
        })
    } else {
        Ok(RemoteLibraryRef {
            title_id: String::new(),
            edition_id: String::new(),
            provider_id: provider_id.to_string(),
            provider_title_id: provider_title_id.to_string(),
            in_library: false,
        })
    }
}

pub fn add_remote_title_to_library(
    conn: &Connection,
    input: &AddRemoteLibraryInput,
) -> AppResult<RemoteLibraryRef> {
    if let Some(existing) =
        find_edition_by_provider(conn, &input.provider_id, &input.provider_title_id)?
    {
        if get_library_entry(conn, &existing.title_id)?.is_none() {
            let now = chrono::Utc::now().to_rfc3339();
            insert_library_entry(
                conn,
                &LibraryEntry {
                    id: Uuid::new_v4().to_string(),
                    title_id: existing.title_id.clone(),
                    status: "planned".into(),
                    preferred_edition_id: Some(existing.id.clone()),
                    added_at: now,
                    last_opened_at: None,
                    is_local: false,
                    is_downloaded: false,
                },
            )?;
        }
        return Ok(RemoteLibraryRef {
            title_id: existing.title_id,
            edition_id: existing.id,
            provider_id: input.provider_id.clone(),
            provider_title_id: input.provider_title_id.clone(),
            in_library: true,
        });
    }

    let now = chrono::Utc::now().to_rfc3339();
    let title_id = Uuid::new_v4().to_string();
    let edition_id = Uuid::new_v4().to_string();
    let reading_direction = input
        .reading_direction
        .clone()
        .unwrap_or_else(|| {
            if input.content_type == "manhwa" {
                "ltr".into()
            } else {
                "ltr".into()
            }
        });
    let reading_mode = input
        .reading_mode
        .clone()
        .unwrap_or_else(|| {
            if input.content_type == "manhwa" {
                "vertical".into()
            } else {
                "page".into()
            }
        });

    insert_title(
        conn,
        &Title {
            id: title_id.clone(),
            primary_title: input.primary_title.clone(),
            alternate_titles: input.alternate_titles.clone(),
            description: input.description.clone(),
            author: input.author.clone(),
            artist: input.artist.clone(),
            genres: input.genres.clone(),
            tags: input.tags.clone(),
            content_type: input.content_type.clone(),
            original_language: None,
            publication_status: input.publication_status.clone(),
            cover_path: input.cover_url.clone(),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
    )?;

    insert_edition(
        conn,
        &Edition {
            id: edition_id.clone(),
            title_id: title_id.clone(),
            label: input.provider_name.clone(),
            language: None,
            reading_direction,
            reading_mode,
            source_kind: "remote".into(),
            provider_id: Some(input.provider_id.clone()),
            provider_title_id: Some(input.provider_title_id.clone()),
            created_at: now.clone(),
            updated_at: now.clone(),
        },
    )?;

    insert_library_entry(
        conn,
        &LibraryEntry {
            id: Uuid::new_v4().to_string(),
            title_id: title_id.clone(),
            status: "planned".into(),
            preferred_edition_id: Some(edition_id.clone()),
            added_at: now,
            last_opened_at: None,
            is_local: false,
            is_downloaded: false,
        },
    )?;

    let _ = input.website_url;

    Ok(RemoteLibraryRef {
        title_id,
        edition_id,
        provider_id: input.provider_id.clone(),
        provider_title_id: input.provider_title_id.clone(),
        in_library: true,
    })
}

pub fn title_details(conn: &Connection, title_id: &str) -> AppResult<TitleDetails> {
    let title = get_title(conn, title_id)?
        .ok_or_else(|| AppError::Message("Title not found".into()))?;
    let entry = get_library_entry(conn, title_id)?;
    let editions = list_editions_for_title(conn, title_id)?;
    let preferred_id = entry
        .as_ref()
        .and_then(|e| e.preferred_edition_id.clone())
        .or_else(|| editions.first().map(|e| e.id.clone()));
    let chapters = if let Some(eid) = &preferred_id {
        list_chapters(conn, eid)?
    } else {
        Vec::new()
    };
    let progress = preferred_id
        .as_ref()
        .and_then(|id| get_progress(conn, id).ok().flatten());
    let mut local_files = preferred_id
        .as_ref()
        .map(|id| list_local_files(conn, id).unwrap_or_default())
        .unwrap_or_default();
    for file in &mut local_files {
        refresh_local_file_existence(conn, file)?;
    }

    Ok(TitleDetails {
        title,
        entry,
        editions,
        chapters,
        progress,
        local_files,
    })
}

pub fn search_library(conn: &Connection, query: &str) -> AppResult<Vec<LibraryItem>> {
    list_library(conn, Some("all"), Some(query), "title", false)
}

pub fn refresh_local_file_existence(conn: &Connection, file: &mut LocalFile) -> AppResult<()> {
    let pages_ok = !file.page_paths.is_empty()
        && file
            .page_paths
            .iter()
            .any(|p| std::path::Path::new(p).exists());
    let source_ok = std::path::Path::new(&file.source_path).exists();
    let exists = pages_ok || source_ok;
    if file.exists_on_disk != exists {
        file.exists_on_disk = exists;
        conn.execute(
            "UPDATE local_files SET exists_on_disk = ?2 WHERE id = ?1",
            params![file.id, if exists { 1 } else { 0 }],
        )?;
    }
    Ok(())
}

pub fn get_local_file(conn: &Connection, id: &str) -> AppResult<Option<LocalFile>> {
    conn.query_row(
        "SELECT id, edition_id, chapter_id, kind, source_path, managed_path,
                page_paths, exists_on_disk, created_at
         FROM local_files WHERE id = ?1",
        params![id],
        map_local_file,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn update_local_file_pages(
    conn: &Connection,
    id: &str,
    source_path: &str,
    managed_path: Option<&str>,
    page_paths: &[String],
    kind: &str,
) -> AppResult<()> {
    conn.execute(
        "UPDATE local_files
         SET source_path = ?2, managed_path = ?3, page_paths = ?4, kind = ?5, exists_on_disk = 1
         WHERE id = ?1",
        params![
            id,
            source_path,
            managed_path,
            serde_json::to_string(page_paths).unwrap_or_else(|_| "[]".into()),
            kind,
        ],
    )?;
    if let Some(chapter_id) = conn
        .query_row(
            "SELECT chapter_id FROM local_files WHERE id = ?1",
            params![id],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten()
    {
        conn.execute(
            "UPDATE chapters SET page_count = ?2 WHERE id = ?1",
            params![chapter_id, page_paths.len() as i64],
        )?;
    }
    Ok(())
}

pub fn list_history(conn: &Connection, limit: i64) -> AppResult<Vec<HistoryItem>> {
    let mut stmt = conn.prepare(
        "SELECT h.id, h.opened_at, h.title_id, h.edition_id, h.chapter_id
         FROM reading_history h
         ORDER BY h.opened_at DESC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    })?;

    let mut items = Vec::new();
    for row in rows {
        let (id, opened_at, title_id, edition_id, chapter_id) = row?;
        let Some(title) = get_title(conn, &title_id)? else {
            continue;
        };
        let Some(edition) = get_edition(conn, &edition_id)? else {
            continue;
        };
        let chapter = chapter_id
            .as_ref()
            .and_then(|cid| get_chapter(conn, cid).ok().flatten());
        let progress = get_progress(conn, &edition_id)?;
        items.push(HistoryItem {
            id,
            opened_at,
            title,
            edition,
            chapter,
            progress,
        });
    }
    Ok(items)
}

pub fn clear_history(conn: &Connection) -> AppResult<()> {
    conn.execute("DELETE FROM reading_history", [])?;
    Ok(())
}

pub fn insert_bookmark(conn: &Connection, bookmark: &Bookmark) -> AppResult<()> {
    conn.execute(
        "INSERT INTO bookmarks (
            id, title_id, edition_id, chapter_id, page_index, scroll_ratio, note, created_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            bookmark.id,
            bookmark.title_id,
            bookmark.edition_id,
            bookmark.chapter_id,
            bookmark.page_index,
            bookmark.scroll_ratio,
            bookmark.note,
            bookmark.created_at,
        ],
    )?;
    Ok(())
}

pub fn list_bookmarks(conn: &Connection) -> AppResult<Vec<Bookmark>> {
    let mut stmt = conn.prepare(
        "SELECT id, title_id, edition_id, chapter_id, page_index, scroll_ratio, note, created_at
         FROM bookmarks
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<i64>>(4)?,
            row.get::<_, Option<f64>>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, String>(7)?,
        ))
    })?;

    let mut items = Vec::new();
    for row in rows {
        let (id, title_id, edition_id, chapter_id, page_index, scroll_ratio, note, created_at) =
            row?;
        let Some(title) = get_title(conn, &title_id)? else {
            continue;
        };
        let edition = edition_id
            .as_ref()
            .and_then(|eid| get_edition(conn, eid).ok().flatten());
        let chapter = chapter_id
            .as_ref()
            .and_then(|cid| get_chapter(conn, cid).ok().flatten());
        items.push(Bookmark {
            id,
            title_id,
            edition_id,
            chapter_id,
            page_index,
            scroll_ratio,
            note,
            created_at,
            title,
            edition,
            chapter,
        });
    }
    Ok(items)
}

pub fn delete_bookmark(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn find_matching_bookmark(
    conn: &Connection,
    title_id: &str,
    edition_id: Option<&str>,
    chapter_id: Option<&str>,
    page_index: Option<i64>,
) -> AppResult<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM bookmarks
         WHERE title_id = ?1
           AND ((?2 IS NULL AND edition_id IS NULL) OR edition_id = ?2)
           AND ((?3 IS NULL AND chapter_id IS NULL) OR chapter_id = ?3)
           AND ((?4 IS NULL AND page_index IS NULL) OR page_index = ?4)
         LIMIT 1",
    )?;
    stmt.query_row(
        params![title_id, edition_id, chapter_id, page_index],
        |row| row.get(0),
    )
    .optional()
    .map_err(AppError::from)
}
