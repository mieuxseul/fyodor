use tauri::State;
use tauri_plugin_dialog::DialogExt;

use crate::db::models::{
    ActivityEvent, CreateDiaryInput, DiaryEntry, ProfileFavorite, SetFavoriteInput, SetRatingInput,
    SocialTitleInput, TitleSocialState, ToggleLikeInput, UpdateDiaryInput, UpdateProfileInput,
    UserProfile,
};
use crate::db::repos;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub fn get_profile(state: State<'_, AppState>) -> AppResult<UserProfile> {
    state.with_db(|conn| repos::get_user_profile(conn))
}

#[tauri::command]
pub fn update_profile(
    state: State<'_, AppState>,
    input: UpdateProfileInput,
) -> AppResult<UserProfile> {
    state.with_db(|conn| repos::update_user_profile(conn, &input))
}

#[tauri::command]
pub async fn pick_profile_avatar(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> AppResult<UserProfile> {
    let path = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "gif"])
        .blocking_pick_file();
    let Some(file) = path else {
        return state.with_db(|conn| repos::get_user_profile(conn));
    };
    let path_buf = file
        .into_path()
        .map_err(|e| AppError::Message(format!("Invalid avatar path: {e}")))?;
    let path_str = path_buf.to_string_lossy().to_string();
    state.with_db(|conn| {
        repos::update_user_profile(
            conn,
            &UpdateProfileInput {
                display_name: None,
                bio: None,
                avatar_path: Some(path_str),
                clear_avatar: None,
                show_recent_activity: None,
            },
        )
    })
}

#[tauri::command]
pub fn list_profile_favorites(state: State<'_, AppState>) -> AppResult<Vec<ProfileFavorite>> {
    state.with_db(|conn| repos::list_profile_favorites(conn))
}

#[tauri::command]
pub fn set_profile_favorite(
    state: State<'_, AppState>,
    input: SetFavoriteInput,
) -> AppResult<Vec<ProfileFavorite>> {
    state.with_db(|conn| repos::set_profile_favorite(conn, input.slot, &input.title))
}

#[tauri::command]
pub fn clear_profile_favorite(
    state: State<'_, AppState>,
    slot: i64,
) -> AppResult<Vec<ProfileFavorite>> {
    state.with_db(|conn| repos::clear_profile_favorite(conn, slot))
}

#[tauri::command]
pub fn get_title_social(
    state: State<'_, AppState>,
    input: SocialTitleInput,
) -> AppResult<TitleSocialState> {
    state.with_db(|conn| repos::get_title_social(conn, &input))
}

#[tauri::command]
pub fn set_title_rating(
    state: State<'_, AppState>,
    input: SetRatingInput,
) -> AppResult<TitleSocialState> {
    state.with_db(|conn| repos::set_title_rating(conn, &input.title, input.rating))
}

#[tauri::command]
pub fn toggle_title_like(
    state: State<'_, AppState>,
    input: ToggleLikeInput,
) -> AppResult<TitleSocialState> {
    state.with_db(|conn| repos::toggle_title_like(conn, &input.title))
}

#[tauri::command]
pub fn list_diary(state: State<'_, AppState>, limit: Option<i64>) -> AppResult<Vec<DiaryEntry>> {
    state.with_db(|conn| repos::list_diary(conn, limit.unwrap_or(100)))
}

#[tauri::command]
pub fn create_diary_entry(
    state: State<'_, AppState>,
    input: CreateDiaryInput,
) -> AppResult<DiaryEntry> {
    state.with_db(|conn| repos::create_diary_entry(conn, &input))
}

#[tauri::command]
pub fn update_diary_entry(
    state: State<'_, AppState>,
    input: UpdateDiaryInput,
) -> AppResult<DiaryEntry> {
    state.with_db(|conn| repos::update_diary_entry(conn, &input))
}

#[tauri::command]
pub fn delete_diary_entry(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_db(|conn| repos::delete_diary_entry(conn, &id))
}

#[tauri::command]
pub fn list_recent_activity(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> AppResult<Vec<ActivityEvent>> {
    state.with_db(|conn| repos::list_recent_activity(conn, limit.unwrap_or(40)))
}
