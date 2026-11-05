use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};

static BRIDGE: OnceLock<Mutex<Option<Bridge>>> = OnceLock::new();
static SOURCES_CACHE: OnceLock<Mutex<Option<Vec<KotatsuSource>>>> = OnceLock::new();
/// Resolved at app startup from the packaged resource dir (release installs).
static PACKAGED_JAR: OnceLock<PathBuf> = OnceLock::new();
/// Bundled portable JRE (release installs) — users should not need a system JDK.
static PACKAGED_JAVA: OnceLock<PathBuf> = OnceLock::new();

struct Bridge {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<std::process::ChildStdout>,
    stderr: BufReader<std::process::ChildStderr>,
    next_id: u64,
}

const USER_BRIDGE_HINT: &str =
    "Other sources couldn’t start. Tap Reload catalog. If it still fails, reinstall Fyodor.";

fn java_bin_name() -> &'static str {
    if cfg!(windows) {
        "java.exe"
    } else {
        "java"
    }
}

fn java_looks_valid(path: &Path) -> bool {
    // Ignore build.rs placeholders (empty / tiny stubs). Real Temurin java.exe is tens of KB+.
    std::fs::metadata(path)
        .map(|m| m.is_file() && m.len() >= 8_000)
        .unwrap_or(false)
}

fn java_runs(path: &Path) -> bool {
    let mut cmd = Command::new(path);
    cmd.arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.status().map(|s| s.success()).unwrap_or(false)
}

fn java_candidate_paths(resource_dir: Option<&Path>, exe_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let bin = java_bin_name();
    for dir in [resource_dir, exe_dir].into_iter().flatten() {
        candidates.push(dir.join("resources").join("jre").join("bin").join(bin));
        candidates.push(dir.join("jre").join("bin").join(bin));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("resources").join("jre").join("bin").join(bin));
            candidates.push(dir.join("jre").join("bin").join(bin));
        }
    }
    candidates
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
    if let Ok(path) = std::env::var("FYODOR_JAVA") {
        let p = PathBuf::from(path);
        if java_looks_valid(&p) && java_runs(&p) {
            return Ok(p);
        }
    }
    if let Some(p) = PACKAGED_JAVA.get() {
        if java_looks_valid(p) && java_runs(p) {
            return Ok(p.clone());
        }
    }
    for c in java_candidate_paths(None, None) {
        if java_looks_valid(&c) && java_runs(&c) {
            return Ok(c);
        }
    }
    if let Ok(home) = std::env::var("JAVA_HOME") {
        let candidate = PathBuf::from(home).join("bin").join(java_bin_name());
        if java_looks_valid(&candidate) && java_runs(&candidate) {
            return Ok(candidate);
        }
    }
    for key in ["LOCALAPPDATA", "USERPROFILE"] {
        if let Ok(base) = std::env::var(key) {
            for rel in [
                "jdk-17\\bin\\java.exe",
                "jdk-21\\bin\\java.exe",
                "Java\\jdk-17\\bin\\java.exe",
                "Java\\jdk-21\\bin\\java.exe",
            ] {
                let candidate = PathBuf::from(&base).join(rel);
                if java_looks_valid(&candidate) && java_runs(&candidate) {
                    return Ok(candidate);
                }
            }
        }
    }
    let path_java = PathBuf::from(java_bin_name());
    if java_runs(&path_java) {
        return Ok(path_java);
    }
    Err(AppError::from(USER_BRIDGE_HINT))
}

/// Call once from app setup so release installs can find the bundled JAR.
fn jar_looks_valid(path: &Path) -> bool {
    std::fs::metadata(path)
        .map(|m| m.is_file() && m.len() >= 1_000_000)
        .unwrap_or(false)
}

pub fn configure_packaged_jar(resource_dir: Option<PathBuf>, exe_dir: Option<PathBuf>) {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(dir) = resource_dir.as_ref() {
        candidates.push(dir.join("resources").join("kotatsu-bridge.jar"));
        candidates.push(dir.join("kotatsu-bridge.jar"));
    }
    if let Some(dir) = exe_dir.as_ref() {
        candidates.push(dir.join("resources").join("kotatsu-bridge.jar"));
        candidates.push(dir.join("kotatsu-bridge.jar"));
        candidates.push(dir.join("kotatsu-bridge").join("kotatsu-bridge.jar"));
    }
    for c in candidates {
        if jar_looks_valid(&c) {
            let _ = PACKAGED_JAR.set(c);
            break;
        }
    }
    configure_packaged_java(resource_dir, exe_dir);
}

