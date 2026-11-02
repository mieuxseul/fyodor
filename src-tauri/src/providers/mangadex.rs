use std::sync::OnceLock;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};

const API_BASE: &str = "https://api.mangadex.org";
const SITE_BASE: &str = "https://mangadex.org/title";
const MIN_REQUEST_GAP: Duration = Duration::from_millis(350);
const MAX_RETRIES: u32 = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MangaDexSearchItem {
    pub id: String,
    pub title: String,
    pub alternate_titles: Vec<String>,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub content_type: String,
    pub language: Option<String>,
    pub publication_status: Option<String>,
    pub genres: Vec<String>,
    pub author: Option<String>,
    pub website_url: String,
}

fn client() -> &'static reqwest::Client {
    crate::providers::http::client()
}

fn rate_gate() -> &'static Mutex<Instant> {
    static GATE: OnceLock<Mutex<Instant>> = OnceLock::new();
    GATE.get_or_init(|| Mutex::new(Instant::now() - MIN_REQUEST_GAP))
}

async fn throttle() {
    let mut last = rate_gate().lock().await;
    let elapsed = last.elapsed();
    if elapsed < MIN_REQUEST_GAP {
        tokio::time::sleep(MIN_REQUEST_GAP - elapsed).await;
    }
    *last = Instant::now();
}

fn retry_after_delay(response: &reqwest::Response, attempt: u32) -> Duration {
    if let Some(value) = response.headers().get("retry-after").and_then(|v| v.to_str().ok()) {
        if let Ok(secs) = value.parse::<u64>() {
            return Duration::from_secs(secs.clamp(1, 20));
        }
    }
    let exp = 400u64.saturating_mul(1u64 << attempt.min(4));
    Duration::from_millis(exp.clamp(400, 8_000))
}

/// Throttled MangaDex GET with retries on HTTP 429.
async fn api_get(url: String, query: &[(&str, String)]) -> AppResult<reqwest::Response> {
    let client = client();
    let mut last_status = None;

    for attempt in 0..MAX_RETRIES {
        throttle().await;
        let mut req = client.get(&url);
        if !query.is_empty() {
            req = req.query(query);
        }
        let response = req
            .send()
            .await
            .map_err(|e| AppError::Message(format!("MangaDex request failed: {e}")))?;

        if response.status().as_u16() == 429 {
            last_status = Some(response.status());
            let delay = retry_after_delay(&response, attempt);
            // Consume body so the connection can be reused.
            let _ = response.bytes().await;
            tokio::time::sleep(delay).await;
            continue;
        }

        return Ok(response);
    }

    Err(AppError::Message(format!(
        "MangaDex rate limited (HTTP {}) — try again in a moment",
        last_status
            .map(|s| s.to_string())
            .unwrap_or_else(|| "429".into())
    )))
}

