use base64::{engine::general_purpose::STANDARD, Engine as _};

use crate::error::AppResult;
use crate::providers::mangadex::{
    self, MangaDexChapter, MangaDexChapterPages, MangaDexSearchItem, MangaDexTitleDetails,
};

#[tauri::command]
pub async fn mangadex_search(
    query: String,
    limit: Option<u32>,
) -> AppResult<Vec<MangaDexSearchItem>> {
    mangadex::search_manga(&query, limit.unwrap_or(12)).await
}

#[tauri::command]
pub async fn mangadex_health() -> AppResult<()> {
    mangadex::health_check().await
}

#[tauri::command]
pub async fn mangadex_title_details(manga_id: String) -> AppResult<MangaDexTitleDetails> {
    mangadex::title_details(&manga_id).await
}

#[tauri::command]
pub async fn mangadex_chapters(manga_id: String) -> AppResult<Vec<MangaDexChapter>> {
    mangadex::list_chapters(&manga_id).await
}

#[tauri::command]
pub async fn mangadex_chapter_pages(
    manga_id: String,
    chapter_id: String,
) -> AppResult<MangaDexChapterPages> {
    mangadex::chapter_pages(&manga_id, &chapter_id).await
}

#[tauri::command]
pub async fn mangadex_cover_data_url(cover_url: String) -> AppResult<String> {
    let bytes = mangadex::fetch_cover_bytes(&cover_url).await?;
    let mime = if cover_url.ends_with(".png") {
        "image/png"
    } else if cover_url.ends_with(".gif") {
        "image/gif"
    } else if cover_url.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    };
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}
