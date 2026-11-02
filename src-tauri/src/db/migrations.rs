use rusqlite::Connection;

use crate::error::AppResult;

const MIGRATIONS: &[&str] = &[
    // v1 — core schema
    r#"
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS titles (
      id TEXT PRIMARY KEY,
      primary_title TEXT NOT NULL,
      alternate_titles TEXT NOT NULL DEFAULT '[]',
      description TEXT,
      author TEXT,
      artist TEXT,
      genres TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      content_type TEXT NOT NULL DEFAULT 'manga',
      original_language TEXT,
      publication_status TEXT,
      cover_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS editions (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT 'Local',
      language TEXT,
      reading_direction TEXT NOT NULL DEFAULT 'ltr',
      reading_mode TEXT NOT NULL DEFAULT 'page',
      source_kind TEXT NOT NULL DEFAULT 'local',
      provider_id TEXT,
      provider_title_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
      number REAL,
      title TEXT NOT NULL,
      sort_index INTEGER NOT NULL,
      page_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_files (
      id TEXT PRIMARY KEY,
      edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      kind TEXT NOT NULL,
      source_path TEXT NOT NULL,
      managed_path TEXT,
      page_paths TEXT NOT NULL DEFAULT '[]',
      exists_on_disk INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_entries (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL UNIQUE REFERENCES titles(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'planned',
      preferred_edition_id TEXT REFERENCES editions(id) ON DELETE SET NULL,
      added_at TEXT NOT NULL,
      last_opened_at TEXT,
      is_local INTEGER NOT NULL DEFAULT 1,
      is_downloaded INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      edition_id TEXT NOT NULL UNIQUE REFERENCES editions(id) ON DELETE CASCADE,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      page_index INTEGER NOT NULL DEFAULT 0,
      scroll_ratio REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reading_history (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
      edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      opened_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
      edition_id TEXT REFERENCES editions(id) ON DELETE CASCADE,
      chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
      page_index INTEGER,
      scroll_ratio REAL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS download_records (
      id TEXT PRIMARY KEY,
      edition_id TEXT,
      chapter_id TEXT,
      status TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      capabilities TEXT NOT NULL DEFAULT '{}',
      health_status TEXT NOT NULL DEFAULT 'disabled',
      last_checked_at TEXT,
      last_success_at TEXT,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_editions_title ON editions(title_id);
    CREATE INDEX IF NOT EXISTS idx_chapters_edition ON chapters(edition_id, sort_index);
    CREATE INDEX IF NOT EXISTS idx_local_files_edition ON local_files(edition_id);
    CREATE INDEX IF NOT EXISTS idx_library_status ON library_entries(status);
    CREATE INDEX IF NOT EXISTS idx_history_opened ON reading_history(opened_at DESC);
    "#,
    // v2 — unique remote provider editions for library dedupe
    r#"
    CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_provider_unique
      ON editions(provider_id, provider_title_id)
      WHERE provider_id IS NOT NULL AND provider_title_id IS NOT NULL;
    "#,
];

pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;",
    )?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    for (index, sql) in MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if version <= current {
            continue;
        }
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![version, chrono::Utc::now().to_rfc3339()],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn migrations_apply_cleanly() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let version: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(version >= 1);
    }
}