fn pick_localized(map: &Value) -> Option<String> {
    let obj = map.as_object()?;
    for key in ["en", "ja-ro", "ja", "ko", "zh", "zh-hk"] {
        if let Some(value) = obj.get(key).and_then(|v| v.as_str()) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    obj.values()
        .find_map(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn content_type_from_attrs(attrs: &Value) -> String {
    // MangaDex uses originalLanguage as a weak signal; keep conservative labels.
    match attrs
        .get("originalLanguage")
        .and_then(|v| v.as_str())
        .unwrap_or("")
    {
        "ko" => "manhwa".into(),
        "zh" | "zh-hk" => "comic".into(),
        _ => "manga".into(),
    }
}

fn parse_manga_item(item: &Value) -> Option<MangaDexSearchItem> {
    let id = item.get("id")?.as_str()?.to_string();
    let attrs = item.get("attributes")?;
    let title = pick_localized(attrs.get("title")?)?;

    let mut alternate_titles = Vec::new();
    if let Some(alts) = attrs.get("altTitles").and_then(|v| v.as_array()) {
        for alt in alts {
            if let Some(value) = pick_localized(alt) {
                if value != title && !alternate_titles.contains(&value) {
                    alternate_titles.push(value);
                }
            }
        }
    }

    let description = attrs
        .get("description")
        .and_then(pick_localized)
        .filter(|s| !s.is_empty());

    let publication_status = attrs
        .get("status")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let language = attrs
        .get("originalLanguage")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut genres = Vec::new();
    if let Some(tags) = attrs.get("tags").and_then(|v| v.as_array()) {
        for tag in tags {
            if let Some(name) = tag
                .pointer("/attributes/name")
                .and_then(pick_localized)
            {
                if !genres.contains(&name) {
                    genres.push(name);
                }
            }
        }
    }

    let relationships = item.get("relationships").and_then(|v| v.as_array());
    let mut cover_url = None;
    let mut author = None;
    if let Some(rels) = relationships {
        for rel in rels {
            let rel_type = rel.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if rel_type == "cover_art" {
                if let Some(file_name) = rel
                    .pointer("/attributes/fileName")
                    .and_then(|v| v.as_str())
                {
                    // Use the documented thumbnail variant; images are fetched via our proxy command.
                    cover_url = Some(format!(
                        "https://uploads.mangadex.org/covers/{id}/{file_name}.256.jpg"
                    ));
                }
            }
            if rel_type == "author" && author.is_none() {
                author = rel
                    .pointer("/attributes/name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
            }
        }
    }

    Some(MangaDexSearchItem {
        id: id.clone(),
        title,
        alternate_titles,
        description,
        cover_url,
        content_type: content_type_from_attrs(attrs),
        language,
        publication_status,
        genres,
        author,
        website_url: format!("{SITE_BASE}/{id}"),
    })
}

pub async fn search_manga(query: &str, limit: u32) -> AppResult<Vec<MangaDexSearchItem>> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let response = api_get(
        format!("{API_BASE}/manga"),
        &[
            ("title", trimmed.to_string()),
            ("limit", limit.clamp(1, 20).to_string()),
            ("includes[]", "cover_art".into()),
            ("includes[]", "author".into()),
            ("contentRating[]", "safe".into()),
            ("contentRating[]", "suggestive".into()),
            ("contentRating[]", "erotica".into()),
            ("order[relevance]", "desc".into()),
        ],
    )
    .await?;

    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "MangaDex returned HTTP {}",
            response.status()
        )));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|e| AppError::Message(format!("Invalid MangaDex JSON: {e}")))?;

    let data = payload
        .get("data")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::Message("MangaDex response missing data[]".into()))?;

    Ok(data.iter().filter_map(parse_manga_item).collect())
}

