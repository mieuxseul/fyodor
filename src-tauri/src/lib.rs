mod archive;
mod cdn_protocol;
mod commands;
mod db;
mod error;
mod providers;
mod state;

use tauri::Manager;

use commands::{
    atsu, import, kotatsu, library, mangadex, organization, reader, settings, system, updates,
};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .register_asynchronous_uri_scheme_protocol("fyodor-cdn", cdn_protocol::handle_request)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let state = AppState::initialize(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings::get_settings,
            settings::get_setting,
            settings::set_setting,
            settings::get_app_paths,
            settings::backup_database,
            library::list_library,
            library::get_title_details,
            library::update_title,
            library::remove_from_library,
            library::search_library,
            library::get_remote_library_ref,
            library::add_remote_to_library,
            library::sync_title_cover,
            import::pick_and_import_archives,
            import::pick_and_import_folder,
            import::import_path,
            import::relink_local_file,
            organization::list_history,
            organization::clear_history,
            organization::list_bookmarks,
            organization::create_bookmark,
            organization::delete_bookmark,
            mangadex::mangadex_search,
            mangadex::mangadex_health,
            mangadex::mangadex_title_details,
            mangadex::mangadex_chapters,
            mangadex::mangadex_chapter_pages,
            mangadex::mangadex_cover_data_url,
            atsu::atsu_search,
            atsu::atsu_health,
            atsu::atsu_title_details,
            atsu::atsu_title_bundle,
            atsu::atsu_chapters,
            atsu::atsu_chapter_pages,
            atsu::atsu_cover_data_url,
            atsu::atsu_image_data_url,
            kotatsu::kotatsu_health,
            kotatsu::kotatsu_list_sources,
            kotatsu::kotatsu_search,
            kotatsu::kotatsu_search_many,
            kotatsu::kotatsu_title_details,
            kotatsu::kotatsu_chapters,
            kotatsu::kotatsu_chapter_pages,
            kotatsu::kotatsu_bridge_status,
            system::open_external_url,
            updates::check_for_updates,
            reader::get_chapter_pages,
            reader::get_reading_progress,
            reader::save_reading_progress,
            reader::open_edition_for_reading,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fyodor");
}
