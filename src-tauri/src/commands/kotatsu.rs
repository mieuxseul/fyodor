use serde_json::Value;

use crate::error::AppResult;
use crate::providers::kotatsu::{
    self, KotatsuChapter, KotatsuPages, KotatsuSearchItem, KotatsuSource,
};

#[tauri::command]
pub fn kotatsu_health() -> AppResult<()> {
    kotatsu::health_check()
}

#[tauri::command]
pub fn kotatsu_list_sources() -> AppResult<Vec<KotatsuSource>> {
    kotatsu::list_sources()
}

#[tauri::command]
pub fn kotatsu_search(
    source: String,
    query: String,
    limit: Option<u32>,
) -> AppResult<Vec<KotatsuSearchItem>> {
    kotatsu::search(&source, &query, limit.unwrap_or(12))
}

#[tauri::command]
pub fn kotatsu_search_many(
    sources: Vec<String>,
    query: String,
    limit: Option<u32>,
    timeout_ms: Option<u64>,
) -> AppResult<Value> {
    let capped: Vec<String> = sources.into_iter().take(12).collect();
    let (results, errors) = kotatsu::search_many(
        &capped,
        &query,
        limit.unwrap_or(8).clamp(1, 30),
        timeout_ms.unwrap_or(12_000).clamp(2_000, 30_000),
    )?;
    Ok(serde_json::json!({
        "ok": true,
        "results": results,
        "errors": errors,
    }))
}

#[tauri::command]
pub fn kotatsu_title_details(
    source: String,
    url: String,
    title: Option<String>,
) -> AppResult<Value> {
    kotatsu::details(&source, &url, title)
}

#[tauri::command]
pub fn kotatsu_chapters(
    source: String,
    url: String,
    title: Option<String>,
) -> AppResult<Vec<KotatsuChapter>> {
    kotatsu::chapters(&source, &url, title)
}

#[tauri::command]
pub fn kotatsu_chapter_pages(
    source: String,
    chapter_url: String,
    chapter_id: Option<String>,
) -> AppResult<KotatsuPages> {
    kotatsu::pages(&source, &chapter_url, chapter_id)
}

#[tauri::command]
pub fn kotatsu_bridge_status() -> AppResult<String> {
    kotatsu::health_check()?;
    Ok(kotatsu::jar_path_hint())
}