pub async fn health_check() -> AppResult<()> {
    let response = api_get(format!("{API_BASE}/ping"), &[]).await?;
    if response.status().is_success() {
        Ok(())
    } else {
        // Older deployments may not expose /ping; fall back to a tiny manga query.
        let fallback = api_get(
            format!("{API_BASE}/manga"),
            &[("limit", "1".into())],
        )
        .await?;
        if fallback.status().is_success() {
            Ok(())
        } else {
            Err(AppError::Message(format!(
                "MangaDex health check failed: HTTP {}",
                fallback.status()
            )))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MangaDexTitleDetails {
    pub id: String,
    pub title: String,
    pub alternate_titles: Vec<String>,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub content_type: String,
    pub publication_status: Option<String>,
    pub genres: Vec<String>,
    pub tags: Vec<String>,
    pub author: Option<String>,
    pub artist: Option<String>,
    pub website_url: String,
    pub is_adult: bool,
    pub chapter_count: u32,
    pub rating: Option<f64>,
    pub release_year: Option<i32>,
    pub latest_chapter_title: Option<String>,
    pub provider_id: String,
    pub provider_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MangaDexChapter {
    pub id: String,
    pub manga_id: String,
    pub title: String,
    pub number: Option<f64>,
    pub page_count: u32,
    pub scanlator: Option<String>,
    pub sort_index: u32,
    pub created_at: Option<String>,
    pub website_url: String,
}

fn parse_title_details(item: &Value) -> Option<MangaDexTitleDetails> {
    let parsed = parse_manga_item(item)?;
    let attrs = item.get("attributes")?;

    let mut tags = Vec::new();
    if let Some(list) = attrs.get("tags").and_then(|v| v.as_array()) {
        for tag in list {
            let group = tag
                .pointer("/attributes/group")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if group == "genre" {
                continue;
            }
            if let Some(name) = tag
                .pointer("/attributes/name")
                .and_then(pick_localized)
            {
                if !tags.contains(&name) {
                    tags.push(name);
                }
            }
        }
    }

    let mut artist = None;
    if let Some(rels) = item.get("relationships").and_then(|v| v.as_array()) {
        for rel in rels {
            if rel.get("type").and_then(|v| v.as_str()) == Some("artist") {
                artist = rel
                    .pointer("/attributes/name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                break;
            }
        }
    }

    let release_year = attrs.get("year").and_then(|v| v.as_i64()).map(|y| y as i32);
    let is_adult = matches!(
        attrs.get("contentRating").and_then(|v| v.as_str()).unwrap_or(""),
        "erotica" | "pornographic"
    );

    Some(MangaDexTitleDetails {
        id: parsed.id,
        title: parsed.title,
        alternate_titles: parsed.alternate_titles,
        description: parsed.description,
        cover_url: parsed.cover_url,
        content_type: parsed.content_type,
        publication_status: parsed.publication_status,
        genres: parsed.genres,
        tags,
        author: parsed.author,
        artist,
        website_url: parsed.website_url,
        is_adult,
        chapter_count: 0,
        rating: None,
        release_year,
        latest_chapter_title: None,
        provider_id: "mangadex".into(),
        provider_name: "MangaDex".into(),
    })
}

pub async fn title_details(manga_id: &str) -> AppResult<MangaDexTitleDetails> {
    let id = manga_id.trim();
    if id.is_empty() {
        return Err(AppError::Message("Missing MangaDex manga id".into()));
    }

    let response = api_get(
        format!("{API_BASE}/manga/{id}"),
        &[
            ("includes[]", "cover_art".into()),
            ("includes[]", "author".into()),
            ("includes[]", "artist".into()),
        ],
    )
    .await?;

    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "MangaDex detail HTTP {}",
            response.status()
        )));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|e| AppError::Message(format!("Invalid MangaDex detail JSON: {e}")))?;

    let data = payload
        .get("data")
        .ok_or_else(|| AppError::Message("MangaDex detail missing data".into()))?;

    parse_title_details(data)
        .ok_or_else(|| AppError::Message("Failed to parse MangaDex title".into()))
}

pub async fn list_chapters(manga_id: &str) -> AppResult<Vec<MangaDexChapter>> {
    let id = manga_id.trim();
    if id.is_empty() {
        return Err(AppError::Message("Missing MangaDex manga id".into()));
    }

    let mut offset = 0u32;
    let mut out = Vec::new();
    let page_limit = 100u32;

    // Paginate feed; cap to keep UI responsive.
    for _ in 0..5 {
        let response = api_get(
            format!("{API_BASE}/manga/{id}/feed"),
            &[
                ("limit", page_limit.to_string()),
                ("offset", offset.to_string()),
                ("translatedLanguage[]", "en".into()),
                ("order[chapter]", "asc".into()),
                ("includes[]", "scanlation_group".into()),
                ("contentRating[]", "safe".into()),
                ("contentRating[]", "suggestive".into()),
                ("contentRating[]", "erotica".into()),
            ],
        )
        .await?;

        if !response.status().is_success() {
            return Err(AppError::Message(format!(
                "MangaDex chapters HTTP {}",
                response.status()
            )));
        }

        let payload: Value = response
            .json()
            .await
            .map_err(|e| AppError::Message(format!("Invalid MangaDex chapters JSON: {e}")))?;

        let data = payload
            .get("data")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        if data.is_empty() {
            break;
        }

        for (index, item) in data.iter().enumerate() {
            let chapter_id = match item.get("id").and_then(|v| v.as_str()) {
                Some(v) => v.to_string(),
                None => continue,
            };
            let attrs = item.get("attributes").cloned().unwrap_or(Value::Null);
            let number = attrs
                .get("chapter")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .or_else(|| attrs.get("chapter").and_then(|v| v.as_f64()));
            let title_attr = attrs
                .get("title")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());
            let title = title_attr.unwrap_or_else(|| {
                number
                    .map(|n| format!("Chapter {n}"))
                    .unwrap_or_else(|| "Chapter".into())
            });
            let page_count = attrs.get("pages").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let created_at = attrs
                .get("publishAt")
                .or_else(|| attrs.get("createdAt"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let mut scanlator = None;
            if let Some(rels) = item.get("relationships").and_then(|v| v.as_array()) {
                for rel in rels {
                    if rel.get("type").and_then(|v| v.as_str()) == Some("scanlation_group") {
                        scanlator = rel
                            .pointer("/attributes/name")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        break;
                    }
                }
            }

            out.push(MangaDexChapter {
                id: chapter_id.clone(),
                manga_id: id.to_string(),
                title,
                number,
                page_count,
                scanlator,
                sort_index: offset + index as u32,
                created_at,
                website_url: format!("https://mangadex.org/chapter/{chapter_id}"),
            });
        }

        let total = payload
            .get("total")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32;
        offset += page_limit;
        if offset >= total || data.len() < page_limit as usize {
            break;
        }
    }

    Ok(out)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MangaDexChapterPages {
    pub manga_id: String,
    pub chapter_id: String,
    pub title: String,
    pub pages: Vec<String>,
}

/// Resolve in-app page image URLs via the official MangaDex at-home API.
pub async fn chapter_pages(manga_id: &str, chapter_id: &str) -> AppResult<MangaDexChapterPages> {
    let manga_id = manga_id.trim();
    let chapter_id = chapter_id.trim();
    if manga_id.is_empty() || chapter_id.is_empty() {
        return Err(AppError::Message("Missing MangaDex manga/chapter id".into()));
    }

    let response = api_get(
        format!("{API_BASE}/at-home/server/{chapter_id}"),
        &[],
    )
    .await?;

    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "MangaDex at-home HTTP {}",
            response.status()
        )));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|e| AppError::Message(format!("Invalid MangaDex at-home JSON: {e}")))?;

    let base_url = payload
        .get("baseUrl")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Message("MangaDex at-home missing baseUrl".into()))?
        .trim_end_matches('/');

    let chapter = payload
        .get("chapter")
        .ok_or_else(|| AppError::Message("MangaDex at-home missing chapter".into()))?;
    let hash = chapter
        .get("hash")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Message("MangaDex at-home missing hash".into()))?;

    // Prefer full quality (`data`); fall back to data-saver.
    let files = chapter
        .get("data")
        .and_then(|v| v.as_array())
        .filter(|arr| !arr.is_empty())
        .or_else(|| chapter.get("dataSaver").and_then(|v| v.as_array()))
        .ok_or_else(|| AppError::Message("MangaDex at-home missing page list".into()))?;

    let quality_path = if chapter
        .get("data")
        .and_then(|v| v.as_array())
        .map(|arr| !arr.is_empty())
        .unwrap_or(false)
    {
        "data"
    } else {
        "data-saver"
    };

    let pages: Vec<String> = files
        .iter()
        .filter_map(|v| v.as_str())
        .map(|file| format!("{base_url}/{quality_path}/{hash}/{file}"))
        .collect();

    if pages.is_empty() {
        return Err(AppError::Message("MangaDex chapter has no pages".into()));
    }

    Ok(MangaDexChapterPages {
        manga_id: manga_id.to_string(),
        chapter_id: chapter_id.to_string(),
        title: "Chapter".into(),
        pages,
    })
}

