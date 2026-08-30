use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::models::{Page, Story};

/// A choice on some other page that points at the page being deleted.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct IncomingReference {
    pub page_id: String,
    pub page_name: String,
    pub choice_id: String,
    pub choice_text: String,
}

/// What deleting one page would break, for the confirmation dialog.
///
/// Deliberately carries no count of the page's OWN choices: those leave with
/// the page and are not damage to warn about. Only two things are: losing the
/// story's entry point, and stranding choices on other pages.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct DeleteImpact {
    pub page_id: String,
    /// Empty when the id names no live page.
    pub page_name: String,
    pub is_start_page: bool,
    /// Live pages holding a choice that targets this page, in page order.
    /// A page's choice targeting itself is excluded — it leaves with the page.
    pub incoming: Vec<IncomingReference>,
}

pub fn delete_impact(story: &Story, pages: &[Page], id: &str) -> DeleteImpact {
    let page_name = pages
        .iter()
        .find(|p| p.id == id)
        .map(|p| p.name.clone())
        .unwrap_or_default();

    let incoming = pages
        .iter()
        .filter(|p| p.id != id)
        .flat_map(|p| {
            p.choices
                .iter()
                .filter(|c| c.target == id)
                .map(move |c| IncomingReference {
                    page_id: p.id.clone(),
                    page_name: p.name.clone(),
                    choice_id: c.id.clone(),
                    choice_text: c.text.clone(),
                })
        })
        .collect();

    DeleteImpact {
        page_id: id.to_string(),
        page_name,
        is_start_page: story.start_page == id,
        incoming,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::Document;
    use crate::models::{Choice, Page, Story};

    fn choice(id: &str, text: &str, target: &str) -> Choice {
        Choice {
            id: id.into(),
            text: text.into(),
            target: target.into(),
            flag_operations: vec![],
            conditions: vec![],
        }
    }

    fn page(id: &str, name: &str, choices: Vec<Choice>) -> Page {
        Page {
            id: id.into(),
            name: name.into(),
            body: Document::empty(),
            choices,
            flag_operations: vec![],
            editor: None,
            last_modified: None,
        }
    }

    fn story(start: &str) -> Story {
        Story {
            format_version: 1,
            id: "s1a2b".into(),
            title: "T".into(),
            start_page: start.into(),
            flags: vec![],
        }
    }

    #[test]
    fn reports_every_choice_that_points_at_the_page() {
        let pages = vec![
            page("aaa11", "Entrance", vec![choice("c1a2b", "Go north", "ccc33")]),
            page(
                "bbb22",
                "Great Hall",
                vec![
                    choice("c2a2b", "Descend", "ccc33"),
                    choice("c3a2b", "Leave", "aaa11"),
                ],
            ),
            page("ccc33", "Dark Tunnel", vec![]),
        ];

        let impact = delete_impact(&story("aaa11"), &pages, "ccc33");

        assert_eq!(impact.page_name, "Dark Tunnel");
        assert!(!impact.is_start_page);
        assert_eq!(impact.incoming.len(), 2);
        assert_eq!(impact.incoming[0].page_name, "Entrance");
        assert_eq!(impact.incoming[0].choice_text, "Go north");
        assert_eq!(impact.incoming[1].page_name, "Great Hall");
        assert_eq!(impact.incoming[1].choice_text, "Descend");
    }

    #[test]
    fn flags_the_start_page() {
        let pages = vec![page("aaa11", "Entrance", vec![])];
        let impact = delete_impact(&story("aaa11"), &pages, "aaa11");
        assert!(impact.is_start_page);
        assert!(impact.incoming.is_empty());
    }

    #[test]
    fn a_self_referencing_choice_is_not_counted_as_incoming() {
        // The Crypt's "lay your hand on the sarcophagus" self-loop leaves with
        // the page; it is not damage to warn about.
        let pages = vec![page(
            "ccc33",
            "Crypt",
            vec![choice("c1a2b", "Touch it", "ccc33")],
        )];

        let impact = delete_impact(&story("aaa11"), &pages, "ccc33");

        assert!(impact.incoming.is_empty());
    }

    #[test]
    fn an_unreferenced_page_has_no_impact() {
        let pages = vec![
            page("aaa11", "Entrance", vec![]),
            page("ccc33", "Orphan", vec![]),
        ];
        let impact = delete_impact(&story("aaa11"), &pages, "ccc33");
        assert!(!impact.is_start_page);
        assert!(impact.incoming.is_empty());
    }

    #[test]
    fn an_unknown_id_yields_an_empty_name_rather_than_panicking() {
        let pages = vec![page("aaa11", "Entrance", vec![])];
        let impact = delete_impact(&story("aaa11"), &pages, "zzzzz");
        assert_eq!(impact.page_id, "zzzzz");
        assert_eq!(impact.page_name, "");
    }
}
