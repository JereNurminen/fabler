use std::collections::HashMap;

use shared::bundle::{build_manifest, pack_bundle, BundleContents};

use crate::error::AppResult;

use super::Project;

/// Export the project as a .fabler bundle to the given output path.
pub fn export_bundle(project: &Project, output_path: &str) -> AppResult<()> {
    let story = project.story();
    let page_list = project.list_pages()?;

    let mut all_pages = Vec::new();
    for item in &page_list {
        let page = project.read_page(&item.id)?;
        all_pages.push(page);
    }

    let manifest = build_manifest(&story, all_pages);

    // Include all files from the assets directory
    let mut assets: HashMap<String, Vec<u8>> = HashMap::new();
    let assets_dir = project.get_assets_dir();
    if assets_dir.exists() {
        for entry in std::fs::read_dir(&assets_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let data = std::fs::read(&path)?;
                    assets.insert(name.to_string(), data);
                }
            }
        }
    }

    let contents = BundleContents { manifest, assets };
    let data = pack_bundle(&contents)?;
    std::fs::write(output_path, data)?;
    Ok(())
}
