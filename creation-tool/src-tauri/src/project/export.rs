use std::collections::HashMap;

use shared::bundle::{build_manifest, pack_bundle, BundleContents};

use crate::error::{AppError, AppResult};

use super::Project;

/// Export the project as a .fabler bundle to the given output path.
pub fn export_bundle(project: &Project, output_path: &str) -> AppResult<()> {
    let story = project.story();
    let all_pages = project.read_all_pages()?;

    // The frontend pre-checks and shows a dialog, but export is a backend
    // operation: refusing here is what makes the block a guarantee rather
    // than a suggestion. Warnings never block.
    let trashed = project.list_trashed_pages()?;
    let report = shared::validation::validate(&story, &all_pages, &trashed);
    if report.has_errors() {
        return Err(AppError::ExportBlocked(report.error_count()));
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
        unpack_bundle(&std::fs::read(out).unwrap())
            .unwrap()
            .manifest
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

        assert!(
            !ma.story.id.is_empty(),
            "exported story id must not be empty"
        );
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

    #[test]
    fn export_is_blocked_when_the_story_has_errors() {
        let tmp = TempDir::new().unwrap();
        let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Story").unwrap();

        // Point the start page's only choice at a page that does not exist.
        let mut start = project.read_page(&project.story().start_page).unwrap();
        start.choices.push(shared::models::Choice {
            id: "c1".into(),
            text: "Go nowhere".into(),
            target: "gone9".into(),
            flag_operations: vec![],
            conditions: vec![],
        });
        project.save_page(&start).unwrap();

        let out = tmp.path().join("blocked.fabler");
        let result = project.export_bundle(out.to_str().unwrap());

        assert!(result.is_err(), "export must refuse a story with errors");
        assert!(!out.exists(), "a blocked export must not write a file");
    }

    #[test]
    fn export_succeeds_when_the_only_problems_are_warnings() {
        let tmp = TempDir::new().unwrap();
        let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Story").unwrap();

        // An extra page nothing links to is a warning, not an error.
        project.create_page("Orphan").unwrap();

        let out = tmp.path().join("ok.fabler");
        project.export_bundle(out.to_str().unwrap()).unwrap();

        assert!(out.exists());
        assert!(project
            .validate()
            .unwrap()
            .problems
            .iter()
            .any(|p| { p.detail == shared::validation::ProblemDetail::UnreachablePage }));
    }

    /// The load-bearing test for the whole trash design: a bundle is built
    /// from `pages/` only, so nothing in `trash/` can reach a reader. This is
    /// what keeps the directory split a maintained guarantee rather than a
    /// claim in a design doc.
    #[test]
    fn export_excludes_trashed_pages() {
        let tmp = TempDir::new().unwrap();
        let project =
            Project::create(tmp.path().join("p").to_str().unwrap(), "Title").unwrap();
        let keeper = project.create_page("Keeper").unwrap();
        let doomed = project.create_page("Doomed").unwrap();
        project.trash_page(&doomed.id).unwrap();

        let out = tmp.path().join("story.fabler");
        export_bundle(&project, out.to_str().unwrap()).unwrap();

        let bytes = std::fs::read(&out).unwrap();
        let unpacked = unpack_bundle(&bytes).unwrap();
        let ids: Vec<&str> = unpacked
            .manifest
            .pages
            .iter()
            .map(|p| p.id.as_str())
            .collect();

        assert!(ids.contains(&keeper.id.as_str()));
        assert!(
            !ids.contains(&doomed.id.as_str()),
            "a trashed page reached the bundle: {ids:?}"
        );
    }
}
