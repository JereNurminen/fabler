use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::content::Document;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct Story {
    pub format_version: u32,
    /// Stable identity for this story, preserved into exported bundles so a
    /// reader can tell two stories apart. Defaults to empty for story.json
    /// files written before ids existed; `Project::open` backfills those.
    #[serde(default)]
    pub id: String,
    pub title: String,
    pub start_page: String,
    #[serde(default)]
    pub flags: Vec<Flag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct Flag {
    pub id: String,
    pub name: String,
    pub default_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct Page {
    pub id: String,
    pub name: String,
    pub body: Document,
    #[serde(default)]
    pub choices: Vec<Choice>,
    #[serde(default)]
    pub flag_operations: Vec<FlagOperation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub editor: Option<EditorMetadata>,
    /// RFC3339 UTC instant of the last write to this page's file — including
    /// the writes that move it into and out of `trash/`. `#[serde(default)]`:
    /// pages written before this field existed load as `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<String>,
}

/// Authoring-only state attached to a page. Never reaches a reader:
/// `build_manifest` clears it when packing a bundle.
///
/// This is a general slot, not a position field with extra steps — the next
/// authoring-only concern (collapsed state, colour tags) belongs here too.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct EditorMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct Choice {
    pub id: String,
    pub text: String,
    pub target: String,
    #[serde(default)]
    pub flag_operations: Vec<FlagOperation>,
    #[serde(default)]
    pub conditions: Vec<Condition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct FlagOperation {
    pub flag_id: String,
    /// Genuinely a `String` in Rust today, not a real enum — the `#[ts(type
    /// = ...)]` override below asserts the literal union the TypeScript side
    /// has always relied on. Making this a proper enum is a data-model
    /// change for another day; until then, this override is what keeps the
    /// generated type honest with the contract consumers already assume.
    #[ts(type = "\"set_true\" | \"set_false\" | \"toggle\"")]
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct Condition {
    pub flag_id: String,
    pub required_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct PageListItem {
    pub id: String,
    pub name: String,
    /// Copied from the page so the trash list can sort by recency without
    /// reading every trashed page in full.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<String>,
}

impl From<&Page> for PageListItem {
    fn from(page: &Page) -> Self {
        PageListItem {
            id: page.id.clone(),
            name: page.name.clone(),
            last_modified: page.last_modified.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn story_round_trip_json() {
        let story = Story {
            format_version: 1,
            id: "s1a2b".into(),
            title: "Test".into(),
            start_page: "a1b2c".into(),
            flags: vec![Flag {
                id: "f1a2c".into(),
                name: "has_key".into(),
                default_value: false,
            }],
        };
        let json = serde_json::to_string(&story).unwrap();
        let parsed: Story = serde_json::from_str(&json).unwrap();
        assert_eq!(story, parsed);
    }

    #[test]
    fn page_round_trip_json() {
        let page = Page {
            id: "a1b2c".into(),
            name: "Entrance".into(),
            body: Document::from_plain_text("Hello world"),
            choices: vec![Choice {
                id: "c1b2c".into(),
                text: "Go north".into(),
                target: "d1e2f".into(),
                flag_operations: vec![FlagOperation {
                    flag_id: "f1a2c".into(),
                    operation: "set_true".into(),
                }],
                conditions: vec![Condition {
                    flag_id: "f1a2c".into(),
                    required_value: true,
                }],
            }],
            flag_operations: vec![],
            editor: None,
            last_modified: None,
        };
        let json = serde_json::to_string(&page).unwrap();
        let parsed: Page = serde_json::from_str(&json).unwrap();
        assert_eq!(page, parsed);
    }

    #[test]
    fn page_list_item_from_page() {
        let page = Page {
            id: "abc12".into(),
            name: "Test Page".into(),
            body: Document::empty(),
            choices: vec![],
            flag_operations: vec![],
            editor: None,
            last_modified: None,
        };
        let item = PageListItem::from(&page);
        assert_eq!(item.id, "abc12");
        assert_eq!(item.name, "Test Page");
    }

    #[test]
    fn page_without_editor_metadata_round_trips() {
        // Existing story.json files have no `editor` key at all.
        let json = r#"{"id":"a1b2c","name":"Start","body":{"content":[]},"choices":[],"flag_operations":[]}"#;
        let page: Page = serde_json::from_str(json).unwrap();
        assert!(page.editor.is_none());

        // And a page without it must not write the key back.
        let out = serde_json::to_string(&page).unwrap();
        assert!(
            !out.contains("editor"),
            "absent metadata must stay absent: {out}"
        );
    }

    #[test]
    fn page_with_position_round_trips() {
        let mut page = Page {
            id: "a1b2c".into(),
            name: "Start".into(),
            body: Document::empty(),
            choices: vec![],
            flag_operations: vec![],
            editor: None,
            last_modified: None,
        };
        page.editor = Some(EditorMetadata {
            position: Some(Position { x: 1.5, y: -2.5 }),
        });

        let parsed: Page = serde_json::from_str(&serde_json::to_string(&page).unwrap()).unwrap();
        let pos = parsed.editor.unwrap().position.unwrap();
        assert_eq!((pos.x, pos.y), (1.5, -2.5));
    }

    #[test]
    fn page_without_last_modified_round_trips() {
        // Page files written before this field existed have no key at all.
        let json = r#"{"id":"a1b2c","name":"Start","body":{"content":[]},"choices":[],"flag_operations":[]}"#;
        let page: Page = serde_json::from_str(json).unwrap();
        assert!(page.last_modified.is_none());

        // And a page without it must not write the key back.
        let out = serde_json::to_string(&page).unwrap();
        assert!(
            !out.contains("last_modified"),
            "absent timestamp must stay absent: {out}"
        );
    }

    #[test]
    fn page_list_item_carries_last_modified() {
        let page = Page {
            id: "abc12".into(),
            name: "Test Page".into(),
            body: Document::empty(),
            choices: vec![],
            flag_operations: vec![],
            editor: None,
            last_modified: Some("2026-08-27T12:00:00.000Z".into()),
        };
        let item = PageListItem::from(&page);
        assert_eq!(
            item.last_modified.as_deref(),
            Some("2026-08-27T12:00:00.000Z")
        );
    }
}
