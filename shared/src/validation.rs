use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::models::{Page, Story};

/// How serious a problem is. Only `Error` blocks export.
///
/// Declaration order is the display order — `derive(Ord)` sorts `Error`
/// first. `Info` is plumbed end to end but no current rule emits it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

/// What is wrong, as a machine-readable code plus the fields the UI needs to
/// build a sentence. Deliberately carries no prose: all user-facing wording
/// lives in the frontend's translations file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum ProblemDetail {
    DanglingChoiceTarget {
        choice_id: String,
        choice_text: String,
        target: String,
    },
    DanglingPageFlagOperation {
        flag_id: String,
    },
    DanglingChoiceFlagOperation {
        choice_id: String,
        choice_text: String,
        flag_id: String,
    },
    DanglingChoiceCondition {
        choice_id: String,
        choice_text: String,
        flag_id: String,
    },
    StartPageUnset,
    StartPageMissing {
        start_page: String,
    },
    UnreachablePage,
}

impl ProblemDetail {
    /// Stable identifier, also used as the last tiebreak when ordering.
    pub fn code(&self) -> &'static str {
        match self {
            ProblemDetail::DanglingChoiceTarget { .. } => "dangling_choice_target",
            ProblemDetail::DanglingPageFlagOperation { .. } => "dangling_page_flag_operation",
            ProblemDetail::DanglingChoiceFlagOperation { .. } => "dangling_choice_flag_operation",
            ProblemDetail::DanglingChoiceCondition { .. } => "dangling_choice_condition",
            ProblemDetail::StartPageUnset => "start_page_unset",
            ProblemDetail::StartPageMissing { .. } => "start_page_missing",
            ProblemDetail::UnreachablePage => "unreachable_page",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Problem {
    pub severity: Severity,
    /// Page this problem belongs to. `None` for story-level problems.
    pub page_id: Option<String>,
    /// Page name at validation time, so the UI need not look it up.
    pub page_name: Option<String>,
    pub detail: ProblemDetail,
}

impl Problem {
    fn on_page(severity: Severity, page: &Page, detail: ProblemDetail) -> Self {
        Problem {
            severity,
            page_id: Some(page.id.clone()),
            page_name: Some(page.name.clone()),
            detail,
        }
    }

    fn on_story(severity: Severity, detail: ProblemDetail) -> Self {
        Problem {
            severity,
            page_id: None,
            page_name: None,
            detail,
        }
    }

    /// Errors first, then by page name, then by code. Deterministic so tests
    /// and the UI agree on ordering.
    fn display_order(a: &Problem, b: &Problem) -> std::cmp::Ordering {
        a.severity
            .cmp(&b.severity)
            .then_with(|| a.page_name.cmp(&b.page_name))
            .then_with(|| a.detail.code().cmp(b.detail.code()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Report {
    pub problems: Vec<Problem>,
}

impl Report {
    pub fn errors(&self) -> impl Iterator<Item = &Problem> {
        self.problems
            .iter()
            .filter(|p| p.severity == Severity::Error)
    }

    pub fn error_count(&self) -> usize {
        self.errors().count()
    }

    /// Warnings and info never block export.
    pub fn has_errors(&self) -> bool {
        self.errors().next().is_some()
    }
}

/// Precomputed lookups so rules stay linear instead of quadratic.
pub struct StoryContext<'a> {
    pub story: &'a Story,
    pub pages: &'a [Page],
    page_ids: HashSet<&'a str>,
    flag_ids: HashSet<&'a str>,
    pages_by_id: HashMap<&'a str, &'a Page>,
}

impl<'a> StoryContext<'a> {
    pub fn new(story: &'a Story, pages: &'a [Page]) -> Self {
        StoryContext {
            story,
            pages,
            page_ids: pages.iter().map(|p| p.id.as_str()).collect(),
            flag_ids: story.flags.iter().map(|f| f.id.as_str()).collect(),
            pages_by_id: pages.iter().map(|p| (p.id.as_str(), p)).collect(),
        }
    }

    pub fn has_page(&self, id: &str) -> bool {
        self.page_ids.contains(id)
    }

    pub fn has_flag(&self, id: &str) -> bool {
        self.flag_ids.contains(id)
    }

    pub fn page(&self, id: &str) -> Option<&'a Page> {
        self.pages_by_id.get(id).copied()
    }
}

/// A validation rule. Add one by writing a function with this signature and
/// registering it in `RULES` below.
type Rule = fn(&StoryContext) -> Vec<Problem>;

const RULES: &[Rule] = &[dangling_choice_targets];

pub fn validate(story: &Story, pages: &[Page]) -> Report {
    let ctx = StoryContext::new(story, pages);
    let mut problems: Vec<Problem> = RULES.iter().flat_map(|rule| rule(&ctx)).collect();
    problems.sort_by(Problem::display_order);
    Report { problems }
}

/// ERROR: a choice points at a page id that is not in the story.
fn dangling_choice_targets(ctx: &StoryContext) -> Vec<Problem> {
    let mut problems = Vec::new();
    for page in ctx.pages {
        for choice in &page.choices {
            if !ctx.has_page(&choice.target) {
                problems.push(Problem::on_page(
                    Severity::Error,
                    page,
                    ProblemDetail::DanglingChoiceTarget {
                        choice_id: choice.id.clone(),
                        choice_text: choice.text.clone(),
                        target: choice.target.clone(),
                    },
                ));
            }
        }
    }
    problems
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::Document;
    use crate::models::{Choice, Flag, FlagOperation, Condition, Page, Story};

    pub(crate) fn story(start_page: &str, flags: Vec<Flag>) -> Story {
        Story {
            format_version: 1,
            id: "s1a2b".into(),
            title: "Test Story".into(),
            start_page: start_page.into(),
            flags,
        }
    }

    pub(crate) fn page(id: &str, name: &str, choices: Vec<Choice>) -> Page {
        Page {
            id: id.into(),
            name: name.into(),
            body: Document::from_plain_text("body"),
            choices,
            flag_operations: vec![],
        }
    }

    pub(crate) fn choice(id: &str, text: &str, target: &str) -> Choice {
        Choice {
            id: id.into(),
            text: text.into(),
            target: target.into(),
            flag_operations: vec![],
            conditions: vec![],
        }
    }

    #[test]
    fn clean_story_has_no_problems() {
        let pages = vec![
            page("aaa11", "Start", vec![choice("c1", "Go", "bbb22")]),
            page("bbb22", "End", vec![]),
        ];
        let report = validate(&story("aaa11", vec![]), &pages);
        assert!(report.problems.is_empty(), "unexpected: {:?}", report.problems);
        assert!(!report.has_errors());
    }

    #[test]
    fn reports_a_choice_pointing_at_a_missing_page() {
        let pages = vec![page("aaa11", "Start", vec![choice("c1", "Go deeper", "gone9")])];
        let report = validate(&story("aaa11", vec![]), &pages);

        assert_eq!(report.problems.len(), 1);
        let problem = &report.problems[0];
        assert_eq!(problem.severity, Severity::Error);
        assert_eq!(problem.page_id.as_deref(), Some("aaa11"));
        assert_eq!(problem.page_name.as_deref(), Some("Start"));
        assert_eq!(
            problem.detail,
            ProblemDetail::DanglingChoiceTarget {
                choice_id: "c1".into(),
                choice_text: "Go deeper".into(),
                target: "gone9".into(),
            }
        );
        assert!(report.has_errors());
        assert_eq!(report.error_count(), 1);
    }
}
