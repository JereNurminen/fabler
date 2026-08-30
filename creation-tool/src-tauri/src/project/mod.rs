pub mod export;
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

        let mut story = story::read_story(path)?;

        // Stories written before ids existed deserialize with an empty id.
        // Assign one and persist it, so exports have a stable identity.
        if story.id.is_empty() {
            story.id = generate_id();
            story::write_story(path, &story)?;
        }

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
            editor: None,
        };
        pages::write_page(&pages_dir, &page)?;

        let story = Story {
            format_version: 1,
            id: generate_id(),
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
    pub fn save_story(&self, mut story: Story) -> AppResult<()> {
        // `Story::id` is `#[serde(default)]`, so a client that round-trips the
        // story without it would blank the id rather than fail. The next open
        // would then mint a different one, orphaning any copy already installed
        // in a reader. Keep the id we already hold.
        if story.id.is_empty() {
            story.id = self.story_cache.lock().unwrap().id.clone();
        }

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
            editor: None,
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

    /// Read every page in the project. Used by export and validation.
    pub fn read_all_pages(&self) -> AppResult<Vec<Page>> {
        let mut pages = Vec::new();
        for item in self.list_pages()? {
            pages.push(self.read_page(&item.id)?);
        }
        Ok(pages)
    }

    /// Check the story for structural problems.
    pub fn validate(&self) -> AppResult<shared::validation::Report> {
        let story = self.story();
        let pages = self.read_all_pages()?;
        Ok(shared::validation::validate(&story, &pages))
    }

    /// Build the page/choice graph for the story map.
    pub fn story_graph(&self) -> AppResult<shared::graph::StoryGraph> {
        let story = self.story();
        let pages = self.read_all_pages()?;
        Ok(shared::graph::build_graph(&story, &pages))
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
                format!("{stem}-{counter}")
            } else {
                format!("{stem}-{counter}.{ext}")
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

    pub fn delete_asset(&self, filename: &str) -> AppResult<()> {
        let path = self.dir.join("assets").join(filename);
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn create_assigns_a_story_id() {
        let tmp = TempDir::new().unwrap();
        let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Title").unwrap();
        assert!(!project.story().id.is_empty());
    }

    #[test]
    fn save_story_does_not_blank_an_existing_id() {
        let tmp = TempDir::new().unwrap();
        let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Title").unwrap();
        let original_id = project.story().id;

        // Simulate a client that dropped the id on the way back.
        let mut story = project.story();
        story.id = String::new();
        story.title = "Renamed".into();
        project.save_story(story).unwrap();

        assert_eq!(project.story().id, original_id);
        assert_eq!(project.story().title, "Renamed");
    }

    #[test]
    fn open_backfills_a_missing_story_id_and_persists_it() {
        // story.json files written before ids existed have no "id" key at all.
        // Opening one must mint an id and save it, so the next export is stable.
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("legacy");
        std::fs::create_dir_all(&dir).unwrap();
        let story_path = dir.join("story.json");
        std::fs::write(
            &story_path,
            r#"{"format_version":1,"title":"Legacy","start_page":"a1b2c","flags":[]}"#,
        )
        .unwrap();

        let project = Project::open(story_path.to_str().unwrap()).unwrap();
        let id = project.story().id;
        assert!(!id.is_empty(), "opening a legacy story must assign an id");
        assert_eq!(project.story().title, "Legacy");

        // The id is written back, so it survives a reopen.
        let reopened = Project::open(story_path.to_str().unwrap()).unwrap();
        assert_eq!(reopened.story().id, id, "backfilled id must be persisted");
    }
}
