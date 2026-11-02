use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use walkdir::WalkDir;
use zip::ZipArchive;

use crate::error::{AppError, AppResult};

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"];

pub fn is_image_path(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Natural sort so page_2 comes before page_10.
pub fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let mut i = 0;
    let mut j = 0;

    while i < a_chars.len() && j < b_chars.len() {
        if a_chars[i].is_ascii_digit() && b_chars[j].is_ascii_digit() {
            let mut anum = 0u64;
            while i < a_chars.len() && a_chars[i].is_ascii_digit() {
                anum = anum
                    .saturating_mul(10)
                    .saturating_add(a_chars[i].to_digit(10).unwrap_or(0) as u64);
                i += 1;
            }
            let mut bnum = 0u64;
            while j < b_chars.len() && b_chars[j].is_ascii_digit() {
                bnum = bnum
                    .saturating_mul(10)
                    .saturating_add(b_chars[j].to_digit(10).unwrap_or(0) as u64);
                j += 1;
            }
            let order = anum.cmp(&bnum);
            if !order.is_eq() {
                return order;
            }
        } else {
            let ac = a_chars[i].to_ascii_lowercase();
            let bc = b_chars[j].to_ascii_lowercase();
            let order = ac.cmp(&bc);
            if !order.is_eq() {
                return order;
            }
            i += 1;
            j += 1;
        }
    }

    a_chars.len().cmp(&b_chars.len())
}

fn sanitize_entry_name(name: &str) -> AppResult<PathBuf> {
    let path = Path::new(name);
    if path.is_absolute() {
        return Err(AppError::Message(format!(
            "Archive entry has absolute path: {name}"
        )));
    }
    let mut clean = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => clean.push(part),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(AppError::Message(format!(
                    "Archive entry attempts path traversal: {name}"
                )));
            }
            _ => {
                return Err(AppError::Message(format!(
                    "Unsupported archive entry path: {name}"
                )));
            }
        }
    }
    if clean.as_os_str().is_empty() {
        return Err(AppError::Message("Empty archive entry name".into()));
    }
    Ok(clean)
}

#[allow(dead_code)]
pub fn list_archive_images(archive_path: &Path) -> AppResult<Vec<String>> {
    let file = File::open(archive_path)?;
    let mut zip = ZipArchive::new(file)?;
    let mut names = Vec::new();

    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().replace('\\', "/");
        if name.starts_with("__MACOSX/") || name.split('/').any(|p| p.starts_with('.')) {
            continue;
        }
        sanitize_entry_name(&name)?;
        if is_image_path(&name) {
            names.push(name);
        }
    }

    names.sort_by(|a, b| natural_cmp(a, b));
    Ok(names)
}

pub fn extract_archive_images(
    archive_path: &Path,
    dest_dir: &Path,
) -> AppResult<(Vec<String>, Vec<String>)> {
    fs::create_dir_all(dest_dir)?;
    let file = File::open(archive_path)?;
    let mut zip = ZipArchive::new(file)?;
    let mut extracted = Vec::new();
    let mut warnings = Vec::new();

    let mut names: Vec<String> = Vec::new();
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().replace('\\', "/");
        if name.starts_with("__MACOSX/") {
            continue;
        }
        match sanitize_entry_name(&name) {
            Ok(_) if is_image_path(&name) => names.push(name),
            Ok(_) => {}
            Err(err) => warnings.push(err.to_string()),
        }
    }
    names.sort_by(|a, b| natural_cmp(a, b));

    for (index, name) in names.iter().enumerate() {
        let mut entry = zip.by_name(name)?;
        let ext = Path::new(name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg");
        let out_name = format!("page_{:04}.{}", index + 1, ext.to_ascii_lowercase());
        let out_path = dest_dir.join(&out_name);
        let mut out = File::create(&out_path)?;
        let mut buffer = Vec::new();
        entry.read_to_end(&mut buffer)?;
        out.write_all(&buffer)?;
        extracted.push(out_path.to_string_lossy().to_string());
    }

    if extracted.is_empty() {
        return Err(AppError::Message(
            "No supported images found in archive".into(),
        ));
    }

    Ok((extracted, warnings))
}

pub fn list_folder_images(folder: &Path) -> AppResult<Vec<PathBuf>> {
    let mut images = Vec::new();
    for entry in WalkDir::new(folder)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }
        if is_image_path(&path.to_string_lossy()) {
            images.push(path.to_path_buf());
        }
    }
    images.sort_by(|a, b| {
        natural_cmp(
            &a.to_string_lossy(),
            &b.to_string_lossy(),
        )
    });
    Ok(images)
}

pub fn copy_folder_images(folder: &Path, dest_dir: &Path) -> AppResult<Vec<String>> {
    fs::create_dir_all(dest_dir)?;
    let images = list_folder_images(folder)?;
    if images.is_empty() {
        return Err(AppError::Message(
            "No supported images found in folder".into(),
        ));
    }
    let mut out = Vec::new();
    for (index, src) in images.iter().enumerate() {
        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg");
        let out_name = format!("page_{:04}.{}", index + 1, ext.to_ascii_lowercase());
        let dest = dest_dir.join(&out_name);
        fs::copy(src, &dest)?;
        out.push(dest.to_string_lossy().to_string());
    }
    Ok(out)
}

pub fn title_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .replace('_', " ")
        .replace('-', " ")
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn natural_sort_orders_numeric_segments() {
        let mut items = vec![
            "page_10.jpg".to_string(),
            "page_2.jpg".to_string(),
            "page_1.jpg".to_string(),
        ];
        items.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(items, vec!["page_1.jpg", "page_2.jpg", "page_10.jpg"]);
    }

    #[test]
    fn rejects_path_traversal() {
        assert!(sanitize_entry_name("../evil.jpg").is_err());
        assert!(sanitize_entry_name("/abs/evil.jpg").is_err());
        assert!(sanitize_entry_name("chapter/page_01.jpg").is_ok());
    }
}
