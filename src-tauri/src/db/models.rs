use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Title {
    pub id: String,
    pub primary_title: String,
    pub alternate_titles: Vec<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub artist: Option<String>,
    pub genres: Vec<String>,
    pub tags: Vec<String>,
    pub content_type: String,
    pub original_language: Option<String>,
    pub publication_status: Option<String>,
    pub cover_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Edition {
    pub id: String,
    pub title_id: String,
    pub label: String,
    pub language: Option<String>,
    pub reading_direction: String,
    pub reading_mode: String,
    pub source_kind: String,
    pub provider_id: Option<String>,
    pub provider_title_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub id: String,
    pub edition_id: String,
    pub number: Option<f64>,
    pub title: String,
    pub sort_index: i64,
    pub page_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFile {
    pub id: String,
    pub edition_id: String,
    pub chapter_id: Option<String>,
    pub kind: String,
    pub source_path: String,
    pub managed_path: Option<String>,
    pub page_paths: Vec<String>,
    pub exists_on_disk: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    pub id: String,
    pub title_id: String,
    pub status: String,
    pub preferred_edition_id: Option<String>,
    pub added_at: String,
    pub last_opened_at: Option<String>,
    pub is_local: bool,
    pub is_downloaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingProgress {
    pub id: String,
    pub edition_id: String,
    pub chapter_id: Option<String>,
    pub page_index: i64,
    pub scroll_ratio: f64,
    pub completed: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryItem {
    pub title: Title,
    pub entry: LibraryEntry,
    pub preferred_edition: Option<Edition>,
    pub progress: Option<ReadingProgress>,
    pub chapter_count: i64,
    pub current_chapter_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TitleDetails {
    pub title: Title,
    pub entry: Option<LibraryEntry>,
    pub editions: Vec<Edition>,
    pub chapters: Vec<Chapter>,
    pub progress: Option<ReadingProgress>,
    pub local_files: Vec<LocalFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTitleInput {
    pub id: String,
    pub primary_title: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub artist: Option<String>,
    pub content_type: Option<String>,
    pub status: Option<String>,
    pub reading_direction: Option<String>,
    pub reading_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProgressInput {
    pub edition_id: String,
    pub chapter_id: Option<String>,
    pub page_index: i64,
    pub scroll_ratio: f64,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterPages {
    pub chapter: Chapter,
    pub pages: Vec<String>,
    pub source_path: Option<String>,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub title_id: String,
    pub edition_id: String,
    pub primary_title: String,
    pub chapter_count: i64,
    pub page_count: i64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub data_dir: String,
    pub database_path: String,
    pub covers_dir: String,
    pub cache_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub opened_at: String,
    pub title: Title,
    pub edition: Edition,
    pub chapter: Option<Chapter>,
    pub progress: Option<ReadingProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: String,
    pub title_id: String,
    pub edition_id: Option<String>,
    pub chapter_id: Option<String>,
    pub page_index: Option<i64>,
    pub scroll_ratio: Option<f64>,
    pub note: Option<String>,
    pub created_at: String,
    pub title: Title,
    pub edition: Option<Edition>,
    pub chapter: Option<Chapter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookmarkInput {
    pub title_id: String,
    pub edition_id: Option<String>,
    pub chapter_id: Option<String>,
    pub page_index: Option<i64>,
    pub scroll_ratio: Option<f64>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRemoteLibraryInput {
    pub provider_id: String,
    pub provider_name: String,
    pub provider_title_id: String,
    pub primary_title: String,
    pub alternate_titles: Vec<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub artist: Option<String>,
    pub genres: Vec<String>,
    pub tags: Vec<String>,
    pub content_type: String,
    pub publication_status: Option<String>,
    pub cover_url: Option<String>,
    pub website_url: Option<String>,
    pub reading_direction: Option<String>,
    pub reading_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteLibraryRef {
    pub title_id: String,
    pub edition_id: String,
    pub provider_id: String,
    pub provider_title_id: String,
    pub in_library: bool,
}
