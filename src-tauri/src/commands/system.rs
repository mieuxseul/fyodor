use crate::error::{AppError, AppResult};

#[tauri::command]
pub fn open_external_url(url: String) -> AppResult<()> {
    let trimmed = url.trim();
    let lower = trimmed.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://"))
        || trimmed.contains(char::is_whitespace)
        || lower.starts_with("javascript:")
    {
        return Err(AppError::Message(
            "Only http(s) URLs can be opened externally".into(),
        ));
    }

    open::that(trimmed).map_err(|e| AppError::Message(format!("Failed to open URL: {e}")))
}
