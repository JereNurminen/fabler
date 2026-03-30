use std::collections::HashMap;
use std::io::{Cursor, Read, Write};

use serde::{Deserialize, Serialize};

use crate::models::{Flag, Page};

/// The bundle manifest — a self-contained story with all pages inline.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Manifest {
    pub format_version: u32,
    pub story: ManifestStory,
    #[serde(default)]
    pub flags: Vec<Flag>,
    pub pages: Vec<Page>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestStory {
    pub id: String,
    pub title: String,
    pub start_page: String,
}

/// Build a Manifest from a Story and its pages.
pub fn build_manifest(story: &crate::models::Story, pages: Vec<Page>) -> Manifest {
    Manifest {
        format_version: story.format_version,
        story: ManifestStory {
            id: "export".into(),
            title: story.title.clone(),
            start_page: story.start_page.clone(),
        },
        flags: story.flags.clone(),
        pages,
    }
}

#[derive(Debug)]
pub struct BundleContents {
    pub manifest: Manifest,
    pub assets: HashMap<String, Vec<u8>>,
}

/// Pack a manifest and assets into a .fabler zip archive (in memory).
pub fn pack_bundle(contents: &BundleContents) -> Result<Vec<u8>, BundleError> {
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut buf);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let manifest_json = serde_json::to_string_pretty(&contents.manifest)
            .map_err(|e| BundleError::Serialize(e.to_string()))?;
        zip.start_file("manifest.json", options)
            .map_err(|e| BundleError::Zip(e.to_string()))?;
        zip.write_all(manifest_json.as_bytes())
            .map_err(|e| BundleError::Io(e.to_string()))?;

        for (name, data) in &contents.assets {
            zip.start_file(format!("assets/{name}"), options)
                .map_err(|e| BundleError::Zip(e.to_string()))?;
            zip.write_all(data)
                .map_err(|e| BundleError::Io(e.to_string()))?;
        }

        zip.finish().map_err(|e| BundleError::Zip(e.to_string()))?;
    }
    Ok(buf.into_inner())
}

/// Unpack a .fabler zip archive from bytes.
pub fn unpack_bundle(data: &[u8]) -> Result<BundleContents, BundleError> {
    let cursor = Cursor::new(data);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| BundleError::Zip(e.to_string()))?;

    let manifest: Manifest = {
        let mut file = archive
            .by_name("manifest.json")
            .map_err(|_| BundleError::MissingManifest)?;
        let mut json = String::new();
        file.read_to_string(&mut json)
            .map_err(|e| BundleError::Io(e.to_string()))?;
        serde_json::from_str(&json).map_err(|e| BundleError::Deserialize(e.to_string()))?
    };

    let mut assets = HashMap::new();
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| BundleError::Zip(e.to_string()))?;
        let name = file.name().to_string();
        if let Some(asset_name) = name.strip_prefix("assets/") {
            if !asset_name.is_empty() && !file.is_dir() {
                let mut data = Vec::new();
                file.read_to_end(&mut data)
                    .map_err(|e| BundleError::Io(e.to_string()))?;
                assets.insert(asset_name.to_string(), data);
            }
        }
    }

    Ok(BundleContents { manifest, assets })
}

#[derive(Debug, thiserror::Error)]
pub enum BundleError {
    #[error("Serialization error: {0}")]
    Serialize(String),
    #[error("Deserialization error: {0}")]
    Deserialize(String),
    #[error("Zip error: {0}")]
    Zip(String),
    #[error("IO error: {0}")]
    Io(String),
    #[error("Bundle is missing manifest.json")]
    MissingManifest,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;

    fn sample_story() -> crate::models::Story {
        crate::models::Story {
            format_version: 1,
            title: "Test Story".into(),
            start_page: "p1".into(),
            flags: vec![Flag {
                id: "f1".into(),
                name: "has_key".into(),
                default_value: false,
            }],
        }
    }

    fn sample_pages() -> Vec<Page> {
        vec![
            Page {
                id: "p1".into(),
                name: "Start".into(),
                body: "You are here.".into(),
                choices: vec![Choice {
                    id: "c1".into(),
                    text: "Go".into(),
                    target: "p2".into(),
                    flag_operations: vec![FlagOperation {
                        flag_id: "f1".into(),
                        operation: "set_true".into(),
                    }],
                    conditions: vec![],
                }],
                flag_operations: vec![],
            },
            Page {
                id: "p2".into(),
                name: "End".into(),
                body: "The end.".into(),
                choices: vec![],
                flag_operations: vec![],
            },
        ]
    }

    #[test]
    fn build_manifest_from_story_and_pages() {
        let story = sample_story();
        let pages = sample_pages();
        let manifest = build_manifest(&story, pages.clone());
        assert_eq!(manifest.format_version, 1);
        assert_eq!(manifest.story.title, "Test Story");
        assert_eq!(manifest.story.start_page, "p1");
        assert_eq!(manifest.flags.len(), 1);
        assert_eq!(manifest.pages.len(), 2);
        assert_eq!(manifest.pages[0].choices[0].target, "p2");
    }

    #[test]
    fn bundle_round_trip() {
        let manifest = build_manifest(&sample_story(), sample_pages());
        let mut assets = HashMap::new();
        assets.insert("hero.png".into(), vec![0x89, 0x50, 0x4E, 0x47]);

        let contents = BundleContents { manifest: manifest.clone(), assets };
        let packed = pack_bundle(&contents).unwrap();
        let unpacked = unpack_bundle(&packed).unwrap();

        assert_eq!(manifest, unpacked.manifest);
        assert_eq!(unpacked.assets.get("hero.png"), Some(&vec![0x89, 0x50, 0x4E, 0x47]));
    }

    #[test]
    fn unpack_missing_manifest_fails() {
        let mut buf = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buf);
            let options = zip::write::SimpleFileOptions::default();
            zip.start_file("not-manifest.txt", options).unwrap();
            zip.write_all(b"hello").unwrap();
            zip.finish().unwrap();
        }
        let result = unpack_bundle(&buf.into_inner());
        assert!(matches!(result, Err(BundleError::MissingManifest)));
    }
}
