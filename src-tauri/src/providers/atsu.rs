use chrono::Datelike;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{AppError, AppResult};

const SITE_BASE: &str = "https://atsu.moe";
const CDN_BASE: &str = "https://cdn.atsu.moe";
const USER_AGENT: &str = "FYODOR/0.1.0 (desktop; personal manga library; +https://atsu.moe)";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtsuSearchItem {
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
    pub is_adult: bool,
}

fn client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| AppError::Message(e.to_string()))
}

fn absolute_image(path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_string();
    }
    let clean = path.trim_start_matches('/');
    let with_static = if clean.starts_with("static/") {
        clean.to_string()
    } else {
        format!("static/{clean}")
    };
    format!("{CDN_BASE}/{with_static}")
}

fn content_type_from(value: &str) -> String {
    match value.to_ascii_lowercase().as_str() {
        "manhwa" | "manwha" => "manhwa".into(),
        "manhua" | "oel" | "comic" => "comic".into(),
        _ => "manga".into(),
    }
}

fn parse_hit_document(doc: &Value) -> Option<AtsuSearchItem> {
    let id = doc.get("id")?.as_str()?.to_string();
    let title = doc
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_string();

    let cover_url = ["posterMedium", "posterSmall", "poster"]
        .iter()
        .find_map(|key| {
            doc.get(*key)
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(absolute_image)
        });

    let publication_status = doc
        .get("status")
        .and_then(|v| v.as_str())
        .map(|s| s.to_ascii_lowercase());

    let content_type = content_type_from(doc.get("type").and_then(|v| v.as_str()).unwrap_or(""));

    let is_adult = doc.get("isAdult").and_then(|v| v.as_bool()).unwrap_or(false);

    Some(AtsuSearchItem {
        id: id.clone(),
        title,
        alternate_titles: Vec::new(),
        description: None,
        cover_url,
        content_type,
        language: None,
        publication_status,
        genres: Vec::new(),
        author: None,
        website_url: format!("{SITE_BASE}/manga/{id}"),
        is_adult,
    })
}

pub async fn search_manga(query: &str, limit: u32) -> AppResult<Vec<AtsuSearchItem>> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let per_page = limit.clamp(1, 24);
    let client = client()?;
    let response = client
        .get(format!("{SITE_BASE}/collections/manga/documents/search"))
        .query(&[
            ("q", trimmed),
            ("query_by", "title,englishTitle,otherNames,authors,acronyms"),
            ("page", "1"),
            ("per_page", &per_page.to_string()),
            (
                "include_fields",
                "id,title,poster,posterMedium,posterSmall,type,isAdult,status,mbRating,popularity",
            ),
            ("filter_by", "views:>0 && hidden:!=true"),
            ("sort_by", "views:desc"),
        ])
        .header("Referer", SITE_BASE)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| AppError::Message(format!("Atsu search failed: {e}")))?;

    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "Atsu search returned HTTP {}",
            response.status()
        )));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|e| AppError::Message(format!("Invalid Atsu JSON: {e}")))?;

    let hits = payload
        .get("hits")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::Message("Atsu response missing hits[]".into()))?;

    Ok(hits
        .iter()
        .filter_map(|hit| hit.get("document").and_then(parse_hit_document))
        .collect())
}

