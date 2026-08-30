use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Player-facing save format, shared by the player engine and the reader's
/// on-disk save slots.
///
/// These three types serialise in camelCase, unlike every other type in this
/// crate. That is deliberate and load-bearing: the player's TypeScript has
/// always used camelCase here, and the renames are what let the generated
/// bindings match it exactly. Normalising the wire format is tracked
/// separately in docs/TODO.md.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameState {
    #[serde(rename = "currentPageId")]
    pub current_page_id: String,
    pub flags: HashMap<String, bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedState {
    #[serde(rename = "gameState")]
    pub game_state: GameState,
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
