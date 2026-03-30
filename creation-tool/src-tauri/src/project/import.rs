use std::path::Path;

use shared::bundle::unpack_bundle;
use shared::models::Story;

use crate::error::AppResult;

use super::pages;
use super::story;

/// Import a .fabler bundle into a project directory.
///
/// Creates story.json and pages/ from the bundle contents.
pub fn import_bundle_to_project(bundle_data: &[u8], dir: &str) -> AppResult<()> {
    let dir = Path::new(dir);
    std::fs::create_dir_all(dir)?;

    let pages_dir = dir.join("pages");
    std::fs::create_dir_all(&pages_dir)?;

    let contents = unpack_bundle(bundle_data)?;
    let manifest = contents.manifest;

    // Write story.json
    let story_data = Story {
        format_version: manifest.format_version,
        title: manifest.story.title,
        start_page: manifest.story.start_page,
        flags: manifest.flags,
    };
    story::write_story(&dir.join("story.json"), &story_data)?;

    // Write each page
    for page in &manifest.pages {
        pages::write_page(&pages_dir, page)?;
    }

    // Write assets (if any)
    if !contents.assets.is_empty() {
        let assets_dir = dir.join("assets");
        std::fs::create_dir_all(&assets_dir)?;
        for (name, data) in &contents.assets {
            std::fs::write(assets_dir.join(name), data)?;
        }
    }

    Ok(())
}
