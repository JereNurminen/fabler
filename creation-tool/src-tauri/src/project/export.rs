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

#[cfg(test)]
mod tests {
    use super::*;
    use shared::bundle::unpack_bundle;
    use tempfile::TempDir;

    fn export_of(project: &Project, out: &std::path::Path) -> shared::bundle::Manifest {
        project.export_bundle(out.to_str().unwrap()).unwrap();
        unpack_bundle(&std::fs::read(out).unwrap()).unwrap().manifest
    }

    #[test]
    fn separate_projects_export_distinct_story_ids() {
        // Regression: every export used to claim the story id "export", which
        // made two different stories indistinguishable to the reader.
        let tmp = TempDir::new().unwrap();
        let a = Project::create(tmp.path().join("a").to_str().unwrap(), "Story A").unwrap();
        let b = Project::create(tmp.path().join("b").to_str().unwrap(), "Story B").unwrap();

        let ma = export_of(&a, &tmp.path().join("a.fabler"));
        let mb = export_of(&b, &tmp.path().join("b.fabler"));

        assert!(!ma.story.id.is_empty(), "exported story id must not be empty");
        assert_ne!(
            ma.story.id, mb.story.id,
            "two independent projects must not export the same story id"
        );
        assert_eq!(ma.story.title, "Story A");
        assert_eq!(mb.story.title, "Story B");
    }

    #[test]
    fn re_exporting_one_project_keeps_its_story_id() {
        // The flip side: a reader keys installs by story id, so re-exporting
        // the same project must keep updating that story in place.
        let tmp = TempDir::new().unwrap();
        let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Story").unwrap();

        let first = export_of(&project, &tmp.path().join("1.fabler"));
        let second = export_of(&project, &tmp.path().join("2.fabler"));

        assert_eq!(first.story.id, second.story.id);
    }
}
