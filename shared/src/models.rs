use serde::{Deserialize, Serialize};

use crate::content::Document;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Flag {
    pub id: String,
    pub name: String,
    pub default_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Page {
    pub id: String,
    pub name: String,
    pub body: Document,
    #[serde(default)]
    pub choices: Vec<Choice>,
    #[serde(default)]
    pub flag_operations: Vec<FlagOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Choice {
    pub id: String,
    pub text: String,
    pub target: String,
    #[serde(default)]
    pub flag_operations: Vec<FlagOperation>,
    #[serde(default)]
    pub conditions: Vec<Condition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlagOperation {
    pub flag_id: String,
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Condition {
    pub flag_id: String,
    pub required_value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PageListItem {
    pub id: String,
    pub name: String,
}

impl From<&Page> for PageListItem {
    fn from(page: &Page) -> Self {
        PageListItem {
            id: page.id.clone(),
            name: page.name.clone(),
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
        };
        let item = PageListItem::from(&page);
        assert_eq!(item.id, "abc12");
        assert_eq!(item.name, "Test Page");
    }
}
