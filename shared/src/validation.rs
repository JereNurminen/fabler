use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::models::{Page, Story};

/// How serious a problem is. Only `Error` blocks export.
///
/// Declaration order is the display order — `derive(Ord)` sorts `Error`
/// first. `Info` is plumbed end to end but no current rule emits it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../../types/src/")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

/// What is wrong, as a machine-readable code plus the fields the UI needs to
/// build a sentence. Deliberately carries no prose: all user-facing wording
/// lives in the frontend's translations file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "code", rename_all = "snake_case")]
#[ts(export, export_to = "../../types/src/")]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../types/src/")]
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

const RULES: &[Rule] = &[
    dangling_choice_targets,
    dangling_flag_references,
    start_page_valid,
    unreachable_pages,
];

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

/// ERROR: a flag operation or condition references a flag id the story no
/// longer defines. These survive a flag deletion and export into bundles.
fn dangling_flag_references(ctx: &StoryContext) -> Vec<Problem> {
    let mut problems = Vec::new();
    for page in ctx.pages {
        for op in &page.flag_operations {
            if !ctx.has_flag(&op.flag_id) {
                problems.push(Problem::on_page(
                    Severity::Error,
                    page,
                    ProblemDetail::DanglingPageFlagOperation {
                        flag_id: op.flag_id.clone(),
                    },
                ));
            }
        }

        for choice in &page.choices {
            for op in &choice.flag_operations {
                if !ctx.has_flag(&op.flag_id) {
                    problems.push(Problem::on_page(
                        Severity::Error,
                        page,
                        ProblemDetail::DanglingChoiceFlagOperation {
                            choice_id: choice.id.clone(),
                            choice_text: choice.text.clone(),
                            flag_id: op.flag_id.clone(),
                        },
                    ));
                }
            }

            for condition in &choice.conditions {
                if !ctx.has_flag(&condition.flag_id) {
                    problems.push(Problem::on_page(
                        Severity::Error,
                        page,
                        ProblemDetail::DanglingChoiceCondition {
                            choice_id: choice.id.clone(),
                            choice_text: choice.text.clone(),
                            flag_id: condition.flag_id.clone(),
                        },
                    ));
                }
            }
        }
    }
    problems
}

/// ERROR: the story has no start page, or names one that does not exist.
/// Either strands the reader on load with no way to recover.
fn start_page_valid(ctx: &StoryContext) -> Vec<Problem> {
    let start = ctx.story.start_page.as_str();
    if start.is_empty() {
        return vec![Problem::on_story(
            Severity::Error,
            ProblemDetail::StartPageUnset,
        )];
    }
    if !ctx.has_page(start) {
        return vec![Problem::on_story(
            Severity::Error,
            ProblemDetail::StartPageMissing {
                start_page: start.to_string(),
            },
        )];
    }
    Vec::new()
}

