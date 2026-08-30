use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::models::{Page, Position, Story};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub is_start: bool,
    /// Author-placed position, if any. Absent nodes get an automatic layout.
    pub position: Option<Position>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub label: String,
    /// True when `target` names no existing page. Kept rather than dropped:
    /// a choice that leads nowhere is exactly what the author needs to see.
    pub is_dangling: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
pub struct StoryGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub fn build_graph(story: &Story, pages: &[Page]) -> StoryGraph {
    let ids: HashSet<&str> = pages.iter().map(|p| p.id.as_str()).collect();

    let nodes = pages
        .iter()
        .map(|p| GraphNode {
            id: p.id.clone(),
            name: p.name.clone(),
            is_start: p.id == story.start_page,
            position: p.editor.as_ref().and_then(|e| e.position),
        })
        .collect();

    let edges = pages
        .iter()
        .flat_map(|p| {
            p.choices.iter().map(|c| GraphEdge {
                id: format!("{}:{}", p.id, c.id),
                source: p.id.clone(),
                target: c.target.clone(),
                label: c.text.clone(),
                is_dangling: !ids.contains(c.target.as_str()),
            })
        })
        .collect();

    StoryGraph { nodes, edges }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::Document;
    use crate::models::{Choice, Page, Story};

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

    fn choice(id: &str, text: &str, target: &str) -> Choice {
        Choice {
            id: id.into(),
            text: text.into(),
            target: target.into(),
            flag_operations: vec![],
            conditions: vec![],
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
    fn builds_a_node_per_page_and_an_edge_per_choice() {
        let pages = vec![
            page("aaa11", "Start", vec![choice("c1", "Go", "bbb22")]),
            page("bbb22", "End", vec![]),
        ];
        let graph = build_graph(&story("aaa11"), &pages);

        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.edges[0].source, "aaa11");
        assert_eq!(graph.edges[0].target, "bbb22");
        assert_eq!(graph.edges[0].label, "Go");
        assert!(!graph.edges[0].is_dangling);
    }

    #[test]
    fn marks_the_start_page() {
        let pages = vec![
            page("aaa11", "Start", vec![]),
            page("bbb22", "Other", vec![]),
        ];
        let graph = build_graph(&story("bbb22"), &pages);

        let start: Vec<&str> = graph
            .nodes
            .iter()
            .filter(|n| n.is_start)
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(start, vec!["bbb22"]);
    }

    #[test]
    fn flags_an_edge_whose_target_is_missing() {
        // The author most needs to see the connection that goes nowhere,
        // so it must survive into the graph rather than be filtered out.
        let pages = vec![page("aaa11", "Start", vec![choice("c1", "Go", "gone9")])];
        let graph = build_graph(&story("aaa11"), &pages);

        assert_eq!(graph.edges.len(), 1);
        assert!(graph.edges[0].is_dangling);
        assert_eq!(graph.edges[0].target, "gone9");
    }

    #[test]
    fn carries_saved_positions_through() {
        let mut pages = vec![page("aaa11", "Start", vec![])];
        pages[0].editor = Some(crate::models::EditorMetadata {
            position: Some(crate::models::Position { x: 3.0, y: 4.0 }),
        });
        let graph = build_graph(&story("aaa11"), &pages);

        let pos = graph.nodes[0].position.unwrap();
        assert_eq!((pos.x, pos.y), (3.0, 4.0));
    }
}
