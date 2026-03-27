use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{ReaderError, ReaderResult};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameStateData {
    #[serde(rename = "currentPageId")]
    pub current_page_id: String,
    pub flags: HashMap<String, bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedState {
    #[serde(rename = "gameState")]
    pub game_state: GameStateData,
    pub name: String,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SlotInfo {
    #[serde(rename = "slotId")]
    pub slot_id: String,
    pub name: String,
    pub timestamp: u64,
}

pub struct SaveStorage {
    stories_dir: PathBuf,
}

impl SaveStorage {
    pub fn new(stories_dir: &Path) -> Self {
        Self {
            stories_dir: stories_dir.to_path_buf(),
        }
    }

    fn saves_dir(&self, story_id: &str) -> PathBuf {
        self.stories_dir.join(story_id).join("saves")
    }

    fn slot_path(&self, story_id: &str, slot_id: &str) -> PathBuf {
        self.saves_dir(story_id).join(format!("{}.json", slot_id))
    }

    pub fn save_slot(
        &self,
        story_id: &str,
        slot_id: &str,
        state: &SavedState,
    ) -> ReaderResult<()> {
        let saves_dir = self.saves_dir(story_id);
        std::fs::create_dir_all(&saves_dir)?;

        let path = self.slot_path(story_id, slot_id);
        let json = serde_json::to_string_pretty(state)?;
        std::fs::write(path, json)?;

        Ok(())
    }

    pub fn load_slot(&self, story_id: &str, slot_id: &str) -> ReaderResult<Option<SavedState>> {
        let path = self.slot_path(story_id, slot_id);

        if !path.exists() {
            return Ok(None);
        }

        let contents = std::fs::read_to_string(&path)?;
        let state: SavedState = serde_json::from_str(&contents)?;

        Ok(Some(state))
    }

    pub fn list_slots(&self, story_id: &str) -> ReaderResult<Vec<SlotInfo>> {
        let saves_dir = self.saves_dir(story_id);

        if !saves_dir.exists() {
            return Ok(vec![]);
        }

        let mut slots = Vec::new();

        for entry in std::fs::read_dir(&saves_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }

            let slot_id = match path.file_stem().and_then(|s| s.to_str()) {
                Some(s) => s.to_string(),
                None => continue,
            };

            let contents = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let state: SavedState = match serde_json::from_str(&contents) {
                Ok(s) => s,
                Err(_) => continue,
            };

            slots.push(SlotInfo {
                slot_id,
                name: state.name,
                timestamp: state.timestamp,
            });
        }

        // Sort by timestamp descending (newest first)
        slots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(slots)
    }

    pub fn delete_slot(&self, story_id: &str, slot_id: &str) -> ReaderResult<()> {
        let path = self.slot_path(story_id, slot_id);

        if !path.exists() {
            return Err(ReaderError::Custom(format!(
                "Save slot not found: {}",
                slot_id
            )));
        }

        std::fs::remove_file(path)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_state(page_id: &str, name: &str, timestamp: u64) -> SavedState {
        SavedState {
            game_state: GameStateData {
                current_page_id: page_id.to_string(),
                flags: HashMap::new(),
            },
            name: name.to_string(),
            timestamp,
        }
    }

    #[test]
    fn save_and_load() {
        let dir = TempDir::new().unwrap();
        let storage = SaveStorage::new(dir.path());

        let state = make_state("page-1", "My Save", 1000);
        storage.save_slot("story-1", "slot-1", &state).unwrap();

        let loaded = storage.load_slot("story-1", "slot-1").unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.game_state.current_page_id, "page-1");
        assert_eq!(loaded.name, "My Save");
        assert_eq!(loaded.timestamp, 1000);
    }

    #[test]
    fn load_nonexistent_returns_none() {
        let dir = TempDir::new().unwrap();
        let storage = SaveStorage::new(dir.path());

        let result = storage.load_slot("story-1", "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn list_slots_sorted_by_timestamp_desc() {
        let dir = TempDir::new().unwrap();
        let storage = SaveStorage::new(dir.path());

        storage
            .save_slot("story-1", "slot-a", &make_state("page-1", "Save A", 100))
            .unwrap();
        storage
            .save_slot("story-1", "slot-b", &make_state("page-2", "Save B", 300))
            .unwrap();
        storage
            .save_slot("story-1", "slot-c", &make_state("page-3", "Save C", 200))
            .unwrap();

        let slots = storage.list_slots("story-1").unwrap();
        assert_eq!(slots.len(), 3);
        assert_eq!(slots[0].timestamp, 300);
        assert_eq!(slots[1].timestamp, 200);
        assert_eq!(slots[2].timestamp, 100);
        assert_eq!(slots[0].name, "Save B");
    }

    #[test]
    fn list_slots_empty_when_no_saves_dir() {
        let dir = TempDir::new().unwrap();
        let storage = SaveStorage::new(dir.path());

        let slots = storage.list_slots("story-1").unwrap();
        assert!(slots.is_empty());
    }

    #[test]
    fn delete_slot() {
        let dir = TempDir::new().unwrap();
        let storage = SaveStorage::new(dir.path());

        let state = make_state("page-1", "To Delete", 500);
        storage.save_slot("story-1", "slot-del", &state).unwrap();

        // Verify it exists
        let loaded = storage.load_slot("story-1", "slot-del").unwrap();
        assert!(loaded.is_some());

        // Delete it
        storage.delete_slot("story-1", "slot-del").unwrap();

        // Verify it's gone
        let loaded = storage.load_slot("story-1", "slot-del").unwrap();
        assert!(loaded.is_none());
    }

    #[test]
    fn delete_nonexistent_slot_returns_error() {
        let dir = TempDir::new().unwrap();
        let storage = SaveStorage::new(dir.path());

        let result = storage.delete_slot("story-1", "missing-slot");
        assert!(result.is_err());
    }
}
