use serde::{Deserialize, Serialize};
use crate::models::{Flag, Page};

/// Exported story structure optimized for TOML serialization
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedStory {
    pub story: StoryMetadata,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub flags: Vec<Flag>,
    pub pages: Vec<Page>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoryMetadata {
    pub id: i64,
    pub title: String,
    pub start_page: i64,
}