/// Proxy a MangaDex cover thumbnail. Restricted to uploads.mangadex.org/covers/.
pub async fn fetch_cover_bytes(cover_url: &str) -> AppResult<Vec<u8>> {
    let parsed = reqwest::Url::parse(cover_url)
        .map_err(|e| AppError::Message(format!("Invalid cover URL: {e}")))?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("uploads.mangadex.org")
        || !parsed.path().starts_with("/covers/")
    {
        return Err(AppError::Message(
            "Cover proxy only allows https://uploads.mangadex.org/covers/".into(),
        ));
    }

    let client = client();
    let response = client
        .get(parsed)
        .send()
        .await
        .map_err(|e| AppError::Message(format!("Cover fetch failed: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "Cover fetch HTTP {}",
            response.status()
        )));
    }
    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| AppError::Message(format!("Cover body error: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_manga_item_from_documented_shape() {
        let item = json!({
            "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "type": "manga",
            "attributes": {
                "title": { "en": "Example Manga" },
                "altTitles": [{ "ja": "例" }],
                "description": { "en": "A documented sample." },
                "status": "ongoing",
                "originalLanguage": "ja",
                "tags": [
                    { "attributes": { "name": { "en": "Action" } } }
                ]
            },
            "relationships": [
                {
                    "type": "cover_art",
                    "attributes": { "fileName": "cover-file.jpg" }
                },
                {
                    "type": "author",
                    "attributes": { "name": "Sample Author" }
                }
            ]
        });

        let parsed = parse_manga_item(&item).expect("parse");
        assert_eq!(parsed.title, "Example Manga");
        assert_eq!(parsed.alternate_titles, vec!["例"]);
        assert_eq!(parsed.author.as_deref(), Some("Sample Author"));
        assert!(parsed
            .cover_url
            .as_ref()
            .unwrap()
            .contains("/covers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/cover-file.jpg.256.jpg"));
        assert!(parsed.website_url.contains(&parsed.id));
    }
}
