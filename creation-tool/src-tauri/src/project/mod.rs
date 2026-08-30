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
    pub(crate) dir: PathBuf,
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
            last_modified: None,
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

    fn pages_dir(&self) -> PathBuf {
        self.dir.join("pages")
    }

    /// Created lazily by `pages::move_page` on the first trash, so opening a
    /// project never adds an empty directory to it.
    fn trash_dir(&self) -> PathBuf {
        self.dir.join("trash")
    }

    /// True when this id names a file in `trash/`.
    fn is_trashed(&self, id: &str) -> bool {
        pages::find_page_file(&self.trash_dir(), id).is_ok()
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
        pages::list_pages(&self.pages_dir())
    }

    /// Read a full page by ID.
    pub fn read_page(&self, id: &str) -> AppResult<Page> {
        pages::read_page(&self.pages_dir(), id)
    }

    /// Save (create or update) a page.
    ///
    /// Refuses a page that is currently in the trash. Without this guard the
    /// write would create a FRESH file in `pages/` — resurrecting the page as
    /// a duplicate of the trashed one, with two files sharing an id. This is
    /// the backend half of "a trashed page cannot be edited"; the read-only
    /// UI is the other half, and neither alone is sufficient.
    pub fn save_page(&self, page: &Page) -> AppResult<()> {
        if self.is_trashed(&page.id) {
            return Err(AppError::PageInTrash(page.id.clone()));
        }
        pages::write_page(&self.pages_dir(), page)
    }

    /// Every id currently in use, live or trashed.
    ///
    /// Spans BOTH directories: if trashed ids were left out, a new page
    /// could be minted with a trashed page's id; restoring later would put
    /// two files with one id on disk, and `find_page_file` would return
    /// whichever `read_dir` yielded first.
    fn existing_page_ids(&self) -> AppResult<Vec<String>> {
        let live = pages::list_pages(&self.pages_dir())?;
        let trashed = pages::list_pages(&self.trash_dir())?;
        Ok(live.iter().chain(trashed.iter()).map(|p| p.id.clone()).collect())
    }

    /// Create a new page with the given name, returning it.
    pub fn create_page(&self, name: &str) -> AppResult<Page> {
        let pages_dir = self.pages_dir();

        let existing_ids = self.existing_page_ids()?;
        let existing_ids: Vec<&str> = existing_ids.iter().map(|id| id.as_str()).collect();
        let id = shared::id::generate_unique_id(&existing_ids);

        let page = Page {
            id,
            name: name.into(),
            body: shared::content::Document::empty(),
            choices: vec![],
            flag_operations: vec![],
            editor: None,
            last_modified: None,
        };
        pages::write_page(&pages_dir, &page)?;
        Ok(page)
    }

    /// Soft-delete: move the page's file into `trash/`.
    pub fn trash_page(&self, id: &str) -> AppResult<()> {
        pages::move_page(&self.pages_dir(), &self.trash_dir(), id)
    }

    /// Move a trashed page's file back into `pages/`.
    pub fn restore_page(&self, id: &str) -> AppResult<()> {
        // `create_page` is supposed to make this impossible by never minting
        // a trashed id. This is the second line of defence, so a bug there
        // surfaces as an error instead of two files sharing an id.
        if pages::find_page_file(&self.pages_dir(), id).is_ok() {
            return Err(AppError::PageIdInUse(id.into()));
        }
        pages::move_page(&self.trash_dir(), &self.pages_dir(), id)
    }

    /// Permanently remove one page from the trash.
    pub fn delete_trashed_page(&self, id: &str) -> AppResult<()> {
        pages::delete_page(&self.trash_dir(), id)
    }

    /// Permanently remove every page from the trash.
    pub fn empty_trash(&self) -> AppResult<()> {
        for item in self.list_trashed_pages()? {
            pages::delete_page(&self.trash_dir(), &item.id)?;
        }
        Ok(())
    }

    /// List the trash, newest first, ties broken by name.
    ///
    /// `last_modified` is `Option`, and `None` sorts last under this
    /// comparison (a page file predating the timestamp field has no claim to
    /// being recent). RFC3339 with fixed precision sorts lexicographically in
    /// chronological order, so no parsing is needed.
    pub fn list_trashed_pages(&self) -> AppResult<Vec<PageListItem>> {
        let mut items = pages::list_pages(&self.trash_dir())?;
        items.sort_by(|a, b| {
            b.last_modified
                .cmp(&a.last_modified)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(items)
    }

    /// Read a full page from the trash by ID.
    pub fn read_trashed_page(&self, id: &str) -> AppResult<Page> {
        pages::read_page(&self.trash_dir(), id)
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

    /// Clear every page's saved editor position, in one pass, so the map's
    /// "Auto-arrange" control can return to a clean dagre layout.
    ///
    /// One `save_page` per changed page (not per page in the project): only
    /// pages that actually carried a position are rewritten, and this is
    /// still a single command round-trip from the frontend rather than one
    /// `save_page` invocation per node — a few hundred sequential round-trips
    /// would be unacceptable for a single button click.
    pub fn clear_editor_positions(&self) -> AppResult<()> {
        for item in self.list_pages()? {
            let mut page = self.read_page(&item.id)?;
            let had_position = page
                .editor
                .as_ref()
                .and_then(|e| e.position.as_ref())
                .is_some();
            if !had_position {
                continue;
            }
            if let Some(editor) = page.editor.as_mut() {
                editor.position = None;
            }
            self.save_page(&page)?;
        }
        Ok(())
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
    fn clear_editor_positions_clears_positioned_pages_and_leaves_others_untouched() {
        use shared::models::{EditorMetadata, Position};

        let tmp = TempDir::new().unwrap();
        let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Title").unwrap();

        // The page `create` seeds has no editor metadata at all. Give it a
        // saved position, and add a second page that never got one, so the
        // test covers both "had a position" and "never had one".
        let start_id = project.story().start_page;
        let mut start_page = project.read_page(&start_id).unwrap();
        start_page.editor = Some(EditorMetadata {
            position: Some(Position { x: 12.0, y: 34.0 }),
        });
        project.save_page(&start_page).unwrap();

        let unpositioned = project.create_page("Second").unwrap();
        assert!(unpositioned.editor.is_none());

        project.clear_editor_positions().unwrap();

        let reread_start = project.read_page(&start_id).unwrap();
        assert!(
            reread_start
                .editor
                .as_ref()
                .and_then(|e| e.position.as_ref())
                .is_none(),
            "position must be cleared"
        );

        let reread_second = project.read_page(&unpositioned.id).unwrap();
        assert!(
            reread_second.editor.is_none(),
            "still has no editor metadata"
        );
    }

    fn project_with_pages() -> (TempDir, Project) {
        let tmp = TempDir::new().unwrap();
        let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Title").unwrap();
        (tmp, project)
    }

    #[test]
    fn trash_page_moves_it_out_of_the_live_list() {
        let (_tmp, project) = project_with_pages();
        let doomed = project.create_page("Doomed").unwrap();

        project.trash_page(&doomed.id).unwrap();

        let live: Vec<String> = project
            .list_pages()
            .unwrap()
            .into_iter()
            .map(|p| p.id)
            .collect();
        assert!(!live.contains(&doomed.id), "trashed page must leave pages/");

        let trashed: Vec<String> = project
            .list_trashed_pages()
            .unwrap()
            .into_iter()
            .map(|p| p.id)
            .collect();
        assert_eq!(trashed, vec![doomed.id.clone()]);
    }

    #[test]
    fn trash_then_restore_round_trips_content() {
        let (_tmp, project) = project_with_pages();
        let mut page = project.create_page("Storeroom").unwrap();
        page.choices.push(shared::models::Choice {
            id: "c1a2b".into(),
            text: "Go north".into(),
            target: "zzzzz".into(),
            flag_operations: vec![],
            conditions: vec![],
        });
        project.save_page(&page).unwrap();
        let before = project.read_page(&page.id).unwrap();

        project.trash_page(&page.id).unwrap();
        project.restore_page(&page.id).unwrap();

        let after = project.read_page(&page.id).unwrap();
        assert_eq!(after.name, before.name);
        assert_eq!(after.choices, before.choices);
        assert_eq!(after.body, before.body);
        assert!(project.list_trashed_pages().unwrap().is_empty());
    }

    #[test]
    fn trashing_restamps_last_modified() {
        let (_tmp, project) = project_with_pages();
        let page = project.create_page("Doomed").unwrap();

        // Force a known, deliberately-old stamp so the assertion below can't
        // pass by accident: two real `now()` calls are almost always
        // increasing anyway, so `after >= before` would still pass even if
        // `move_page` preserved the old timestamp and never restamped at
        // all. Pinning `before` rules that out.
        let old_stamp = "2020-01-01T00:00:00.000Z";
        let pages_dir = project.dir.join("pages");
        crate::project::pages::write_page_at(&pages_dir, &page, old_stamp).unwrap();

        project.trash_page(&page.id).unwrap();
        let after = project
            .read_trashed_page(&page.id)
            .unwrap()
            .last_modified
            .expect("write must stamp");

        assert_ne!(
            after, old_stamp,
            "the move is a write, so it must not preserve the old stamp"
        );
        assert!(
            after.as_str() > old_stamp,
            "the fresh stamp must be later than the pinned old one"
        );
    }

    #[test]
    fn save_page_refuses_a_trashed_page() {
        let (_tmp, project) = project_with_pages();
        let page = project.create_page("Doomed").unwrap();
        project.trash_page(&page.id).unwrap();

        // Without this guard, saving would write a FRESH file into pages/ and
        // resurrect the page as a duplicate of the trashed one.
        let result = project.save_page(&page);

        match result {
            Err(AppError::PageInTrash(id)) => assert_eq!(id, page.id),
            other => panic!("Expected PageInTrash, got: {other:?}"),
        }
        assert!(
            project.list_pages().unwrap().iter().all(|p| p.id != page.id),
            "the refused save must not have created a live file"
        );
    }

    #[test]
    fn existing_page_ids_spans_both_live_and_trashed_pages() {
        // Deterministic test for the guard `create_page` relies on: if the
        // trash half of the union in `existing_page_ids` were removed, this
        // fails every run, unlike a statistical test that hopes a random
        // mint collides with a trashed id.
        let (_tmp, project) = project_with_pages();
        let doomed = project.create_page("Doomed").unwrap();
        project.trash_page(&doomed.id).unwrap();
        let live = project.create_page("Fresh").unwrap();

        let existing_ids = project.existing_page_ids().unwrap();

        assert!(
            existing_ids.contains(&doomed.id),
            "must include trashed ids, or a fresh mint could reuse one"
        );
        assert!(existing_ids.contains(&live.id), "must include live ids");
    }

    #[test]
    fn restore_refuses_when_the_id_is_already_live() {
        let (_tmp, project) = project_with_pages();
        let page = project.create_page("Doomed").unwrap();
        project.trash_page(&page.id).unwrap();

        // Force the collision create_page is designed to prevent, to prove
        // restore is a second line of defence and not just an assumption.
        let pages_dir = project.dir.join("pages");
        crate::project::pages::write_page(&pages_dir, &page).unwrap();

        match project.restore_page(&page.id) {
            Err(AppError::PageIdInUse(id)) => assert_eq!(id, page.id),
            other => panic!("Expected PageIdInUse, got: {other:?}"),
        }
    }

    #[test]
    fn delete_trashed_page_removes_it_for_good() {
        let (_tmp, project) = project_with_pages();
        let page = project.create_page("Doomed").unwrap();
        project.trash_page(&page.id).unwrap();

        project.delete_trashed_page(&page.id).unwrap();

        assert!(project.list_trashed_pages().unwrap().is_empty());
        assert!(project.read_trashed_page(&page.id).is_err());
    }

    #[test]
    fn empty_trash_removes_everything_and_leaves_live_pages_alone() {
        let (_tmp, project) = project_with_pages();
        let keeper = project.create_page("Keeper").unwrap();
        for n in 0..3 {
            let p = project.create_page(&format!("Doomed {n}")).unwrap();
            project.trash_page(&p.id).unwrap();
        }

        project.empty_trash().unwrap();

        assert!(project.list_trashed_pages().unwrap().is_empty());
        assert!(project.read_page(&keeper.id).is_ok());
    }

    #[test]
    fn list_trashed_pages_is_newest_first_then_by_name() {
        use crate::project::pages::write_page_at;

        let (_tmp, project) = project_with_pages();
        let trash_dir = project.dir.join("trash");
        std::fs::create_dir_all(&trash_dir).unwrap();

        let mk = |id: &str, name: &str, stamp: &str| {
            let page = Page {
                id: id.into(),
                name: name.into(),
                body: shared::content::Document::empty(),
                choices: vec![],
                flag_operations: vec![],
                editor: None,
                last_modified: None,
            };
            write_page_at(&trash_dir, &page, stamp).unwrap();
        };
        mk("aaa11", "Older", "2026-08-01T00:00:00.000Z");
        mk("bbb22", "Zebra", "2026-08-27T00:00:00.000Z");
        mk("ccc33", "Apple", "2026-08-27T00:00:00.000Z");

        let names: Vec<String> = project
            .list_trashed_pages()
            .unwrap()
            .into_iter()
            .map(|p| p.name)
            .collect();

        // Newest first; the two same-instant entries break the tie by name.
        assert_eq!(names, vec!["Apple", "Zebra", "Older"]);
    }

    #[test]
    fn list_trashed_pages_is_empty_when_no_trash_directory_exists() {
        let (_tmp, project) = project_with_pages();
        assert!(!project.dir.join("trash").exists());
        assert!(project.list_trashed_pages().unwrap().is_empty());
    }

    #[test]
    fn opening_a_project_does_not_create_a_trash_directory() {
        // Lazy creation matters: opening the checked-in lantern-loop fixture
        // must not modify it.
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("p");
        Project::create(dir.to_str().unwrap(), "Title").unwrap();
        let reopened = Project::open(dir.join("story.json").to_str().unwrap()).unwrap();
        assert!(!reopened.dir.join("trash").exists());
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