fn configure_packaged_java(resource_dir: Option<PathBuf>, exe_dir: Option<PathBuf>) {
    for c in java_candidate_paths(resource_dir.as_deref(), exe_dir.as_deref()) {
        if java_looks_valid(&c) {
            let _ = PACKAGED_JAVA.set(c);
            return;
        }
    }
}

fn find_jar() -> AppResult<PathBuf> {
    if let Ok(path) = std::env::var("FYODOR_KOTATSU_BRIDGE") {
        let p = PathBuf::from(path);
        if jar_looks_valid(&p) {
            return Ok(p);
        }
    }
    if let Some(p) = PACKAGED_JAR.get() {
        if jar_looks_valid(p) {
            return Ok(p.clone());
        }
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest.join("resources/kotatsu-bridge.jar"),
        manifest.join("../sidecars/bin/kotatsu-bridge.jar"),
        manifest.join("../sidecars/kotatsu-bridge/build/libs/kotatsu-bridge.jar"),
    ];
    for c in candidates {
        if jar_looks_valid(&c) {
            return Ok(c);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for c in [
                dir.join("resources").join("kotatsu-bridge.jar"),
                dir.join("kotatsu-bridge.jar"),
            ] {
                if jar_looks_valid(&c) {
                    return Ok(c);
                }
            }
        }
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        for name in ["Fyodor", "FYODOR"] {
            let p = PathBuf::from(&local).join(name).join("kotatsu-bridge.jar");
            if jar_looks_valid(&p) {
                return Ok(p);
            }
        }
    }
    Err(AppError::from(USER_BRIDGE_HINT))
}

fn drain_stderr(bridge: &mut Bridge) -> String {
    let mut buf = String::new();
    let _ = bridge.stderr.read_to_string(&mut buf);
    buf.trim().chars().take(400).collect()
}

fn spawn_bridge() -> AppResult<Bridge> {
    let java = find_java()?;
    let jar = find_jar()?;
    let mut cmd = Command::new(&java);
    // Force UTF-8 before -jar so list_sources titles (CJK, etc.) don't land as
    // the Windows ANSI code page — Rust's pipe reader expects UTF-8.
    cmd.args([
        "-Dfile.encoding=UTF-8",
        "-Dstdout.encoding=UTF-8",
        "-Dstderr.encoding=UTF-8",
        "-Dsun.stdout.encoding=UTF-8",
        "-Dsun.stderr.encoding=UTF-8",
        "-jar",
    ])
    .arg(&jar)
    .arg("serve")
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    // Hide the JDK console window on Windows (java.exe is a console subsystem binary).
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|_| AppError::from(USER_BRIDGE_HINT))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::from(USER_BRIDGE_HINT))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::from(USER_BRIDGE_HINT))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| AppError::from(USER_BRIDGE_HINT))?;
    Ok(Bridge {
        child,
        stdin,
        stdout: BufReader::new(stdout),
        stderr: BufReader::new(stderr),
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

fn read_bridge_line(reader: &mut impl BufRead) -> AppResult<String> {
    let mut buf = Vec::new();
    reader
        .read_until(b'\n', &mut buf)
        .map_err(|e| AppError::from(format!("Kotatsu bridge read failed: {e}")))?;
    while matches!(buf.last(), Some(b'\n' | b'\r')) {
        buf.pop();
    }
    match String::from_utf8(buf) {
        Ok(s) => Ok(s),
        Err(err) => {
            // Tolerate a legacy JVM still emitting the Windows code page.
            Ok(String::from_utf8_lossy(&err.into_bytes()).into_owned())
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

    let response_line = read_bridge_line(&mut bridge.stdout)?;
    if response_line.is_empty() {
        let _ = bridge.child.kill();
        let _ = bridge.child.wait();
        let _stderr = drain_stderr(bridge);
        return Err(AppError::from(USER_BRIDGE_HINT));
    }
    let value: Value = serde_json::from_str(response_line.trim())
        .map_err(|_| AppError::from(USER_BRIDGE_HINT))?;
    if value.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let err = value
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or(USER_BRIDGE_HINT);
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
    let cache = SOURCES_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cache.lock() {
        if let Some(cached) = guard.as_ref() {
            return Ok(cached.clone());
        }
    }

    let loaded: Vec<KotatsuSource> = with_bridge(|b| {
        let value = request(b, json!({"op": "list_sources"}))?;
        let sources = value
            .get("sources")
            .cloned()
            .unwrap_or(Value::Array(vec![]));
        serde_json::from_value::<Vec<KotatsuSource>>(sources)
            .map_err(|e| AppError::from(format!("parse sources: {e}")))
    })?;

    if let Ok(mut guard) = cache.lock() {
        *guard = Some(loaded.clone());
    }
    Ok(loaded)
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
