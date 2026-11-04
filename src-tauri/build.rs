use std::fs;
use std::path::Path;

fn main() {
    // Tauri requires configured resource paths to exist at compile time.
    // Release CI replaces this with the real kotatsu-bridge shadowJar before packaging.
    // Runtime ignores tiny placeholders (< 1MB).
    let resources = Path::new("resources");
    let jar = resources.join("kotatsu-bridge.jar");
    if !jar.exists() {
        let _ = fs::create_dir_all(resources);
        let mut bytes = vec![0x50u8, 0x4B, 0x05, 0x06];
        bytes.extend(std::iter::repeat(0u8).take(18));
        let _ = fs::write(&jar, bytes);
    }
    tauri_build::build()
}
