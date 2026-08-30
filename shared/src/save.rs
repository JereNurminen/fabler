use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Player-facing save format, shared by the player engine and the reader's
/// on-disk save slots.
///
/// These three types serialise in camelCase, unlike every other type in this
/// crate. That is deliberate and load-bearing: the player's TypeScript has
/// always used camelCase here, and the renames are what let the generated
/// bindings match it exactly. Normalising the wire format is tracked in
/// docs/TODO.md, under "Deferred from type generation".
#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct GameState {
    #[serde(rename = "currentPageId")]
    pub current_page_id: String,
    pub flags: HashMap<String, bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct SavedState {
    #[serde(rename = "gameState")]
    pub game_state: GameState,
    pub name: String,
    /// `u64` in Rust, but serde_json serialises it as a plain JSON number —
    /// the override reflects what actually crosses the wire, not ts-rs's
    /// default `bigint` mapping for 64-bit integers.
    #[ts(type = "number")]
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct SlotInfo {
    #[serde(rename = "slotId")]
    pub slot_id: String,
    pub name: String,
    /// `u64` in Rust, but serde_json serialises it as a plain JSON number —
    /// the override reflects what actually crosses the wire, not ts-rs's
    /// default `bigint` mapping for 64-bit integers.
    #[ts(type = "number")]
    pub timestamp: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saved_state_serialises_to_camel_case_keys() {
        let state = SavedState {
            game_state: GameState {
                current_page_id: "page-1".to_string(),
                flags: HashMap::new(),
            },
            name: "My Save".to_string(),
            timestamp: 1000,
        };

        let json = serde_json::to_string(&state).unwrap();

        assert!(
            json.contains("\"gameState\""),
            "expected camelCase key \"gameState\" in {json}"
        );
        assert!(
            json.contains("\"currentPageId\""),
            "expected camelCase key \"currentPageId\" in {json}"
        );
        assert!(
            !json.contains("\"game_state\""),
            "did not expect snake_case key \"game_state\" in {json}"
        );
        assert!(
            !json.contains("\"current_page_id\""),
            "did not expect snake_case key \"current_page_id\" in {json}"
        );
    }

    #[test]
    fn slot_info_serialises_to_camel_case_keys() {
        let slot = SlotInfo {
            slot_id: "slot-1".to_string(),
            name: "My Save".to_string(),
            timestamp: 1000,
        };

        let json = serde_json::to_string(&slot).unwrap();

        assert!(
            json.contains("\"slotId\""),
            "expected camelCase key \"slotId\" in {json}"
        );
        assert!(
            !json.contains("\"slot_id\""),
            "did not expect snake_case key \"slot_id\" in {json}"
        );
    }
}