pub async fn health_check() -> AppResult<()> {
    let client = client()?;
    let response = client
        .get(format!("{SITE_BASE}/api"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| AppError::Message(format!("Atsu unreachable: {e}")))?;

    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "Atsu health HTTP {}",
            response.status()
        )));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|e| AppError::Message(format!("Invalid Atsu health JSON: {e}")))?;

    if payload.get("ok").and_then(|v| v.as_bool()) == Some(true) {
        Ok(())
    } else {
        Err(AppError::Message("Atsu health reported not ok".into()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtsuTitleDetails {
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
pub struct AtsuChapter {
    pub id: String,
    pub manga_id: String,
    pub title: String,
    pub number: Option<f64>,
    pub page_count: u32,
    pub scanlator: Option<String>,
    pub sort_index: u32,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtsuChapterPages {
    pub manga_id: String,
    pub chapter_id: String,
    pub title: String,
    pub pages: Vec<String>,
}

async fn fetch_json(path_and_query: &str) -> AppResult<Value> {
    let client = client()?;
    let url = if path_and_query.starts_with("http") {
        path_and_query.to_string()
    } else {
        format!("{SITE_BASE}{path_and_query}")
    };
    let response = client
        .get(&url)
        .header("Referer", SITE_BASE)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| AppError::Message(format!("Atsu request failed: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "Atsu returned HTTP {} for {url}",
            response.status()
        )));
    }
    response
        .json()
        .await
        .map_err(|e| AppError::Message(format!("Invalid Atsu JSON: {e}")))
}

fn parse_title_details(page: &Value) -> Option<AtsuTitleDetails> {
    let id = page.get("id")?.as_str()?.to_string();
    let title = page
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?
        .to_string();

    let mut alternate_titles = Vec::new();
    if let Some(english) = page
        .get("englishTitle")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        if english != title {
            alternate_titles.push(english.to_string());
        }
    }
    if let Some(others) = page.get("otherNames").and_then(|v| v.as_array()) {
        for name in others {
            if let Some(value) = name.as_str().map(str::trim).filter(|s| !s.is_empty()) {
                if value != title && !alternate_titles.iter().any(|t| t == value) {
                    alternate_titles.push(value.to_string());
                }
            }
        }
    }

    let cover_url = page
        .pointer("/poster/image")
        .or_else(|| page.pointer("/poster/smallImage"))
        .and_then(|v| v.as_str())
        .map(absolute_image);

    let mut authors = Vec::new();
    let mut artists = Vec::new();
    if let Some(list) = page.get("authors").and_then(|v| v.as_array()) {
        for person in list {
            let name = person
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            if name.is_empty() {
                continue;
            }
            match person.get("type").and_then(|v| v.as_str()).unwrap_or("") {
                "Artist" => artists.push(name.to_string()),
                _ => authors.push(name.to_string()),
            }
        }
    }

    let genres = page
        .get("genres")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|g| g.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let chapter_count = page
        .get("totalChapterCount")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    let tags = page
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .take(24)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let rating = page.get("avgRating").and_then(|v| v.as_f64());
    let release_year = page
        .get("released")
        .and_then(|v| v.as_i64())
        .and_then(|ms| chrono::DateTime::from_timestamp_millis(ms))
        .map(|dt| dt.year());

    let latest_chapter_title = page
        .get("chapters")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|ch| ch.get("title").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

    Some(AtsuTitleDetails {
        id: id.clone(),
        title,
        alternate_titles,
        description: page
            .get("synopsis")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
        cover_url,
        content_type: content_type_from(page.get("type").and_then(|v| v.as_str()).unwrap_or("")),
        publication_status: page
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| s.to_ascii_lowercase()),
        genres,
        tags,
        author: (!authors.is_empty()).then(|| authors.join(", ")),
        artist: (!artists.is_empty()).then(|| artists.join(", ")),
        website_url: format!("{SITE_BASE}/manga/{id}"),
        is_adult: page.get("isAdult").and_then(|v| v.as_bool()).unwrap_or(false),
        chapter_count,
        rating,
        release_year,
        latest_chapter_title,
        provider_id: "atsu".into(),
        provider_name: "Atsumaru".into(),
    })
}

fn preferred_scanlation_id(page: &Value) -> Option<String> {
    let scanlators = page.get("scanlators")?.as_array()?;
    scanlators
        .iter()
        .max_by_key(|s| {
            s.get("score")
                .and_then(|v| v.as_i64())
                .unwrap_or(i64::MIN)
        })
        .and_then(|s| s.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
}

fn scanlator_name_map(page: &Value) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    if let Some(scanlators) = page.get("scanlators").and_then(|v| v.as_array()) {
        for s in scanlators {
            if let (Some(id), Some(name)) = (
                s.get("id").and_then(|v| v.as_str()),
                s.get("name").and_then(|v| v.as_str()),
            ) {
                map.insert(id.to_string(), name.to_string());
            }
        }
    }
    map
}

pub async fn title_details(manga_id: &str) -> AppResult<AtsuTitleDetails> {
    let id = manga_id.trim();
    if id.is_empty() {
        return Err(AppError::Message("Missing Atsu manga id".into()));
    }
    let payload = fetch_json(&format!("/api/manga/page?id={id}")).await?;
    let page = payload
        .get("mangaPage")
        .ok_or_else(|| AppError::Message("Atsu detail missing mangaPage".into()))?;
    parse_title_details(page).ok_or_else(|| AppError::Message("Failed to parse Atsu title".into()))
}

pub async fn list_chapters(manga_id: &str) -> AppResult<Vec<AtsuChapter>> {
    let id = manga_id.trim();
    if id.is_empty() {
        return Err(AppError::Message("Missing Atsu manga id".into()));
    }

    let detail = fetch_json(&format!("/api/manga/page?id={id}")).await?;
    let page = detail.get("mangaPage").cloned().unwrap_or(Value::Null);
    let preferred = preferred_scanlation_id(&page);
    let names = scanlator_name_map(&page);

    let payload = fetch_json(&format!("/api/manga/allChapters?mangaId={id}")).await?;
    let raw = payload
        .get("chapters")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut chapters: Vec<AtsuChapter> = raw
        .iter()
        .filter_map(|ch| {
            let chapter_id = ch.get("id")?.as_str()?.to_string();
            let scanlation_id = ch
                .get("scanlationMangaId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if let (Some(pref), Some(sid)) = (preferred.as_ref(), scanlation_id.as_ref()) {
                if sid != pref {
                    return None;
                }
            }
            let number = ch.get("number").and_then(|v| v.as_f64());
            let title = ch
                .get("title")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    number
                        .map(|n| format!("Chapter {n}"))
                        .unwrap_or_else(|| "Chapter".into())
                });
            let page_count = ch.get("pageCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let sort_index = ch.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let scanlator = scanlation_id
                .as_ref()
                .and_then(|sid| names.get(sid).cloned());
            let created_at = ch
                .get("createdAt")
                .and_then(|v| v.as_i64())
                .and_then(|ms| chrono::DateTime::from_timestamp_millis(ms))
                .map(|dt| dt.to_rfc3339());
            Some(AtsuChapter {
                id: chapter_id,
                manga_id: id.to_string(),
                title,
                number,
                page_count,
                scanlator,
                sort_index,
                created_at,
            })
        })
        .collect();

    // If preferred filter removed everything (id mismatch), fall back to all chapters.
    if chapters.is_empty() && !raw.is_empty() {
        chapters = raw
            .iter()
            .filter_map(|ch| {
                let chapter_id = ch.get("id")?.as_str()?.to_string();
                let number = ch.get("number").and_then(|v| v.as_f64());
                let title = ch
                    .get("title")
                    .and_then(|v| v.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| {
                        number
                            .map(|n| format!("Chapter {n}"))
                            .unwrap_or_else(|| "Chapter".into())
                    });
                let scanlation_id = ch
                    .get("scanlationMangaId")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let created_at = ch
                    .get("createdAt")
                    .and_then(|v| v.as_i64())
                    .and_then(|ms| chrono::DateTime::from_timestamp_millis(ms))
                    .map(|dt| dt.to_rfc3339());
                Some(AtsuChapter {
                    id: chapter_id,
                    manga_id: id.to_string(),
                    title,
                    number,
                    page_count: ch.get("pageCount").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    scanlator: scanlation_id.and_then(|sid| names.get(&sid).cloned()),
                    sort_index: ch.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    created_at,
                })
            })
            .collect();
    }

    chapters.sort_by(|a, b| {
        match (a.number, b.number) {
            (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(std::cmp::Ordering::Equal),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.sort_index.cmp(&b.sort_index),
        }
    });

    Ok(chapters)
}

pub async fn chapter_pages(manga_id: &str, chapter_id: &str) -> AppResult<AtsuChapterPages> {
    let manga_id = manga_id.trim();
    let chapter_id = chapter_id.trim();
    if manga_id.is_empty() || chapter_id.is_empty() {
        return Err(AppError::Message("Missing Atsu manga/chapter id".into()));
    }

    let payload = fetch_json(&format!(
        "/api/read/chapter?mangaId={manga_id}&chapterId={chapter_id}"
    ))
    .await?;
    let read = payload
        .get("readChapter")
        .ok_or_else(|| AppError::Message("Atsu read payload missing readChapter".into()))?;

    let title = read
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Chapter")
        .to_string();

    let pages = read
        .get("pages")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|p| p.get("image").and_then(|v| v.as_str()).map(absolute_image))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if pages.is_empty() {
        return Err(AppError::Message("Atsu chapter has no pages".into()));
    }

    Ok(AtsuChapterPages {
        manga_id: manga_id.to_string(),
        chapter_id: chapter_id.to_string(),
        title,
        pages,
    })
}

