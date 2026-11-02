pub mod migrations;
pub mod models;
pub mod repos;

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppResult;

use self::migrations::run_migrations;

pub struct Database;

impl Database {
    pub fn open(path: &Path) -> AppResult<Connection> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        run_migrations(&conn)?;
        Ok(conn)
    }
}
