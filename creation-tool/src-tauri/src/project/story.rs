use std::path::Path;

use shared::models::Story;

use crate::error::AppResult;

/// Read and parse a story.json file.
pub fn read_story(path: &Path) -> AppResult<Story> {
    let data = std::fs::read_to_string(path)?;
    let story: Story = serde_json::from_str(&data)?;
    Ok(story)
}

/// Serialize and write a story.json file.
pub fn write_story(path: &Path, story: &Story) -> AppResult<()> {
    let json = serde_json::to_string_pretty(story)?;
    std::fs::write(path, json)?;
    Ok(())
}
