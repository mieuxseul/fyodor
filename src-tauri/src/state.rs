use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::db::Database;
use crate::error::{AppError, AppResult};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub covers_dir: PathBuf,
    pub cache_dir: PathBuf,
}

impl AppState {
    pub fn initialize(app: &AppHandle) -> AppResult<Self> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::Message(e.to_string()))?;
        let covers_dir = data_dir.join("covers");
        let cache_dir = data_dir.join("cache");
        let chapters_dir = cache_dir.join("chapters");
        std::fs::create_dir_all(&covers_dir)?;
        std::fs::create_dir_all(&chapters_dir)?;

        let db_path = data_dir.join("fyodor.db");
        let conn = Database::open(&db_path)?;

        Ok(Self {
            db: Mutex::new(conn),
            data_dir,
            db_path,
            covers_dir,
            cache_dir,
        })
    }

    pub fn with_db<T>(
        &self,
        f: impl FnOnce(&mut Connection) -> AppResult<T>,
    ) -> AppResult<T> {
        let mut conn = self
            .db
            .lock()
            .map_err(|_| AppError::Message("Database lock poisoned".into()))?;
        f(&mut conn)
    }
}
