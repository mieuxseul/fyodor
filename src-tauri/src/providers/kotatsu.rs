use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};

static BRIDGE: OnceLock<Mutex<Option<Bridge>>> = OnceLock::new();

struct Bridge {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<std::process::ChildStdout>,
    next_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KotatsuSource {
    pub name: String,
    pub title: String,
    pub locale: String,
    pub content_type: String,
    pub broken: bool,
    pub domain: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KotatsuSearchItem {
    pub source: String,
    pub manga_id: i64,
    pub title: String,
    pub alt_titles: Vec<String>,
    pub url: String,
    pub public_url: String,
    pub cover_url: Option<String>,
    pub description: Option<String>,
    pub state: Option<String>,
    pub is_adult: bool,
    pub authors: Vec<String>,
    pub genres: Vec<String>,
    pub chapter_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KotatsuChapter {
    pub id: String,
    pub url: String,
    pub title: String,
    pub number: Option<f64>,
    pub scanlator: Option<String>,
    pub branch: Option<String>,
    pub sort_index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KotatsuPages {
    pub source: String,
    pub chapter_url: String,
    pub pages: Vec<String>,
}

fn bridge_slot() -> &'static Mutex<Option<Bridge>> {
    BRIDGE.get_or_init(|| Mutex::new(None))
}

fn find_java() -> AppResult<PathBuf> {
    if let Ok(home) = std::env::var("JAVA_HOME") {
        let candidate = PathBuf::from(home).join("bin").join(if cfg!(windows) {
            "java.exe"
        } else {
            "java"
        });
        if candidate.is_file() {
            return Ok(candidate);
        }
    }
    for key in ["LOCALAPPDATA", "USERPROFILE"] {
        if let Ok(base) = std::env::var(key) {
            for rel in ["jdk-17\\bin\\java.exe", "jdk-21\\bin\\java.exe"] {
                let candidate = PathBuf::from(&base).join(rel);
                if candidate.is_file() {
                    return Ok(candidate);
                }
            }
        }
    }
    Ok(PathBuf::from(if cfg!(windows) { "java.exe" } else { "java" }))
}

fn find_jar() -> AppResult<PathBuf> {
    if let Ok(path) = std::env::var("FYODOR_KOTATSU_BRIDGE") {
        let p = PathBuf::from(path);
        if p.is_file() {
            return Ok(p);
        }
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest.join("../sidecars/bin/kotatsu-bridge.jar"),
        manifest.join("../sidecars/kotatsu-bridge/build/libs/kotatsu-bridge.jar"),
    ];
    for c in candidates {
        if c.is_file() {
            return Ok(c);
        }
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let p = PathBuf::from(local).join("FYODOR").join("kotatsu-bridge.jar");
        if p.is_file() {
            return Ok(p);
        }
    }
    Err(AppError::from(
        "Kotatsu bridge JAR not found. Build sidecars/kotatsu-bridge (shadowJar) or set FYODOR_KOTATSU_BRIDGE.",
    ))
}

fn spawn_bridge() -> AppResult<Bridge> {
    let java = find_java()?;
    let jar = find_jar()?;
    let mut cmd = Command::new(&java);
    cmd.arg("-jar")
        .arg(&jar)
        .arg("serve")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    // Hide the JDK console window on Windows (java.exe is a console subsystem binary).
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::from(format!("Failed to start Kotatsu bridge ({java:?}): {e}")))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::from("Kotatsu bridge stdin missing"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::from("Kotatsu bridge stdout missing"))?;
    Ok(Bridge {
        child,
        stdin,
        stdout: BufReader::new(stdout),
        next_id: 1,
    })
}

fn with_bridge<T>(f: impl FnOnce(&mut Bridge) -> AppResult<T>) -> AppResult<T> {
    let slot = bridge_slot();
    let mut guard = slot
        .lock()
        .map_err(|_| AppError::from("Kotatsu bridge lock poisoned"))?;
    if guard.is_none() {
        *guard = Some(spawn_bridge()?);
    }
    match f(guard.as_mut().unwrap()) {
        Ok(v) => Ok(v),
        Err(e) => {
            // Drop broken process so next call respawns.
            if let Some(mut b) = guard.take() {
                let _ = b.child.kill();
            }
            Err(e)
        }
    }
}

fn request(bridge: &mut Bridge, mut body: Value) -> AppResult<Value> {
    let id = bridge.next_id;
    bridge.next_id += 1;
    body.as_object_mut()
        .ok_or_else(|| AppError::from("invalid request"))?
        .insert("id".into(), json!(id));
    let line = body.to_string();
    writeln!(bridge.stdin, "{line}")
        .map_err(|e| AppError::from(format!("Kotatsu bridge write failed: {e}")))?;
    bridge
        .stdin
        .flush()
        .map_err(|e| AppError::from(format!("Kotatsu bridge flush failed: {e}")))?;

    let mut response_line = String::new();
    bridge
        .stdout
        .read_line(&mut response_line)
        .map_err(|e| AppError::from(format!("Kotatsu bridge read failed: {e}")))?;
    if response_line.is_empty() {
        return Err(AppError::from("Kotatsu bridge closed unexpectedly"));
    }
    let value: Value = serde_json::from_str(response_line.trim())
        .map_err(|e| AppError::from(format!("Kotatsu bridge JSON error: {e}")))?;
    if value.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let err = value
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Kotatsu bridge error");
        return Err(AppError::from(err.to_string()));
    }
    Ok(value)
}

pub fn health_check() -> AppResult<()> {
    with_bridge(|b| {
        let _ = request(b, json!({"op": "ping"}))?;
        Ok(())
    })
}

pub fn list_sources() -> AppResult<Vec<KotatsuSource>> {
    with_bridge(|b| {
        let value = request(b, json!({"op": "list_sources"}))?;
        let sources = value
            .get("sources")
            .cloned()
            .unwrap_or(Value::Array(vec![]));
        serde_json::from_value(sources)
            .map_err(|e| AppError::from(format!("parse sources: {e}")))
    })
}

pub fn search(source: &str, query: &str, limit: u32) -> AppResult<Vec<KotatsuSearchItem>> {
    with_bridge(|b| {
        let value = request(
            b,
            json!({
                "op": "search",
                "source": source,
                "query": query,
                "limit": limit,
            }),
        )?;
        let results = value
            .get("results")
            .cloned()
            .unwrap_or(Value::Array(vec![]));
        serde_json::from_value(results).map_err(|e| AppError::from(format!("parse search: {e}")))
    })
}

/// Search many sources in one bridge round-trip (parallel on the JVM side).
pub fn search_many(
    sources: &[String],
    query: &str,
    limit: u32,
    timeout_ms: u64,
) -> AppResult<(Vec<KotatsuSearchItem>, Vec<String>)> {
    with_bridge(|b| {
        let value = request(
            b,
            json!({
                "op": "search_many",
                "sources": sources,
                "query": query,
                "limit": limit,
                "timeoutMs": timeout_ms,
            }),
        )?;
        let results = value
            .get("results")
            .cloned()
            .unwrap_or(Value::Array(vec![]));
        let errors = value
            .get("errors")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect::<Vec<_>>();
        let parsed: Vec<KotatsuSearchItem> = serde_json::from_value(results)
            .map_err(|e| AppError::from(format!("parse search_many: {e}")))?;
        Ok((parsed, errors))
    })
}

pub fn details(source: &str, url: &str, title: Option<String>) -> AppResult<Value> {
    with_bridge(|b| {
        let mut body = json!({
            "op": "details",
            "source": source,
            "url": url,
        });
        if let Some(t) = title {
            body["title"] = json!(t);
        }
        let value = request(b, body)?;
        Ok(value
            .get("details")
            .cloned()
            .unwrap_or(Value::Null))
    })
}

pub fn chapters(source: &str, url: &str, title: Option<String>) -> AppResult<Vec<KotatsuChapter>> {
    with_bridge(|b| {
        let mut body = json!({
            "op": "chapters",
            "source": source,
            "url": url,
        });
        if let Some(t) = title {
            body["title"] = json!(t);
        }
        let value = request(b, body)?;
        let chapters = value
            .get("chapters")
            .cloned()
            .unwrap_or(Value::Array(vec![]));
        serde_json::from_value(chapters)
            .map_err(|e| AppError::from(format!("parse chapters: {e}")))
    })
}

pub fn pages(source: &str, chapter_url: &str, chapter_id: Option<String>) -> AppResult<KotatsuPages> {
    with_bridge(|b| {
        let mut body = json!({
            "op": "pages",
            "source": source,
            "chapterUrl": chapter_url,
        });
        if let Some(id) = chapter_id {
            if let Ok(n) = id.parse::<i64>() {
                body["chapterId"] = json!(n);
            }
        }
        let value = request(b, body)?;
        let pages = value
            .get("pages")
            .and_then(|p| p.as_array())
            .cloned()
            .unwrap_or_default();
        let urls: Vec<String> = pages
            .into_iter()
            .filter_map(|p| {
                p.get("imageUrl")
                    .and_then(|u| u.as_str())
                    .map(|s| s.to_string())
            })
            .collect();
        Ok(KotatsuPages {
            source: source.to_string(),
            chapter_url: chapter_url.to_string(),
            pages: urls,
        })
    })
}

pub fn jar_path_hint() -> String {
    find_jar()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|e| e.to_string())
}

#[allow(dead_code)]
pub fn exists_jar(path: &Path) -> bool {
    path.is_file()
}
