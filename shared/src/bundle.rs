use std::collections::HashMap;
use std::io::{Cursor, Read, Write};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::export::ExportedStory;

pub const CURRENT_FORMAT_VERSION: u32 = 1;

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Manifest {
    pub format_version: u32,
    pub story: ManifestStory,
    pub flags: Vec<ManifestFlag>,
    pub pages: Vec<ManifestPage>,
}

impl Manifest {
    pub fn new(story: ManifestStory, flags: Vec<ManifestFlag>, pages: Vec<ManifestPage>) -> Self {
        Self {
            format_version: CURRENT_FORMAT_VERSION,
            story,
            flags,
            pages,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestStory {
    pub id: String,
    pub title: String,
    pub start_page: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestFlag {
    pub id: String,
    pub name: String,
    pub default_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestPage {
    pub id: String,
    pub name: String,
    pub body: String,
    #[serde(default)]
    pub assets: Vec<String>,
    #[serde(default)]
    pub flag_operations: Vec<ManifestFlagOperation>,
    #[serde(default)]
    pub choices: Vec<ManifestChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestChoice {
    pub id: String,
    pub text: String,
    #[serde(alias = "target_page")]
    pub target: String,
    #[serde(default)]
    pub flag_operations: Vec<ManifestFlagOperation>,
    #[serde(default)]
    pub conditions: Vec<ManifestCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestFlagOperation {
    pub flag_id: String,
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManifestCondition {
    pub flag_id: String,
    pub required_value: bool,
}

// ---------------------------------------------------------------------------
// Conversion from ExportedStory
// ---------------------------------------------------------------------------

impl From<&ExportedStory> for Manifest {
    fn from(exported: &ExportedStory) -> Self {
        let story = ManifestStory {
            id: exported.story.id.to_string(),
            title: exported.story.title.clone(),
            start_page: exported.story.start_page.to_string(),
        };

        let flags = exported
            .flags
            .iter()
            .map(|f| ManifestFlag {
                id: f.id.to_string(),
                name: f.name.clone(),
                default_value: f.default_value,
            })
            .collect();

        let pages = exported
            .pages
            .iter()
            .map(|p| ManifestPage {
                id: p.id.to_string(),
                name: p.name.clone(),
                body: p.body.clone(),
                choices: p
                    .options
                    .iter()
                    .map(|c| ManifestChoice {
                        id: c.id.to_string(),
                        text: c.text.clone(),
                        target: c.target_page.to_string(),
                        flag_operations: c
                            .flag_operations
                            .iter()
                            .map(|fo| ManifestFlagOperation {
                                flag_id: fo.flag_id.to_string(),
                                operation: fo.operation.clone(),
                            })
                            .collect(),
                        conditions: c
                            .conditions
                            .iter()
                            .map(|cond| ManifestCondition {
                                flag_id: cond.flag_id.to_string(),
                                required_value: cond.required_value,
                            })
                            .collect(),
                    })
                    .collect(),
                assets: vec![],
                flag_operations: p
                    .flag_operations
                    .iter()
                    .map(|fo| ManifestFlagOperation {
                        flag_id: fo.flag_id.to_string(),
                        operation: fo.operation.clone(),
                    })
                    .collect(),
            })
            .collect();

        Manifest::new(story, flags, pages)
    }
}

// ---------------------------------------------------------------------------
// Bundle types
// ---------------------------------------------------------------------------

/// In-memory representation of a bundle (manifest + raw asset bytes).
#[derive(Debug)]
pub struct BundleContents {
    pub manifest: Manifest,
    /// Map of asset paths (relative, e.g. "image.png") to raw bytes.
    pub assets: HashMap<String, Vec<u8>>,
}

// ---------------------------------------------------------------------------
// Pack / unpack
// ---------------------------------------------------------------------------

/// Serialise a `BundleContents` into a zip archive stored in memory.
pub fn pack_bundle(contents: &BundleContents) -> Result<Vec<u8>, BundleError> {
    let buf = Vec::new();
    let cursor = Cursor::new(buf);
    let mut zip = ZipWriter::new(cursor);

    // Write manifest.json
    let manifest_json = serde_json::to_vec(&contents.manifest).map_err(BundleError::Serialize)?;
    zip.start_file("manifest.json", SimpleFileOptions::default())
        .map_err(BundleError::Zip)?;
    zip.write_all(&manifest_json).map_err(BundleError::Io)?;

    // Write each asset under assets/
    for (name, data) in &contents.assets {
        let path = format!("assets/{name}");
        zip.start_file(&path, SimpleFileOptions::default())
            .map_err(BundleError::Zip)?;
        zip.write_all(data).map_err(BundleError::Io)?;
    }

    let cursor = zip.finish().map_err(BundleError::Zip)?;
    Ok(cursor.into_inner())
}

/// Deserialise a zip archive (produced by `pack_bundle`) back into `BundleContents`.
pub fn unpack_bundle(data: &[u8]) -> Result<BundleContents, BundleError> {
    let cursor = Cursor::new(data);
    let mut zip = ZipArchive::new(cursor).map_err(BundleError::Zip)?;

    // --- extract manifest ---
    let manifest: Manifest = {
        let mut entry = zip
            .by_name("manifest.json")
            .map_err(|_| BundleError::MissingManifest)?;
        let mut raw = Vec::new();
        entry.read_to_end(&mut raw).map_err(BundleError::Io)?;
        serde_json::from_slice(&raw).map_err(BundleError::Deserialize)?
    };

    // --- extract assets ---
    let mut assets: HashMap<String, Vec<u8>> = HashMap::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(BundleError::Zip)?;
        let name = entry.name().to_owned();
        if name == "manifest.json" {
            continue;
        }
        if let Some(asset_name) = name.strip_prefix("assets/") {
            if asset_name.is_empty() {
                continue; // directory entry
            }
            let mut raw = Vec::new();
            entry.read_to_end(&mut raw).map_err(BundleError::Io)?;
            assets.insert(asset_name.to_owned(), raw);
        }
    }

    Ok(BundleContents { manifest, assets })
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum BundleError {
    #[error("serialization error: {0}")]
    Serialize(#[source] serde_json::Error),

    #[error("deserialization error: {0}")]
    Deserialize(#[source] serde_json::Error),

    #[error("zip error: {0}")]
    Zip(#[source] zip::result::ZipError),

    #[error("io error: {0}")]
    Io(#[source] std::io::Error),

    #[error("bundle is missing manifest.json")]
    MissingManifest,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::export::{ExportedStory, StoryMetadata};
    use crate::models::{Choice, ChoiceCondition, Flag, FlagOperation, Page};

    fn sample_manifest() -> Manifest {
        Manifest::new(
            ManifestStory {
                id: "1".into(),
                title: "Test Story".into(),
                start_page: "10".into(),
            },
            vec![ManifestFlag {
                id: "2".into(),
                name: "has_sword".into(),
                default_value: false,
            }],
            vec![ManifestPage {
                id: "10".into(),
                name: "Start".into(),
                body: "You stand at a crossroads.".into(),
                choices: vec![ManifestChoice {
                    id: "100".into(),
                    text: "Go north".into(),
                    target: "11".into(),
                    flag_operations: vec![],
                    conditions: vec![],
                }],
                assets: vec![],
                flag_operations: vec![],
            }],
        )
    }

    #[test]
    fn manifest_round_trip_json() {
        let original = sample_manifest();
        let json = serde_json::to_string(&original).expect("serialize");
        let restored: Manifest = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(original, restored);
    }

    #[test]
    fn bundle_round_trip_no_assets() {
        let contents = BundleContents {
            manifest: sample_manifest(),
            assets: HashMap::new(),
        };
        let packed = pack_bundle(&contents).expect("pack");
        let unpacked = unpack_bundle(&packed).expect("unpack");
        assert_eq!(unpacked.manifest, contents.manifest);
        assert!(unpacked.assets.is_empty());
    }

    #[test]
    fn bundle_round_trip_with_assets() {
        let mut assets = HashMap::new();
        assets.insert("cover.png".to_string(), b"fake png data".to_vec());
        assets.insert("sound.ogg".to_string(), b"fake ogg data".to_vec());

        let contents = BundleContents {
            manifest: sample_manifest(),
            assets,
        };
        let packed = pack_bundle(&contents).expect("pack");
        let unpacked = unpack_bundle(&packed).expect("unpack");

        assert_eq!(unpacked.manifest, contents.manifest);
        assert_eq!(unpacked.assets.len(), 2);
        assert_eq!(unpacked.assets["cover.png"], b"fake png data");
        assert_eq!(unpacked.assets["sound.ogg"], b"fake ogg data");
    }

    #[test]
    fn unpack_missing_manifest_fails() {
        // Create a zip that intentionally omits manifest.json
        let buf = Vec::new();
        let cursor = Cursor::new(buf);
        let mut zip = ZipWriter::new(cursor);
        zip.start_file("other.txt", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"hello").unwrap();
        let cursor = zip.finish().unwrap();
        let data = cursor.into_inner();

        let err = unpack_bundle(&data).expect_err("should fail");
        assert!(matches!(err, BundleError::MissingManifest));
    }

    #[test]
    fn conversion_from_exported_story() {
        let flag_op = FlagOperation {
            id: 1,
            flag_id: 2,
            operation: "set_true".into(),
        };
        let condition = ChoiceCondition {
            id: 3,
            flag_id: 2,
            required_value: true,
        };
        let choice = Choice {
            id: 10,
            page_id: 20,
            text: "Pick up sword".into(),
            target_page: 21,
            flag_operations: vec![flag_op.clone()],
            conditions: vec![condition.clone()],
        };
        let page = Page {
            id: 20,
            story_id: 99,
            name: "Armory".into(),
            body: "Weapons everywhere.".into(),
            options: vec![choice],
            flag_operations: vec![flag_op.clone()],
        };
        let flag = Flag {
            id: 2,
            story_id: 99,
            name: "has_sword".into(),
            default_value: false,
        };
        let exported = ExportedStory {
            story: StoryMetadata {
                id: 99,
                title: "Adventure".into(),
                start_page: 20,
            },
            flags: vec![flag],
            pages: vec![page],
        };

        let manifest = Manifest::from(&exported);

        assert_eq!(manifest.format_version, CURRENT_FORMAT_VERSION);
        assert_eq!(manifest.story.id, "99");
        assert_eq!(manifest.story.title, "Adventure");
        assert_eq!(manifest.story.start_page, "20");

        assert_eq!(manifest.flags.len(), 1);
        let mf = &manifest.flags[0];
        assert_eq!(mf.id, "2");
        assert_eq!(mf.name, "has_sword");
        assert!(!mf.default_value);

        assert_eq!(manifest.pages.len(), 1);
        let mp = &manifest.pages[0];
        assert_eq!(mp.id, "20");
        assert_eq!(mp.name, "Armory");
        assert_eq!(mp.flag_operations.len(), 1);
        assert_eq!(mp.flag_operations[0].operation, "set_true");

        assert_eq!(mp.choices.len(), 1);
        let mc = &mp.choices[0];
        assert_eq!(mc.id, "10");
        assert_eq!(mc.target, "21");
        assert_eq!(mc.flag_operations.len(), 1);
        assert_eq!(mc.conditions.len(), 1);
        assert!(mc.conditions[0].required_value);
    }
}
