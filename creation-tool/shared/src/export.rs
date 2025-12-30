use serde::{Deserialize, Serialize};

/// Exported story structure optimized for TOML serialization
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedStory {
    pub story: StoryMetadata,
    pub pages: Vec<ExportedPage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoryMetadata {
    pub title: String,
    pub start_page: String, // Page name, not ID
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedPage {
    pub name: String,
    pub content: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub choices: Vec<ExportedChoice>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedChoice {
    pub text: String,
    pub target: String, // Page name, not ID
}
