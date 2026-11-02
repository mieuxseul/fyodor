use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const BRIDGE_JAR: &str = "kotatsu-bridge.jar";
const SETTING_ENABLED: &str = "kotatsu.enabled_sources";
const SETTING_JAVA: &str = "kotatsu.java_path";

fn find_java(custom: Option<String>) -> PathBuf {
    if let Some(custom) = custom {
        let path = PathBuf::from(custom);
        if path.is_file() {
            return path;
        }
    }

    let candidates = [
        std::env::var_os("JAVA_HOME")
            .map(|h| PathBuf::from(h).join("bin").join("java.exe")),
        std::env::var_os("LOCALAPPDATA").map(|h| {
            PathBuf::from(h).join("jdk-21").join("bin").join("java.exe")
        }),
        Some(PathBuf::from(
            r"C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe",
        )),
        Some(PathBuf::from(r"C:\Program Files\Java\jdk-21\bin\java.exe")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.is_file() {
            return candidate;
        }
    }

    PathBuf::from("java")
}

fn find_bridge_jar(app: &AppHandle) -> AppResult<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("sidecars").join(BRIDGE_JAR));
            candidates.push(dir.join(BRIDGE_JAR));
        }
    }

    if let Ok(resource) = app.path().resource_dir() {
        candidates.push(resource.join("resources").join(BRIDGE_JAR));
        candidates.push(resource.join("sidecars").join(BRIDGE_JAR));
        candidates.push(resource.join(BRIDGE_JAR));
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("sidecars").join(BRIDGE_JAR));
        candidates.push(cwd.join("..").join("sidecars").join(BRIDGE_JAR));
        candidates.push(
            cwd.join("sidecars")
                .join("kotatsu-bridge")
                .join("build")
                .join("libs")
                .join(BRIDGE_JAR),
        );
        candidates.push(
            cwd.join("..")
                .join("sidecars")
                .join("kotatsu-bridge")
                .join("build")
                .join("libs")
                .join(BRIDGE_JAR),
        );
    }

    candidates.push(PathBuf::from(
        r"C:\Users\Administrator\Documents\System\fyodor-desktop\sidecars\kotatsu-bridge.jar",
    ));
    candidates.push(PathBuf::from(
        r"C:\Users\Administrator\Documents\System\fyodor-desktop\sidecars\kotatsu-bridge\build\libs\kotatsu-bridge.jar",
    ));

    for path in candidates {
        if path.is_file() {
            return Ok(path);
        }
    }

    Err(AppError::Message(
        "kotatsu-bridge.jar not found. Build sidecars/kotatsu-bridge (gradlew shadowJar).".into(),
    ))
}

