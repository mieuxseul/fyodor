use base64::{engine::general_purpose::STANDARD, Engine as _};

use crate::error::AppResult;
use crate::providers::atsu::{
    self, AtsuChapter, AtsuChapterPages, AtsuSearchItem, AtsuTitleBundle, AtsuTitleDetails,
};

#[tauri::command]
pub async fn atsu_search(query: String, limit: Option<u32>) -> AppResult<Vec<AtsuSearchItem>> {
    atsu::search_manga(&query, limit.unwrap_or(12)).await
}

#[tauri::command]
pub async fn atsu_health() -> AppResult<()> {
    atsu::health_check().await
}

#[tauri::command]
pub async fn atsu_title_details(manga_id: String) -> AppResult<AtsuTitleDetails> {
    atsu::title_details(&manga_id).await
}

#[tauri::command]
pub async fn atsu_title_bundle(manga_id: String) -> AppResult<AtsuTitleBundle> {
    atsu::title_bundle(&manga_id).await
}

#[tauri::command]
pub async fn atsu_chapters(manga_id: String) -> AppResult<Vec<AtsuChapter>> {
    atsu::list_chapters(&manga_id).await
}

#[tauri::command]
pub async fn atsu_chapter_pages(
    manga_id: String,
    chapter_id: String,
) -> AppResult<AtsuChapterPages> {
    atsu::chapter_pages(&manga_id, &chapter_id).await
}

fn atsu_data_url(url: &str, bytes: &[u8]) -> String {
    let lower = url.to_ascii_lowercase();
    let mime = if lower.contains(".png") {
        "image/png"
    } else if lower.contains(".gif") {
        "image/gif"
    } else if lower.contains(".webp") {
        "image/webp"
    } else if lower.contains(".avif") {
        "image/avif"
    } else {
        "image/jpeg"
    };
    format!("data:{mime};base64,{}", STANDARD.encode(bytes))
}

#[tauri::command]
pub async fn atsu_cover_data_url(cover_url: String) -> AppResult<String> {
    let bytes = atsu::fetch_cdn_bytes(&cover_url).await?;
    Ok(atsu_data_url(&cover_url, &bytes))
}

/// Proxy any Atsu CDN static asset (covers or chapter page images) to a data URL.
#[tauri::command]
pub async fn atsu_image_data_url(image_url: String) -> AppResult<String> {
    let bytes = atsu::fetch_cdn_bytes(&image_url).await?;
    Ok(atsu_data_url(&image_url, &bytes))
}
