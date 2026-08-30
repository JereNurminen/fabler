pub mod export;
pub mod import;
pub mod pages;
pub mod story;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use shared::id::generate_id;
use shared::models::{Page, PageListItem, Story};

use crate::error::{AppError, AppResult};

/// A project backed by a directory containing story.json and a pages/ subfolder.
pub struct Project {
    /// Path to the project directory (parent of story.json).
    dir: PathBuf,
    /// Cached story metadata.
    story_cache: Mutex<Story>,
}

impl Project {
    /// Open an existing project from the path to its story.json file.
    pub fn open(story_json_path: &str) -> AppResult<Self> {
        let path = Path::new(story_json_path);
        let dir = path
            .parent()
            .ok_or_else(|| AppError::Custom("Invalid story.json path".into()))?
            .to_path_buf();

        let story = story::read_story(path)?;

        // Ensure pages directory exists
        let pages_dir = dir.join("pages");
        if !pages_dir.exists() {
            std::fs::create_dir_all(&pages_dir)?;
        }

        Ok(Project {
            dir,
            story_cache: Mutex::new(story),
        })
    }

    /// Create a new project in the given directory with the given title.
    pub fn create(dir_path: &str, title: &str) -> AppResult<Self> {
        let dir = Path::new(dir_path).to_path_buf();
        std::fs::create_dir_all(&dir)?;

        let pages_dir = dir.join("pages");
        std::fs::create_dir_all(&pages_dir)?;

        // Create the initial page
        let page_id = generate_id();
        let page = Page {
            id: page_id.clone(),
            name: "Start".into(),
            body: shared::content::Document::empty(),
            choices: vec![],
            flag_operations: vec![],
        };
        pages::write_page(&pages_dir, &page)?;

        let story = Story {
            format_version: 1,
            title: title.into(),
            start_page: page_id,
            flags: vec![],
        };

        let story_path = dir.join("story.json");
        story::write_story(&story_path, &story)?;

        Ok(Project {
            dir,
            story_cache: Mutex::new(story),
        })
    }

    /// Get a clone of the cached story.
    pub fn story(&self) -> Story {
        self.story_cache.lock().unwrap().clone()
    }

    /// Save the story (updates cache and writes to disk).
    pub fn save_story(&self, story: Story) -> AppResult<()> {
        let story_path = self.dir.join("story.json");
        story::write_story(&story_path, &story)?;
        *self.story_cache.lock().unwrap() = story;
        Ok(())
    }

    /// List all pages (lightweight: id + name only).
    pub fn list_pages(&self) -> AppResult<Vec<PageListItem>> {
        let pages_dir = self.dir.join("pages");
        pages::list_pages(&pages_dir)
    }

    /// Read a full page by ID.
    pub fn read_page(&self, id: &str) -> AppResult<Page> {
        let pages_dir = self.dir.join("pages");
        pages::read_page(&pages_dir, id)
    }

    /// Save (create or update) a page.
    pub fn save_page(&self, page: &Page) -> AppResult<()> {
        let pages_dir = self.dir.join("pages");
        pages::write_page(&pages_dir, page)
    }

    /// Create a new page with the given name, returning it.
    pub fn create_page(&self, name: &str) -> AppResult<Page> {
        let pages_dir = self.dir.join("pages");

        // Collect existing IDs to avoid collision
        let existing_pages = pages::list_pages(&pages_dir)?;
        let existing_ids: Vec<&str> = existing_pages.iter().map(|p| p.id.as_str()).collect();
        let id = shared::id::generate_unique_id(&existing_ids);

        let page = Page {
            id,
            name: name.into(),
            body: shared::content::Document::empty(),
            choices: vec![],
            flag_operations: vec![],
        };
        pages::write_page(&pages_dir, &page)?;
        Ok(page)
    }

    /// Delete a page by ID.
    pub fn delete_page(&self, id: &str) -> AppResult<()> {
        let pages_dir = self.dir.join("pages");
        pages::delete_page(&pages_dir, id)
    }

    /// Export the project as a .fabler bundle to the given output path.
    pub fn export_bundle(&self, output_path: &str) -> AppResult<()> {
        export::export_bundle(self, output_path)
    }

    /// Get the project directory path.
    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn copy_asset(&self, source_path: &str) -> AppResult<String> {
        let source = std::path::PathBuf::from(source_path);
        let filename = source
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| AppError::Custom("Invalid source path".into()))?
            .to_string();

        let assets_dir = self.dir.join("assets");
        std::fs::create_dir_all(&assets_dir)?;

        let mut target_name = filename.clone();
        let mut counter = 2;
        while assets_dir.join(&target_name).exists() {
            let stem = std::path::Path::new(&filename)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
            let ext = std::path::Path::new(&filename)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            target_name = if ext.is_empty() {
                format!("{}-{}", stem, counter)
            } else {
                format!("{}-{}.{}", stem, counter, ext)
            };
            counter += 1;
        }

        std::fs::copy(&source, assets_dir.join(&target_name))?;
        Ok(target_name)
    }

    pub fn get_assets_dir(&self) -> std::path::PathBuf {
        self.dir.join("assets")
    }

    pub fn list_assets(&self) -> AppResult<Vec<String>> {
        let assets_dir = self.dir.join("assets");
        if !assets_dir.exists() {
            return Ok(vec![]);
        }
        let mut names = Vec::new();
        for entry in std::fs::read_dir(&assets_dir)? {
            let entry = entry?;
            if entry.path().is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    names.push(name.to_string());
                }
            }
        }
        names.sort();
        Ok(names)
    }

    pub fn read_asset_base64(&self, filename: &str) -> AppResult<String> {
        use std::io::Read;
        let path = self.dir.join("assets").join(filename);
        if !path.exists() {
            return Err(AppError::Custom(format!("Asset not found: {}", filename)));
        }
        let mut file = std::fs::File::open(&path)?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let mime = match ext {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            _ => "application/octet-stream",
        };

        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
        Ok(format!("data:{};base64,{}", mime, b64))
    }

    pub fn delete_asset(&self, filename: &str) -> AppResult<()> {
        let path = self.dir.join("assets").join(filename);
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }
}