fn run_bridge(java: &PathBuf, jar: &PathBuf, args: &[String]) -> AppResult<Value> {
    let output = Command::new(java)
        .arg("-jar")
        .arg(jar)
        .args(args)
        .output()
        .map_err(|err| {
            AppError::Message(format!(
                "Failed to start kotatsu-bridge (java={java:?}, jar={jar:?}): {err}"
            ))
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        return Err(AppError::Message(format!(
            "kotatsu-bridge failed: {}",
            if stderr.is_empty() { stdout } else { stderr }
        )));
    }

    if stdout.is_empty() {
        return Err(AppError::Message(format!(
            "kotatsu-bridge returned empty output. stderr={stderr}"
        )));
    }

    serde_json::from_str(&stdout).map_err(|err| {
        AppError::Message(format!(
            "Invalid kotatsu-bridge JSON: {err}; stdout={stdout}"
        ))
    })
}

fn default_enabled_sources() -> Vec<String> {
    [
        "MANGADEX",
        "MANGAFIRE_EN",
        "MANGAKAKALOT",
        "MANGAHERE",
        "ASURASCANS",
        "COMICK_FUN",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

fn load_enabled_sources(state: &AppState) -> AppResult<Vec<String>> {
    let raw = state.with_db(|conn| repos::get_setting(conn, SETTING_ENABLED))?;
    match raw {
        Some(value) if !value.trim().is_empty() => {
            let parsed: Vec<String> = serde_json::from_str(&value).unwrap_or_default();
            if parsed.is_empty() {
                Ok(default_enabled_sources())
            } else {
                Ok(parsed)
            }
        }
        _ => Ok(default_enabled_sources()),
    }
}

fn bridge_paths(app: &AppHandle, state: &AppState) -> AppResult<(PathBuf, PathBuf)> {
    let custom_java = state.with_db(|conn| repos::get_setting(conn, SETTING_JAVA))?;
    let java = find_java(custom_java);
    let jar = find_bridge_jar(app)?;
    Ok((java, jar))
}

#[tauri::command]
pub async fn kotatsu_health(app: AppHandle, state: State<'_, AppState>) -> AppResult<Value> {
    let (java, jar) = bridge_paths(&app, &state)?;
    tauri::async_runtime::spawn_blocking(move || {
        run_bridge(&java, &jar, &["health".into()])
    })
    .await
    .map_err(|err| AppError::Message(format!("kotatsu_health join error: {err}")))?
}

#[tauri::command]
pub async fn kotatsu_list_sources(app: AppHandle, state: State<'_, AppState>) -> AppResult<Value> {
    let (java, jar) = bridge_paths(&app, &state)?;
    tauri::async_runtime::spawn_blocking(move || {
        run_bridge(&java, &jar, &["list-sources".into()])
    })
    .await
    .map_err(|err| AppError::Message(format!("kotatsu_list_sources join error: {err}")))?
}

#[tauri::command]
pub async fn kotatsu_get_enabled_sources(
    state: State<'_, AppState>,
) -> AppResult<Vec<String>> {
    load_enabled_sources(&state)
}

#[tauri::command]
pub async fn kotatsu_set_enabled_sources(
    state: State<'_, AppState>,
    sources: Vec<String>,
) -> AppResult<()> {
    let payload = serde_json::to_string(&sources)
        .map_err(|err| AppError::Message(format!("encode enabled sources: {err}")))?;
    state.with_db(|conn| repos::set_setting(conn, SETTING_ENABLED, &payload))
}

#[tauri::command]
pub async fn kotatsu_search(
    app: AppHandle,
    state: State<'_, AppState>,
    source: String,
    query: String,
    limit: Option<u32>,
) -> AppResult<Value> {
    let limit = limit.unwrap_or(12).clamp(1, 40).to_string();
    let (java, jar) = bridge_paths(&app, &state)?;
    tauri::async_runtime::spawn_blocking(move || {
        run_bridge(
            &java,
            &jar,
            &[
                "search".into(),
                "--source".into(),
                source,
                "--query".into(),
                query,
                "--limit".into(),
                limit,
            ],
        )
    })
    .await
    .map_err(|err| AppError::Message(format!("kotatsu_search join error: {err}")))?
}

#[tauri::command]
pub async fn kotatsu_search_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    query: String,
    limit_per_source: Option<u32>,
) -> AppResult<Value> {
    let enabled = load_enabled_sources(&state)?;
    let per = limit_per_source.unwrap_or(8).clamp(1, 20).to_string();
    let (java, jar) = bridge_paths(&app, &state)?;

    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        let mut errors = Vec::new();
        for source in enabled {
            match run_bridge(
                &java,
                &jar,
                &[
                    "search".into(),
                    "--source".into(),
                    source.clone(),
                    "--query".into(),
                    query.clone(),
                    "--limit".into(),
                    per.clone(),
                ],
            ) {
                Ok(value) => {
                    if let Some(arr) = value.get("results").and_then(|v| v.as_array()) {
                        for item in arr {
                            results.push(item.clone());
                        }
                    }
                }
                Err(err) => errors.push(format!("{source}: {err}")),
            }
            std::thread::sleep(Duration::from_millis(120));
        }
        Ok(serde_json::json!({
            "ok": true,
            "results": results,
            "errors": errors,
        }))
    })
    .await
    .map_err(|err| AppError::Message(format!("kotatsu_search_enabled join error: {err}")))?
}

#[tauri::command]
pub async fn kotatsu_title_details(
    app: AppHandle,
    state: State<'_, AppState>,
    source: String,
    url: String,
    title: String,
    id: Option<String>,
    cover_url: Option<String>,
) -> AppResult<Value> {
    let (java, jar) = bridge_paths(&app, &state)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut args = vec![
            "details".into(),
            "--source".into(),
            source,
            "--url".into(),
            url,
            "--title".into(),
            title,
        ];
        if let Some(id) = id {
            args.extend(["--id".into(), id]);
        }
        if let Some(cover) = cover_url {
            args.extend(["--cover".into(), cover]);
        }
        run_bridge(&java, &jar, &args)
    })
    .await
    .map_err(|err| AppError::Message(format!("kotatsu_title_details join error: {err}")))?
}

#[tauri::command]
pub async fn kotatsu_chapters(
    app: AppHandle,
    state: State<'_, AppState>,
    source: String,
    url: String,
    title: String,
    id: Option<String>,
    cover_url: Option<String>,
) -> AppResult<Value> {
    let (java, jar) = bridge_paths(&app, &state)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut args = vec![
            "chapters".into(),
            "--source".into(),
            source,
            "--url".into(),
            url,
            "--title".into(),
            title,
        ];
        if let Some(id) = id {
            args.extend(["--id".into(), id]);
        }
        if let Some(cover) = cover_url {
            args.extend(["--cover".into(), cover]);
        }
        run_bridge(&java, &jar, &args)
    })
    .await
    .map_err(|err| AppError::Message(format!("kotatsu_chapters join error: {err}")))?
}

#[tauri::command]
pub async fn kotatsu_chapter_pages(
    app: AppHandle,
    state: State<'_, AppState>,
    source: String,
    manga_url: String,
    chapter_url: String,
    chapter_id: String,
    title: Option<String>,
) -> AppResult<Value> {
    let (java, jar) = bridge_paths(&app, &state)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut args = vec![
            "pages".into(),
            "--source".into(),
            source,
            "--manga-url".into(),
            manga_url,
            "--chapter-url".into(),
            chapter_url,
            "--chapter-id".into(),
            chapter_id,
        ];
        if let Some(title) = title {
            args.extend(["--title".into(), title]);
        }
        run_bridge(&java, &jar, &args)
    })
    .await
    .map_err(|err| AppError::Message(format!("kotatsu_chapter_pages join error: {err}")))?
}
