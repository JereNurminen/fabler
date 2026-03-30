use std::path::{Path, PathBuf};

use shared::models::{Page, PageListItem};

use crate::error::{AppError, AppResult};

/// Convert a name to a URL-friendly slug.
pub fn slugify(name: &str) -> String {
    let slug: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    // Collapse consecutive dashes and trim leading/trailing dashes
    let mut result = String::new();
    let mut prev_dash = false;
    for c in slug.chars() {
        if c == '-' {
            if !prev_dash && !result.is_empty() {
                result.push('-');
            }
            prev_dash = true;
        } else {
            result.push(c);
            prev_dash = false;
        }
    }
    // Trim trailing dash
    if result.ends_with('-') {
        result.pop();
    }
    if result.is_empty() {
        "unnamed".into()
    } else {
        result
    }
}

/// Build the filename for a page: {id}-{slug}.page.json
fn page_filename(id: &str, name: &str) -> String {
    format!("{}-{}.page.json", id, slugify(name))
}

/// Find the page file matching the given ID prefix in the pages directory.
pub fn find_page_file(pages_dir: &Path, id: &str) -> AppResult<PathBuf> {
    let prefix = format!("{}-", id);
    let entries = std::fs::read_dir(pages_dir)?;
    for entry in entries {
        let entry = entry?;
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if name.starts_with(&prefix) && name.ends_with(".page.json") {
            return Ok(entry.path());
        }
    }
    Err(AppError::PageNotFound(id.into()))
}

/// Read a page by its ID from the pages directory.
pub fn read_page(pages_dir: &Path, id: &str) -> AppResult<Page> {
    let path = find_page_file(pages_dir, id)?;
    let data = std::fs::read_to_string(&path)?;
    let page: Page = serde_json::from_str(&data)?;
    Ok(page)
}

/// Write a page to disk. If a file with the same ID but different name exists, remove it first.
pub fn write_page(pages_dir: &Path, page: &Page) -> AppResult<()> {
    // Remove old file if it exists (name may have changed)
    if let Ok(old_path) = find_page_file(pages_dir, &page.id) {
        let new_filename = page_filename(&page.id, &page.name);
        let old_filename = old_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if old_filename != new_filename {
            std::fs::remove_file(&old_path)?;
        }
    }

    let filename = page_filename(&page.id, &page.name);
    let path = pages_dir.join(filename);
    let json = serde_json::to_string_pretty(page)?;
    std::fs::write(&path, json)?;
    Ok(())
}

/// Delete a page file by ID.
pub fn delete_page(pages_dir: &Path, id: &str) -> AppResult<()> {
    let path = find_page_file(pages_dir, id)?;
    std::fs::remove_file(&path)?;
    Ok(())
}

/// List all pages in the pages directory, sorted by name.
pub fn list_pages(pages_dir: &Path) -> AppResult<Vec<PageListItem>> {
    let mut items = Vec::new();

    if !pages_dir.exists() {
        return Ok(items);
    }

    let entries = std::fs::read_dir(pages_dir)?;
    for entry in entries {
        let entry = entry?;
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if name.ends_with(".page.json") {
            let data = std::fs::read_to_string(entry.path())?;
            let page: Page = serde_json::from_str(&data)?;
            items.push(PageListItem::from(&page));
        }
    }

    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::models::Page;
    use tempfile::TempDir;

    fn make_page(id: &str, name: &str) -> Page {
        Page {
            id: id.into(),
            name: name.into(),
            body: "Some body text".into(),
            choices: vec![],
            flag_operations: vec![],
        }
    }

    #[test]
    fn write_and_read_page() {
        let dir = TempDir::new().unwrap();
        let page = make_page("ab12c", "Test Page");
        write_page(dir.path(), &page).unwrap();
        let loaded = read_page(dir.path(), "ab12c").unwrap();
        assert_eq!(page, loaded);
    }

    #[test]
    fn write_page_renames_file_on_name_change() {
        let dir = TempDir::new().unwrap();

        let page = make_page("ab12c", "Old Name");
        write_page(dir.path(), &page).unwrap();

        // Verify old file exists
        let old_path = find_page_file(dir.path(), "ab12c").unwrap();
        assert!(old_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .contains("old-name"));

        // Write with new name
        let updated = make_page("ab12c", "New Name");
        write_page(dir.path(), &updated).unwrap();

        // Old file should be gone, new file should exist
        let new_path = find_page_file(dir.path(), "ab12c").unwrap();
        let new_filename = new_path.file_name().unwrap().to_string_lossy().to_string();
        assert!(new_filename.contains("new-name"));
        assert!(!new_filename.contains("old-name"));

        // Only one file should exist
        let count = std::fs::read_dir(dir.path())
            .unwrap()
            .filter(|e| e.is_ok())
            .count();
        assert_eq!(count, 1);
    }

    #[test]
    fn list_pages_returns_all_sorted() {
        let dir = TempDir::new().unwrap();

        write_page(dir.path(), &make_page("aa111", "Zebra")).unwrap();
        write_page(dir.path(), &make_page("bb222", "Apple")).unwrap();
        write_page(dir.path(), &make_page("cc333", "Mango")).unwrap();

        let items = list_pages(dir.path()).unwrap();
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].name, "Apple");
        assert_eq!(items[1].name, "Mango");
        assert_eq!(items[2].name, "Zebra");
    }

    #[test]
    fn delete_page_removes_file() {
        let dir = TempDir::new().unwrap();
        let page = make_page("ab12c", "To Delete");
        write_page(dir.path(), &page).unwrap();

        delete_page(dir.path(), "ab12c").unwrap();

        let result = read_page(dir.path(), "ab12c");
        assert!(result.is_err());
    }

    #[test]
    fn read_nonexistent_page_returns_error() {
        let dir = TempDir::new().unwrap();
        let result = read_page(dir.path(), "zzzzz");
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::PageNotFound(id) => assert_eq!(id, "zzzzz"),
            other => panic!("Expected PageNotFound, got: {:?}", other),
        }
    }

    #[test]
    fn slugify_handles_special_chars() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("foo---bar"), "foo-bar");
        assert_eq!(slugify("  leading spaces  "), "leading-spaces");
        assert_eq!(slugify("UPPER CASE"), "upper-case");
        assert_eq!(slugify("special!@#chars"), "special-chars");
        assert_eq!(slugify(""), "unnamed");
    }
}