/// WARNING: no path of choices from the start page reaches this page.
///
/// Every choice counts as traversable regardless of its conditions. Modelling
/// flag reachability is a much harder problem and would fire on legitimate
/// designs, so a choice gated behind an unsatisfiable condition still makes
/// its target reachable.
fn unreachable_pages(ctx: &StoryContext) -> Vec<Problem> {
    let start = ctx.story.start_page.as_str();
    // `start_page_valid` already reports this; walking from a bad start would
    // flag every page in the story and bury that error.
    if start.is_empty() || !ctx.has_page(start) {
        return Vec::new();
    }

    let mut reached: HashSet<&str> = HashSet::new();
    let mut queue = vec![start];
    while let Some(id) = queue.pop() {
        if !reached.insert(id) {
            continue; // already visited — this is what makes cycles terminate
        }
        if let Some(page) = ctx.page(id) {
            for choice in &page.choices {
                // A target that does not resolve is already reported by
                // `dangling_choice_targets`; skip it rather than panicking.
                if let Some(target) = ctx.page(&choice.target) {
                    queue.push(target.id.as_str());
                }
            }
        }
    }

    ctx.pages
        .iter()
        .filter(|page| !reached.contains(page.id.as_str()))
        .map(|page| Problem::on_page(Severity::Warning, page, ProblemDetail::UnreachablePage))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::Document;
    use crate::models::{Choice, Condition, Flag, FlagOperation, Page, Story};

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
            editor: None,
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
        assert!(
            report.problems.is_empty(),
            "unexpected: {:?}",
            report.problems
        );
        assert!(!report.has_errors());
    }

    #[test]
    fn reports_a_choice_pointing_at_a_missing_page() {
        let pages = vec![page(
            "aaa11",
            "Start",
            vec![choice("c1", "Go deeper", "gone9")],
        )];
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

    #[test]
    fn reports_flag_operations_and_conditions_referencing_a_deleted_flag() {
        let mut start = page("aaa11", "Start", vec![choice("c1", "Open", "aaa11")]);
        start.flag_operations = vec![FlagOperation {
            flag_id: "gonef".into(),
            operation: "set_true".into(),
        }];
        start.choices[0].flag_operations = vec![FlagOperation {
            flag_id: "gonef".into(),
            operation: "toggle".into(),
        }];
        start.choices[0].conditions = vec![Condition {
            flag_id: "gonef".into(),
            required_value: true,
        }];

        let report = validate(&story("aaa11", vec![]), &[start]);

        assert_eq!(report.error_count(), 3);

        let page_flag_op = report
            .problems
            .iter()
            .find(|p| p.detail.code() == "dangling_page_flag_operation")
            .expect("expected dangling_page_flag_operation");
        assert_eq!(
            page_flag_op.detail,
            ProblemDetail::DanglingPageFlagOperation {
                flag_id: "gonef".into(),
            }
        );

        let choice_flag_op = report
            .problems
            .iter()
            .find(|p| p.detail.code() == "dangling_choice_flag_operation")
            .expect("expected dangling_choice_flag_operation");
        assert_eq!(
            choice_flag_op.detail,
            ProblemDetail::DanglingChoiceFlagOperation {
                choice_id: "c1".into(),
                choice_text: "Open".into(),
                flag_id: "gonef".into(),
            }
        );

        let choice_condition = report
            .problems
            .iter()
            .find(|p| p.detail.code() == "dangling_choice_condition")
            .expect("expected dangling_choice_condition");
        assert_eq!(
            choice_condition.detail,
            ProblemDetail::DanglingChoiceCondition {
                choice_id: "c1".into(),
                choice_text: "Open".into(),
                flag_id: "gonef".into(),
            }
        );
    }

    #[test]
    fn does_not_report_flag_references_that_resolve() {
        let flag = Flag {
            id: "f1a2c".into(),
            name: "has_key".into(),
            default_value: false,
        };
        let mut start = page("aaa11", "Start", vec![choice("c1", "Open", "aaa11")]);
        start.flag_operations = vec![FlagOperation {
            flag_id: "f1a2c".into(),
            operation: "set_true".into(),
        }];
        start.choices[0].conditions = vec![Condition {
            flag_id: "f1a2c".into(),
            required_value: true,
        }];

        let report = validate(&story("aaa11", vec![flag]), &[start]);

        assert!(
            report.problems.is_empty(),
            "unexpected: {:?}",
            report.problems
        );
    }

    #[test]
    fn reports_a_start_page_that_does_not_exist() {
        let pages = vec![page("aaa11", "Start", vec![])];
        let report = validate(&story("nope9", vec![]), &pages);

        let problem = report
            .problems
            .iter()
            .find(|p| p.detail.code() == "start_page_missing")
            .expect("expected start_page_missing");
        assert_eq!(problem.severity, Severity::Error);
        assert_eq!(problem.page_id, None, "story-level problems have no page");
        assert_eq!(
            problem.detail,
            ProblemDetail::StartPageMissing {
                start_page: "nope9".into()
            }
        );
    }

    #[test]
    fn reports_an_unset_start_page() {
        let pages = vec![page("aaa11", "Start", vec![])];
        let report = validate(&story("", vec![]), &pages);

        assert!(report
            .problems
            .iter()
            .any(|p| p.detail == ProblemDetail::StartPageUnset));
    }

    #[test]
    fn reports_a_page_no_choice_leads_to_as_a_warning() {
        let pages = vec![
            page("aaa11", "Start", vec![choice("c1", "Go", "bbb22")]),
            page("bbb22", "Middle", vec![]),
            page("ccc33", "Attic", vec![]),
        ];
        let report = validate(&story("aaa11", vec![]), &pages);

        assert_eq!(report.problems.len(), 1);
        let problem = &report.problems[0];
        assert_eq!(problem.severity, Severity::Warning);
        assert_eq!(problem.page_id.as_deref(), Some("ccc33"));
        assert_eq!(problem.detail, ProblemDetail::UnreachablePage);

        // Warnings must never block export.
        assert!(!report.has_errors());
    }

    #[test]
    fn follows_choices_transitively_and_tolerates_cycles() {
        let pages = vec![
            page("aaa11", "Start", vec![choice("c1", "Go", "bbb22")]),
            page("bbb22", "Middle", vec![choice("c2", "Back", "aaa11")]),
        ];
        let report = validate(&story("aaa11", vec![]), &pages);
        assert!(
            report.problems.is_empty(),
            "unexpected: {:?}",
            report.problems
        );
    }

    /// Guards the Rust <-> TypeScript seam: `ProblemDetail::code()` strings
    /// are mirrored by hand in `creation-tool/src/types.ts` (the `ProblemDetail`
    /// union) and `creation-tool/src/i18n/translations.ts` (`problemMessages`).
    /// Nothing in the type system ties those together, so adding a variant
    /// here without updating both TS files compiles clean and renders
    /// `undefined` at runtime. This test fails loudly the moment the set of
    /// codes changes, forcing whoever adds a variant to go update the TS side.
    #[test]
    fn code_set_matches_the_hand_mirrored_typescript_union() {
        let all_details = vec![
            ProblemDetail::DanglingChoiceTarget {
                choice_id: "c".into(),
                choice_text: "c".into(),
                target: "t".into(),
            },
            ProblemDetail::DanglingPageFlagOperation {
                flag_id: "f".into(),
            },
            ProblemDetail::DanglingChoiceFlagOperation {
                choice_id: "c".into(),
                choice_text: "c".into(),
                flag_id: "f".into(),
            },
            ProblemDetail::DanglingChoiceCondition {
                choice_id: "c".into(),
                choice_text: "c".into(),
                flag_id: "f".into(),
            },
            ProblemDetail::StartPageUnset,
            ProblemDetail::StartPageMissing {
                start_page: "s".into(),
            },
            ProblemDetail::UnreachablePage,
        ];

        let mut codes: Vec<&str> = all_details.iter().map(|d| d.code()).collect();
        codes.sort();

        let mut expected = vec![
            "dangling_choice_target",
            "dangling_page_flag_operation",
            "dangling_choice_flag_operation",
            "dangling_choice_condition",
            "start_page_unset",
            "start_page_missing",
            "unreachable_page",
        ];
        expected.sort();

        assert_eq!(
            codes, expected,
            "ProblemDetail's set of codes changed — update the mirrored union in \
             creation-tool/src/types.ts and the messages in \
             creation-tool/src/i18n/translations.ts, then update `expected` here"
        );
    }

    #[test]
    fn stays_silent_when_the_start_page_is_invalid() {
        // Otherwise a bad start page would report every page as unreachable and
        // bury the one error that actually matters.
        let pages = vec![
            page("aaa11", "Start", vec![]),
            page("bbb22", "Other", vec![]),
        ];
        let report = validate(&story("nope9", vec![]), &pages);

        let codes: Vec<&str> = report.problems.iter().map(|p| p.detail.code()).collect();
        assert_eq!(codes, vec!["start_page_missing"]);
    }
}