/// Proxy an Atsu CDN asset (covers + chapter pages under /static/).
/// Cloudflare on cdn.atsu.moe rejects bare webview requests; Referer is required.
pub async fn fetch_cdn_bytes(cdn_url: &str) -> AppResult<Vec<u8>> {
    let parsed = reqwest::Url::parse(cdn_url)
        .map_err(|e| AppError::Message(format!("Invalid Atsu CDN URL: {e}")))?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("cdn.atsu.moe")
        || !parsed.path().starts_with("/static/")
    {
        return Err(AppError::Message(
            "Atsu CDN proxy only allows https://cdn.atsu.moe/static/".into(),
        ));
    }

    let client = client()?;
    let response = client
        .get(parsed)
        .header("Referer", SITE_BASE)
        .header("Origin", SITE_BASE)
        .header(
            "Accept",
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        )
        .send()
        .await
        .map_err(|e| AppError::Message(format!("Atsu CDN fetch failed: {e}")))?;
    if !response.status().is_success() {
        return Err(AppError::Message(format!(
            "Atsu CDN HTTP {} (Cloudflare may be blocking this network)",
            response.status()
        )));
    }
    let bytes = response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| AppError::Message(format!("Atsu CDN body error: {e}")))?;
    // Cloudflare challenge HTML sometimes slips through as 200; reject non-images.
    if bytes.len() >= 15 {
        let head = String::from_utf8_lossy(&bytes[..15.min(bytes.len())]).to_ascii_lowercase();
        if head.contains("<!doctype") || head.contains("<html") {
            return Err(AppError::Message(
                "Atsu CDN returned a Cloudflare challenge instead of an image".into(),
            ));
        }
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_search_hit_document() {
        let doc = json!({
            "id": "CM0wz",
            "title": "BERSERK",
            "poster": "/static/posters/example.jpg",
            "posterMedium": "/static/posters/example-medium.avif",
            "type": "Manga",
            "status": "Ongoing",
            "isAdult": false
        });
        let parsed = parse_hit_document(&doc).expect("parse");
        assert_eq!(parsed.title, "BERSERK");
        assert_eq!(parsed.content_type, "manga");
        assert_eq!(
            parsed.cover_url.as_deref(),
            Some("https://cdn.atsu.moe/static/posters/example-medium.avif")
        );
        assert_eq!(parsed.website_url, "https://atsu.moe/manga/CM0wz");
        assert!(!parsed.is_adult);
    }

    #[test]
    fn absolute_image_normalizes_relative_paths() {
        assert_eq!(
            absolute_image("posters/x.png"),
            "https://cdn.atsu.moe/static/posters/x.png"
        );
        assert_eq!(
            absolute_image("/static/posters/x.png"),
            "https://cdn.atsu.moe/static/posters/x.png"
        );
    }

    #[test]
    fn parses_title_details_shape() {
        let page = json!({
            "id": "CM0wz",
            "title": "BERSERK",
            "englishTitle": "Berserk",
            "otherNames": ["ベルセルク"],
            "synopsis": "Dark fantasy.",
            "type": "Manga",
            "status": "Ongoing",
            "isAdult": false,
            "totalChapterCount": 386,
            "poster": { "image": "posters/x.png" },
            "authors": [
                { "name": "Kentaro Miura", "type": "Author" },
                { "name": "Studio", "type": "Artist" }
            ],
            "genres": [{ "name": "Action" }],
            "scanlators": [{ "id": "g1", "name": "Gamma", "score": 9 }]
        });
        let parsed = parse_title_details(&page).expect("parse");
        assert_eq!(parsed.title, "BERSERK");
        assert_eq!(parsed.author.as_deref(), Some("Kentaro Miura"));
        assert_eq!(parsed.artist.as_deref(), Some("Studio"));
        assert_eq!(parsed.chapter_count, 386);
        assert_eq!(parsed.provider_id, "atsu");
        assert_eq!(
            parsed.cover_url.as_deref(),
            Some("https://cdn.atsu.moe/static/posters/x.png")
        );
        assert_eq!(preferred_scanlation_id(&page).as_deref(), Some("g1"));
    }
}
