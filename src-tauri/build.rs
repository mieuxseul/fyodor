use std::fs;
use std::path::Path;

fn main() {
    // Tauri requires configured resource paths to exist at compile time.
    // Release CI replaces these with the real bridge JAR + portable Temurin JRE.
    // Runtime ignores tiny placeholders (jar < 1MB, java.exe < 8KB).
    let resources = Path::new("resources");
    let jar = resources.join("kotatsu-bridge.jar");
    if !jar.exists() {
        let _ = fs::create_dir_all(resources);
        let mut bytes = vec![0x50u8, 0x4B, 0x05, 0x06];
        bytes.extend(std::iter::repeat(0u8).take(18));
        let _ = fs::write(&jar, bytes);
    }

    let jre_bin = resources.join("jre").join("bin");
    let java = jre_bin.join(if cfg!(windows) { "java.exe" } else { "java" });
    if !java.exists() {
        let _ = fs::create_dir_all(&jre_bin);
        let _ = fs::write(&java, b"");
        let _ = fs::write(resources.join("jre").join(".placeholder"), b"ci-replaces-jre");
    }

    tauri_build::build()
}
