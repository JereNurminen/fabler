use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Document {
    #[serde(default)]
    pub content: Vec<Block>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Block {
    Paragraph {
        #[serde(default)]
        content: Vec<Inline>,
    },
    Blockquote {
        content: Vec<Block>,
    },
    Image {
        src: String,
        alt: String,
    },
    HorizontalRule,
    Markdown {
        source: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Inline {
    pub text: String,
    #[serde(default)]
    pub marks: Vec<Mark>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Mark {
    Bold,
    Italic,
}

impl Document {
    pub fn empty() -> Self {
        Document {
            content: vec![Block::Markdown {
                source: String::new(),
            }],
        }
    }

    pub fn from_plain_text(text: &str) -> Self {
        Document {
            content: vec![Block::Markdown {
                source: text.to_string(),
            }],
        }
    }

    /// Get the markdown source if this document contains a single Markdown block.
    pub fn as_markdown(&self) -> Option<&str> {
        if self.content.len() == 1 {
            if let Block::Markdown { source } = &self.content[0] {
                return Some(source);
            }
        }
        None
    }

    /// Create a document from a markdown string.
    pub fn from_markdown(source: &str) -> Self {
        Document {
            content: vec![Block::Markdown {
                source: source.to_string(),
            }],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_document() {
        let doc = Document::empty();
        assert_eq!(doc.content.len(), 1);
        assert!(matches!(&doc.content[0], Block::Markdown { source } if source.is_empty()));

        let json = serde_json::to_string(&doc).unwrap();
        let parsed: Document = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, parsed);
    }

    #[test]
    fn document_with_formatting() {
        let doc = Document {
            content: vec![Block::Paragraph {
                content: vec![Inline {
                    text: "bold text".into(),
                    marks: vec![Mark::Bold],
                }],
            }],
        };
        let json = serde_json::to_string(&doc).unwrap();
        let parsed: Document = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, parsed);
    }

    #[test]
    fn document_with_all_block_types() {
        let doc = Document {
            content: vec![
                Block::Paragraph {
                    content: vec![Inline {
                        text: "hello".into(),
                        marks: vec![],
                    }],
                },
                Block::Image {
                    src: "img.png".into(),
                    alt: "An image".into(),
                },
                Block::HorizontalRule,
                Block::Blockquote {
                    content: vec![Block::Paragraph {
                        content: vec![Inline {
                            text: "quoted".into(),
                            marks: vec![Mark::Italic],
                        }],
                    }],
                },
            ],
        };
        let json = serde_json::to_string(&doc).unwrap();
        let parsed: Document = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, parsed);
    }

    #[test]
    fn from_plain_text() {
        let doc = Document::from_plain_text("line one\nline two\n\nline four");
        assert_eq!(doc.content.len(), 1);
        assert!(
            matches!(&doc.content[0], Block::Markdown { source } if source == "line one\nline two\n\nline four")
        );
    }

    #[test]
    fn from_plain_text_empty() {
        let doc = Document::from_plain_text("");
        assert_eq!(doc.content.len(), 1);
        assert!(matches!(&doc.content[0], Block::Markdown { source } if source.is_empty()));
    }

    #[test]
    fn markdown_round_trip() {
        let doc = Document::from_markdown("# Hello\n\nSome **bold** text");
        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains("\"type\":\"markdown\""));
        assert!(json.contains("\"source\":\"# Hello"));
        let parsed: Document = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, parsed);
        assert_eq!(doc.as_markdown(), Some("# Hello\n\nSome **bold** text"));
    }
}
