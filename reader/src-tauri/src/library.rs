use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use shared::bundle::{unpack_bundle, Manifest};

use crate::error::{ReaderError, ReaderResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledStory {
    pub id: String,
    pub title: String,
    pub path: String,
}

pub struct Library {
    pub stories_dir: PathBuf,
}

impl Library {
    pub fn new(app_data_dir: &Path) -> ReaderResult<Self> {
        let stories_dir = app_data_dir.join("stories");
        fs::create_dir_all(&stories_dir)?;
        Ok(Self { stories_dir })
    }

    pub fn install_bundle(&self, bundle_data: &[u8]) -> ReaderResult<InstalledStory> {
        let contents = unpack_bundle(bundle_data)?;
        let manifest = &contents.manifest;
        let story_id = &manifest.story.id;

        let story_dir = self.stories_dir.join(story_id);

        // Overwrite if already installed
        if story_dir.exists() {
            fs::remove_dir_all(&story_dir)?;
        }
        fs::create_dir_all(&story_dir)?;

        // Write manifest.json
        let manifest_path = story_dir.join("manifest.json");
        let manifest_json = serde_json::to_vec_pretty(manifest)?;
        fs::write(&manifest_path, &manifest_json)?;

        // Write assets
        let assets_dir = story_dir.join("assets");
        if !contents.assets.is_empty() {
            fs::create_dir_all(&assets_dir)?;
            for (name, data) in &contents.assets {
                let asset_path = assets_dir.join(name);
                fs::write(asset_path, data)?;
            }
        }

        // Create saves directory
        let saves_dir = story_dir.join("saves");
        fs::create_dir_all(&saves_dir)?;

        Ok(InstalledStory {
            id: story_id.clone(),
            title: manifest.story.title.clone(),
            path: story_dir.to_string_lossy().into_owned(),
        })
    }

    pub fn list_stories(&self) -> ReaderResult<Vec<InstalledStory>> {
        let mut stories = Vec::new();

        let entries = match fs::read_dir(&self.stories_dir) {
            Ok(e) => e,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
            Err(err) => return Err(ReaderError::Io(err)),
        };

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("manifest.json");
            let manifest_data = match fs::read(&manifest_path) {
                Ok(data) => data,
                Err(_) => continue, // skip corrupted/missing manifest
            };

            let manifest: Manifest = match serde_json::from_slice(&manifest_data) {
                Ok(m) => m,
                Err(_) => continue, // skip corrupted manifest
            };

            stories.push(InstalledStory {
                id: manifest.story.id.clone(),
                title: manifest.story.title.clone(),
                path: path.to_string_lossy().into_owned(),
            });
        }

        stories.sort_by(|a, b| a.title.cmp(&b.title));
        Ok(stories)
    }

    pub fn get_manifest(&self, story_id: &str) -> ReaderResult<Manifest> {
        let manifest_path = self.stories_dir.join(story_id).join("manifest.json");
        if !manifest_path.exists() {
            return Err(ReaderError::StoryNotFound(story_id.to_string()));
        }
        let data = fs::read(&manifest_path)?;
        let manifest: Manifest = serde_json::from_slice(&data)?;
        Ok(manifest)
    }

    pub fn get_asset_path(&self, story_id: &str, asset_name: &str) -> ReaderResult<PathBuf> {
        let story_dir = self.stories_dir.join(story_id);
        if !story_dir.exists() {
            return Err(ReaderError::StoryNotFound(story_id.to_string()));
        }
        let asset_path = story_dir.join("assets").join(asset_name);
        Ok(asset_path)
    }

    pub fn delete_story(&self, story_id: &str) -> ReaderResult<()> {
        let story_dir = self.stories_dir.join(story_id);
        if !story_dir.exists() {
            return Err(ReaderError::StoryNotFound(story_id.to_string()));
        }
        fs::remove_dir_all(&story_dir)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use shared::bundle::{pack_bundle, BundleContents, Manifest, ManifestStory};
    use shared::models::Page;

    use super::*;

    fn make_manifest(id: &str, title: &str) -> Manifest {
        Manifest {
            format_version: 1,
            story: ManifestStory {
                id: id.to_string(),
                title: title.to_string(),
                start_page: "page-1".to_string(),
            },
            flags: vec![],
            pages: vec![Page {
                id: "page-1".to_string(),
                name: "Start".to_string(),
                body: shared::content::Document::from_plain_text("You begin your adventure."),
                choices: vec![],
                flag_operations: vec![],
            }],
        }
    }

    fn make_bundle(id: &str, title: &str) -> Vec<u8> {
        make_bundle_with_assets(id, title, HashMap::new())
    }

    fn make_bundle_with_assets(id: &str, title: &str, assets: HashMap<String, Vec<u8>>) -> Vec<u8> {
        let contents = BundleContents {
            manifest: make_manifest(id, title),
            assets,
        };
        pack_bundle(&contents).expect("pack_bundle")
    }

    #[test]
    fn install_and_list() {
        let tmp = tempfile::TempDir::new().unwrap();
        let lib = Library::new(tmp.path()).unwrap();

        let bundle = make_bundle("story-1", "Alpha Story");
        let installed = lib.install_bundle(&bundle).unwrap();
        assert_eq!(installed.id, "story-1");
        assert_eq!(installed.title, "Alpha Story");

        let bundle2 = make_bundle("story-2", "Beta Story");
        lib.install_bundle(&bundle2).unwrap();

        let stories = lib.list_stories().unwrap();
        assert_eq!(stories.len(), 2);
        // sorted by title
        assert_eq!(stories[0].title, "Alpha Story");
        assert_eq!(stories[1].title, "Beta Story");
    }

    #[test]
    fn two_exported_stories_install_side_by_side() {
        // Regression: bundles are keyed by manifest.story.id on install. When
        // build_manifest hardcoded that id, installing a second story silently
        // deleted the first. Build the bundles through the real export path
        // rather than a hand-written manifest so the wiring is covered.
        use shared::bundle::build_manifest;
        use shared::models::Story;

        let tmp = tempfile::TempDir::new().unwrap();
        let lib = Library::new(tmp.path()).unwrap();

        let mut made = |id: &str, title: &str| {
            let story = Story {
                format_version: 1,
                id: id.to_string(),
                title: title.to_string(),
                start_page: "page-1".to_string(),
                flags: vec![],
            };
            let pages = vec![Page {
                id: "page-1".to_string(),
                name: "Start".to_string(),
                body: shared::content::Document::from_plain_text("Begin."),
                choices: vec![],
                flag_operations: vec![],
            }];
            let contents = BundleContents {
                manifest: build_manifest(&story, pages),
                assets: HashMap::new(),
            };
            pack_bundle(&contents).expect("pack_bundle")
        };

        let first = made("aaa11", "First Story");
        let second = made("bbb22", "Second Story");

        lib.install_bundle(&first).unwrap();
        lib.install_bundle(&second).unwrap();

        let stories = lib.list_stories().unwrap();
        assert_eq!(stories.len(), 2, "installing a second story must not evict the first");
        assert_eq!(stories[0].title, "First Story");
        assert_eq!(stories[1].title, "Second Story");

        // Each keeps its own manifest, so save slots stay separate too.
        assert_eq!(lib.get_manifest("aaa11").unwrap().story.title, "First Story");
        assert_eq!(lib.get_manifest("bbb22").unwrap().story.title, "Second Story");
    }

    #[test]
    fn install_with_assets() {
        let tmp = tempfile::TempDir::new().unwrap();
        let lib = Library::new(tmp.path()).unwrap();

        let mut assets = HashMap::new();
        assets.insert("cover.png".to_string(), b"fake png".to_vec());
        assets.insert("sound.ogg".to_string(), b"fake ogg".to_vec());

        let bundle = make_bundle_with_assets("story-assets", "Asset Story", assets);
        let installed = lib.install_bundle(&bundle).unwrap();

        let asset_path = lib
            .get_asset_path(&installed.id, "cover.png")
            .unwrap();
        assert!(asset_path.exists());

        let data = fs::read(&asset_path).unwrap();
        assert_eq!(data, b"fake png");

        let ogg_path = lib.get_asset_path(&installed.id, "sound.ogg").unwrap();
        assert!(ogg_path.exists());
    }

    #[test]
    fn get_manifest() {
        let tmp = tempfile::TempDir::new().unwrap();
        let lib = Library::new(tmp.path()).unwrap();

        let bundle = make_bundle("story-manifest", "Manifest Story");
        lib.install_bundle(&bundle).unwrap();

        let manifest = lib.get_manifest("story-manifest").unwrap();
        assert_eq!(manifest.story.id, "story-manifest");
        assert_eq!(manifest.story.title, "Manifest Story");
        assert_eq!(manifest.pages.len(), 1);
    }

    #[test]
    fn delete_story() {
        let tmp = tempfile::TempDir::new().unwrap();
        let lib = Library::new(tmp.path()).unwrap();

        let bundle = make_bundle("story-delete", "Delete Me");
        lib.install_bundle(&bundle).unwrap();

        let stories = lib.list_stories().unwrap();
        assert_eq!(stories.len(), 1);

        lib.delete_story("story-delete").unwrap();

        let stories = lib.list_stories().unwrap();
        assert_eq!(stories.len(), 0);
    }

    #[test]
    fn reinstall_overwrites() {
        let tmp = tempfile::TempDir::new().unwrap();
        let lib = Library::new(tmp.path()).unwrap();

        let bundle_v1 = make_bundle("story-overwrite", "Old Title");
        lib.install_bundle(&bundle_v1).unwrap();

        // Install updated bundle with same id but different title
        let bundle_v2 = {
            let contents = BundleContents {
                manifest: Manifest {
                    format_version: 1,
                    story: ManifestStory {
                        id: "story-overwrite".to_string(),
                        title: "New Title".to_string(),
                        start_page: "page-1".to_string(),
                    },
                    flags: vec![],
                    pages: vec![Page {
                        id: "page-1".to_string(),
                        name: "Start".to_string(),
                        body: shared::content::Document::from_plain_text("Updated content."),
                        choices: vec![],
                        flag_operations: vec![],
                    }],
                },
                assets: HashMap::new(),
            };
            pack_bundle(&contents).expect("pack")
        };

        lib.install_bundle(&bundle_v2).unwrap();

        let stories = lib.list_stories().unwrap();
        assert_eq!(stories.len(), 1);
        assert_eq!(stories[0].title, "New Title");

        let manifest = lib.get_manifest("story-overwrite").unwrap();
        assert_eq!(manifest.story.title, "New Title");
        assert_eq!(manifest.pages[0].body, shared::content::Document::from_plain_text("Updated content."));
    }

    #[test]
    fn story_not_found() {
        let tmp = tempfile::TempDir::new().unwrap();
        let lib = Library::new(tmp.path()).unwrap();

        let result = lib.get_manifest("nonexistent-story");
        assert!(matches!(result, Err(ReaderError::StoryNotFound(_))));

        let result = lib.delete_story("nonexistent-story");
        assert!(matches!(result, Err(ReaderError::StoryNotFound(_))));
    }
}
