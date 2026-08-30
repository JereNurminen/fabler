# Story Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect structural problems in a story, block export when any are severe enough to break a reader, and show the author what is wrong with a link to the offending page.

**Architecture:** Validation rules live in Rust in `shared/src/validation.rs` as a registry of pure `fn(&StoryContext) -> Vec<Problem>`. Rust emits structured problem codes, never prose; TypeScript renders the wording so validation does not bypass the project's i18n rule. Export is enforced twice: a `validate_story` command feeds the UI, and `export_bundle` independently refuses when errors exist.

**Tech Stack:** Rust (serde, std collections), Tauri 2.0 RC commands, React 18, Jotai, Tailwind 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-story-validation-design.md`

## Global Constraints

- All user-facing strings live in `creation-tool/src/i18n/translations.ts`. Never hardcode text in a component.
- Rust returns a machine-readable `code` plus structured fields. Rust never returns an English sentence.
- Severity has exactly three levels: `Error`, `Warning`, `Info`. Only `Error` blocks export. No v1 rule emits `Info`.
- New Tauri commands follow the six-step checklist in `CLAUDE.md`: `Project` method → `commands.rs` → `main.rs` invoke_handler → `api.ts` (both `buildHttpApi` and `buildTauriApi`) → `test_server.rs` match arm → `types.ts`.
- Every regression test must be verified to FAIL before the fix, per the pattern used in tasks 3 and 4 of this project's history.
- Run `yarn verify` before each commit. It must stay green (0 eslint errors; 36 pre-existing warnings are expected and are not a regression).
- Do not commit `docs/` changes without asking the user.

---

### Task 1: Validation module skeleton, types, and the first rule

**Files:**
- Create: `shared/src/validation.rs`
- Modify: `shared/src/lib.rs`

**Interfaces:**
- Consumes: `shared::models::{Story, Page}`
- Produces: `Severity`, `Problem`, `ProblemDetail`, `Report`, `StoryContext`, `validate(&Story, &[Page]) -> Report`, `Report::has_errors()`, `Report::error_count()`

- [ ] **Step 1: Write the failing test**

Create `shared/src/validation.rs` containing ONLY the test module for now:

```rust
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
```

Add `pub mod validation;` to `shared/src/lib.rs` (alphabetical: after `models`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p shared validation`
Expected: FAIL to compile — `cannot find function 'validate' in this scope`.

- [ ] **Step 3: Write minimal implementation**

Prepend to `shared/src/validation.rs`, above the test module:

```rust
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p shared validation`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/src/validation.rs shared/src/lib.rs
git commit -m "feat(validation): add rule registry and dangling choice target check"
```

---

### Task 2: Dangling flag reference rule

**Files:**
- Modify: `shared/src/validation.rs`

**Interfaces:**
- Consumes: `StoryContext`, `Problem::on_page`, `Severity`
- Produces: adds `dangling_flag_references` to `RULES`; emits `DanglingPageFlagOperation`, `DanglingChoiceFlagOperation`, `DanglingChoiceCondition`

- [ ] **Step 1: Write the failing test**

Add inside `mod tests`:

```rust
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
    let codes: Vec<&str> = report.problems.iter().map(|p| p.detail.code()).collect();
    assert!(codes.contains(&"dangling_page_flag_operation"));
    assert!(codes.contains(&"dangling_choice_flag_operation"));
    assert!(codes.contains(&"dangling_choice_condition"));
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

    assert!(report.problems.is_empty(), "unexpected: {:?}", report.problems);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p shared validation::tests::reports_flag_operations`
Expected: FAIL — `assertion failed: left: 0, right: 3` (the rule does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Add the rule and register it:

```rust
const RULES: &[Rule] = &[dangling_choice_targets, dangling_flag_references];

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p shared validation`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/src/validation.rs
git commit -m "feat(validation): detect dangling flag references"
```

---

### Task 3: Start page rule

**Files:**
- Modify: `shared/src/validation.rs`

**Interfaces:**
- Consumes: `StoryContext`, `Problem::on_story`
- Produces: adds `start_page_valid` to `RULES`; emits `StartPageUnset`, `StartPageMissing`

- [ ] **Step 1: Write the failing test**

```rust
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
        ProblemDetail::StartPageMissing { start_page: "nope9".into() }
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p shared validation::tests::reports_a_start_page`
Expected: FAIL — `expected start_page_missing` panic.

- [ ] **Step 3: Write minimal implementation**

```rust
const RULES: &[Rule] = &[
    dangling_choice_targets,
    dangling_flag_references,
    start_page_valid,
];

/// ERROR: the story has no start page, or names one that does not exist.
/// Either strands the reader on load with no way to recover.
fn start_page_valid(ctx: &StoryContext) -> Vec<Problem> {
    let start = ctx.story.start_page.as_str();
    if start.is_empty() {
        return vec![Problem::on_story(Severity::Error, ProblemDetail::StartPageUnset)];
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p shared validation`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/src/validation.rs
git commit -m "feat(validation): validate the story start page"
```

---

### Task 4: Unreachable pages rule (first Warning)

**Files:**
- Modify: `shared/src/validation.rs`

**Interfaces:**
- Consumes: `StoryContext::page`, `Severity::Warning`
- Produces: adds `unreachable_pages` to `RULES`; emits `UnreachablePage`

- [ ] **Step 1: Write the failing test**

```rust
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
    assert!(report.problems.is_empty(), "unexpected: {:?}", report.problems);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p shared validation::tests::reports_a_page_no_choice`
Expected: FAIL — `assertion failed: left: 0, right: 1`.

- [ ] **Step 3: Write minimal implementation**

```rust
const RULES: &[Rule] = &[
    dangling_choice_targets,
    dangling_flag_references,
    start_page_valid,
    unreachable_pages,
];

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p shared validation`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/src/validation.rs
git commit -m "feat(validation): warn about unreachable pages"
```

---

### Task 5: Block export on errors

**Files:**
- Modify: `creation-tool/src-tauri/src/project/mod.rs`
- Modify: `creation-tool/src-tauri/src/project/export.rs`
- Modify: `creation-tool/src-tauri/src/error.rs`

**Interfaces:**
- Consumes: `shared::validation::{validate, Report}`
- Produces: `Project::read_all_pages() -> AppResult<Vec<Page>>`, `Project::validate() -> AppResult<Report>`, `AppError::ExportBlocked(usize)`

- [ ] **Step 1: Write the failing test**

Add to the existing `mod tests` in `creation-tool/src-tauri/src/project/export.rs`:

```rust
#[test]
fn export_is_blocked_when_the_story_has_errors() {
    let tmp = TempDir::new().unwrap();
    let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Story").unwrap();

    // Point the start page's only choice at a page that does not exist.
    let mut start = project.read_page(&project.story().start_page).unwrap();
    start.choices.push(shared::models::Choice {
        id: "c1".into(),
        text: "Go nowhere".into(),
        target: "gone9".into(),
        flag_operations: vec![],
        conditions: vec![],
    });
    project.save_page(&start).unwrap();

    let out = tmp.path().join("blocked.fabler");
    let result = project.export_bundle(out.to_str().unwrap());

    assert!(result.is_err(), "export must refuse a story with errors");
    assert!(!out.exists(), "a blocked export must not write a file");
}

#[test]
fn export_succeeds_when_the_only_problems_are_warnings() {
    let tmp = TempDir::new().unwrap();
    let project = Project::create(tmp.path().join("p").to_str().unwrap(), "Story").unwrap();

    // An extra page nothing links to is a warning, not an error.
    project.create_page("Orphan").unwrap();

    let out = tmp.path().join("ok.fabler");
    project.export_bundle(out.to_str().unwrap()).unwrap();

    assert!(out.exists());
    assert!(project.validate().unwrap().problems.iter().any(|p| {
        p.detail == shared::validation::ProblemDetail::UnreachablePage
    }));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p creation-tool export_is_blocked`
Expected: FAIL to compile — `no method named 'validate' found for struct 'Project'`.

- [ ] **Step 3: Write minimal implementation**

In `error.rs`, add the variant:

```rust
    #[error("Cannot export: the story has {0} structural error(s)")]
    ExportBlocked(usize),
```

In `project/mod.rs`, add two methods to `impl Project`:

```rust
    /// Read every page in the project. Used by export and validation.
    pub fn read_all_pages(&self) -> AppResult<Vec<Page>> {
        let mut pages = Vec::new();
        for item in self.list_pages()? {
            pages.push(self.read_page(&item.id)?);
        }
        Ok(pages)
    }

    /// Check the story for structural problems.
    pub fn validate(&self) -> AppResult<shared::validation::Report> {
        let story = self.story();
        let pages = self.read_all_pages()?;
        Ok(shared::validation::validate(&story, &pages))
    }
```

In `project/export.rs`, replace the page-collecting loop and add the guard:

```rust
pub fn export_bundle(project: &Project, output_path: &str) -> AppResult<()> {
    let story = project.story();
    let all_pages = project.read_all_pages()?;

    // The frontend pre-checks and shows a dialog, but export is a backend
    // operation: refusing here is what makes the block a guarantee rather
    // than a suggestion. Warnings never block.
    let report = shared::validation::validate(&story, &all_pages);
    if report.has_errors() {
        return Err(AppError::ExportBlocked(report.error_count()));
    }

    let manifest = build_manifest(&story, all_pages);
    // ... rest unchanged (assets collection, pack, write)
}
```

Add `use crate::error::{AppError, AppResult};` to `export.rs` (it currently imports only `AppResult`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p creation-tool`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add creation-tool/src-tauri/src/project/mod.rs creation-tool/src-tauri/src/project/export.rs creation-tool/src-tauri/src/error.rs
git commit -m "feat(export): refuse to export a story with structural errors"
```

---

### Task 6: Expose validation and real export to the frontend

**Files:**
- Modify: `creation-tool/src-tauri/src/commands.rs`
- Modify: `creation-tool/src-tauri/src/main.rs`
- Modify: `creation-tool/src-tauri/src/test_server.rs`
- Modify: `creation-tool/src/api.ts`
- Modify: `creation-tool/src/types.ts`

**Interfaces:**
- Consumes: `Project::validate`, `Project::export_bundle`
- Produces: `validate_story` command; `api.validateStory(): Promise<ValidationReport>`; working `api.exportBundle` in HTTP test mode; TS `Severity`, `ProblemDetail`, `Problem`, `ValidationReport`

- [ ] **Step 1: Add the command**

In `commands.rs`:

```rust
#[tauri::command]
pub fn validate_story(state: State<ProjectState>) -> Result<shared::validation::Report, String> {
    with_project(&state, |p| p.validate())
}
```

Register in `main.rs` `invoke_handler`, after `commands::export_bundle`:

```rust
            commands::validate_story,
```

- [ ] **Step 2: Add the test-server arms**

In `test_server.rs`, inside the `match cmd` block, add:

```rust
            "validate_story" => project
                .validate()
                .map(|r| json!(r))
                .map_err(|e| e.to_string()),

            // Export in test mode writes to a fixed temp path so e2e can
            // assert on blocked vs successful export. Safe because
            // playwright.config.ts pins `workers: 1, fullyParallel: false`.
            "export_bundle" => {
                let out = std::env::temp_dir().join("fabler-test-export.fabler");
                let _ = std::fs::remove_file(&out);
                project
                    .export_bundle(out.to_str().unwrap())
                    .map(|_| json!(null))
                    .map_err(|e| e.to_string())
            }
```

- [ ] **Step 3: Add the TS types**

Append to `creation-tool/src/types.ts`:

```typescript
// -- Story validation --

export type Severity = "error" | "warning" | "info";

export type ProblemDetail =
  | { code: "dangling_choice_target"; choice_id: string; choice_text: string; target: string }
  | { code: "dangling_page_flag_operation"; flag_id: string }
  | { code: "dangling_choice_flag_operation"; choice_id: string; choice_text: string; flag_id: string }
  | { code: "dangling_choice_condition"; choice_id: string; choice_text: string; flag_id: string }
  | { code: "start_page_unset" }
  | { code: "start_page_missing"; start_page: string }
  | { code: "unreachable_page" };

export interface Problem {
  severity: Severity;
  /** Null for story-level problems that belong to no page. */
  page_id: string | null;
  page_name: string | null;
  detail: ProblemDetail;
}

export interface ValidationReport {
  problems: Problem[];
}
```

- [ ] **Step 4: Wire api.ts**

Import `ValidationReport` in the type import at the top. In `buildHttpApi()`, replace the `exportBundle` stub and add validation:

```typescript
    exportBundle: (_outputPath: string) => call<void>("export_bundle"),
    validateStory: () => call<ValidationReport>("validate_story"),
```

In `buildTauriApi()`, add after `exportBundle`:

```typescript
    validateStory: () => invoke<ValidationReport>("validate_story"),
```

- [ ] **Step 5: Verify**

Run: `cargo build -p creation-tool --features test-server && cd creation-tool && npx tsc --noEmit`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add creation-tool/src-tauri/src creation-tool/src/api.ts creation-tool/src/types.ts
git commit -m "feat(validation): expose validate_story command and real test-mode export"
```

---

### Task 7: Problem messages and the shared list renderer

**Files:**
- Modify: `creation-tool/src/i18n/translations.ts`
- Create: `creation-tool/src/components/ProblemList.tsx`
- Create: `creation-tool/src/utilities/problemMessage.ts`
- Create: `creation-tool/src/utilities/__tests__/problemMessage.test.ts`

**Interfaces:**
- Consumes: `Problem`, `ProblemDetail` from `types.ts`
- Produces: `problemMessage(detail: ProblemDetail): string`; `<ProblemList problems={...} onNavigate={...} />`

- [ ] **Step 1: Write the failing test**

Create `creation-tool/src/utilities/__tests__/problemMessage.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { problemMessage } from "../problemMessage";
import type { ProblemDetail } from "../../types";

const ALL_CODES: ProblemDetail[] = [
  { code: "dangling_choice_target", choice_id: "c1", choice_text: "Go deeper", target: "gone9" },
  { code: "dangling_page_flag_operation", flag_id: "gonef" },
  { code: "dangling_choice_flag_operation", choice_id: "c1", choice_text: "Open", flag_id: "gonef" },
  { code: "dangling_choice_condition", choice_id: "c1", choice_text: "Open", flag_id: "gonef" },
  { code: "start_page_unset" },
  { code: "start_page_missing", start_page: "nope9" },
  { code: "unreachable_page" },
];

describe("problemMessage", () => {
  it("produces a non-empty message for every problem code", () => {
    // Guards against adding a ProblemDetail variant without a message.
    for (const detail of ALL_CODES) {
      const message = problemMessage(detail);
      expect(message, `missing message for ${detail.code}`).toBeTruthy();
      expect(message).not.toContain("undefined");
    }
  });

  it("names the offending choice and target", () => {
    const message = problemMessage(ALL_CODES[0]);
    expect(message).toContain("Go deeper");
    expect(message).toContain("gone9");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd creation-tool && npx vitest run problemMessage`
Expected: FAIL — cannot resolve `../problemMessage`.

- [ ] **Step 3: Add the translations**

In `translations.ts`, add a top-level `problems` block before `dynamic`:

```typescript
  // Story validation
  problems: {
    title: "Problems",
    none: "No problems found",
    storyLevel: "Story",
    goToPage: "Go to page →",
    exportBlockedTitle: "Can't export yet",
    exportBlockedIntro: "Fix these before exporting:",
    close: "Close",
    severity: {
      error: "Error",
      warning: "Warning",
      info: "Info",
    },
    messages: {
      dangling_choice_target: (choiceText: string, target: string) =>
        `Choice "${choiceText}" leads to a page that no longer exists (${target}).`,
      dangling_page_flag_operation: (flagId: string) =>
        `This page sets a flag that no longer exists (${flagId}).`,
      dangling_choice_flag_operation: (choiceText: string, flagId: string) =>
        `Choice "${choiceText}" sets a flag that no longer exists (${flagId}).`,
      dangling_choice_condition: (choiceText: string, flagId: string) =>
        `Choice "${choiceText}" is shown based on a flag that no longer exists (${flagId}).`,
      start_page_unset: () => "This story has no start page set.",
      start_page_missing: (startPage: string) =>
        `The start page does not exist (${startPage}).`,
      unreachable_page: () =>
        "No choice leads to this page, so a reader can never see it.",
    },
  },
```

- [ ] **Step 4: Write the message builder**

Create `creation-tool/src/utilities/problemMessage.ts`:

```typescript
import { translations } from "../i18n";
import type { ProblemDetail } from "../types";

/**
 * Render a structured problem from the Rust validator into a sentence.
 * The backend deliberately returns codes and fields rather than prose so all
 * user-facing wording stays in translations.ts.
 */
export function problemMessage(detail: ProblemDetail): string {
  const m = translations.problems.messages;
  switch (detail.code) {
    case "dangling_choice_target":
      return m.dangling_choice_target(detail.choice_text, detail.target);
    case "dangling_page_flag_operation":
      return m.dangling_page_flag_operation(detail.flag_id);
    case "dangling_choice_flag_operation":
      return m.dangling_choice_flag_operation(detail.choice_text, detail.flag_id);
    case "dangling_choice_condition":
      return m.dangling_choice_condition(detail.choice_text, detail.flag_id);
    case "start_page_unset":
      return m.start_page_unset();
    case "start_page_missing":
      return m.start_page_missing(detail.start_page);
    case "unreachable_page":
      return m.unreachable_page();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd creation-tool && npx vitest run problemMessage`
Expected: PASS, 2 tests.

- [ ] **Step 6: Write the shared renderer**

Create `creation-tool/src/components/ProblemList.tsx`:

```tsx
import { useTranslation } from "../i18n";
import type { Problem } from "../types";
import { problemMessage } from "../utilities/problemMessage";
import clsx from "clsx";

interface ProblemListProps {
  problems: Problem[];
  /** Called with the page id when the author follows a problem's link. */
  onNavigate?: (pageId: string) => void;
}

export const ProblemList = ({ problems, onNavigate }: ProblemListProps) => {
  const { t } = useTranslation();

  if (problems.length === 0) {
    return (
      <p className="p-3 text-xs text-gray-500 italic" data-testid="problems-empty">
        {t.problems.none}
      </p>
    );
  }

  return (
    <ul className="list-none p-2 m-0 space-y-2" data-testid="problem-list">
      {problems.map((problem, i) => (
        <li
          key={`${problem.page_id ?? "story"}-${problem.detail.code}-${i}`}
          className={clsx(
            "p-2.5 rounded border text-xs",
            problem.severity === "error"
              ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200",
          )}
          data-testid={`problem-${problem.detail.code}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={clsx(
                "font-semibold uppercase tracking-wide text-[10px]",
                problem.severity === "error" ? "text-red-700" : "text-amber-700",
              )}
            >
              {t.problems.severity[problem.severity]}
            </span>
            <span className="font-medium text-gray-900">
              {problem.page_name ?? t.problems.storyLevel}
            </span>
          </div>
          <p className="text-gray-700">{problemMessage(problem.detail)}</p>
          {problem.page_id && onNavigate && (
            <button
              onClick={() => onNavigate(problem.page_id as string)}
              className="mt-1.5 text-primary hover:underline font-medium"
            >
              {t.problems.goToPage}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};
```

- [ ] **Step 7: Commit**

```bash
git add creation-tool/src/i18n/translations.ts creation-tool/src/utilities creation-tool/src/components/ProblemList.tsx
git commit -m "feat(validation): add problem messages and shared problem list"
```

---

### Task 8: Problems section in both layouts

**Files:**
- Create: `creation-tool/src/components/layout/ProblemsSection.tsx`
- Modify: `creation-tool/src/atoms/storyAtoms.ts`
- Modify: `creation-tool/src/atoms/useStoryAtoms.ts`
- Modify: `creation-tool/src/components/layout/Sidebar.tsx`
- Modify: `creation-tool/src/components/layout/BottomBar.tsx`

**Interfaces:**
- Consumes: `api.validateStory`, `<ProblemList>`
- Produces: `validationAtom`, `useStoryAtoms().problems`, `<ProblemsSection onNavigate={...} />`

- [ ] **Step 1: Add the atom**

In `atoms/storyAtoms.ts`, after `pageListAtom`:

```typescript
export const validationAtom = atom(async (get) => {
  if (!get(projectOpenAtom)) return { problems: [] };
  get(refreshAtom);
  return api.validateStory();
});
```

In `atoms/useStoryAtoms.ts`, add `const problems = useAtomValue(validationAtom).problems;` — import `validationAtom` — and return `problems` in the object.

- [ ] **Step 2: Create the section**

Create `creation-tool/src/components/layout/ProblemsSection.tsx`:

```tsx
import { useLocation } from "wouter";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import { getLinkToPage } from "../../utilities/routing";
import { ProblemList } from "../ProblemList";

interface ProblemsSectionProps {
  /** Called after navigating, so the portrait modal can close itself. */
  onNavigate?: () => void;
}

export const ProblemsSection = ({ onNavigate }: ProblemsSectionProps) => {
  const { problems } = useStoryAtoms();
  const [, setLocation] = useLocation();

  return (
    <ProblemList
      problems={problems}
      onNavigate={(pageId) => {
        setLocation(getLinkToPage(pageId));
        onNavigate?.();
      }}
    />
  );
};
```

- [ ] **Step 3: Wire the sidebar**

In `Sidebar.tsx`, import `ExclamationTriangleIcon` from `@heroicons/react/24/outline`, import `ProblemsSection`, add `problems` to the `useStoryAtoms()` destructure, and add a `Collapsible` between the Flags and Assets sections:

```tsx
        <Collapsible
          title={t.problems.title}
          icon={ExclamationTriangleIcon}
          badge={problems.length || undefined}
          className="problems-section"
        >
          <ProblemsSection />
        </Collapsible>
```

`badge={problems.length || undefined}` hides the badge at zero, matching the spec.

- [ ] **Step 4: Wire the bottom bar**

In `BottomBar.tsx`: add `"problems"` to the `ActiveModal` union, import `ExclamationTriangleIcon` and `ProblemsSection`, add `useStoryAtoms` to read `problems`, add a button beside the Flags button:

```tsx
        <button
          onClick={() => handleToggleModal("problems")}
          className={clsx(
            iconButtonClass,
            activeModal === "problems" && "bg-gray-100 text-gray-900",
          )}
          aria-label={t.problems.title}
        >
          <ExclamationTriangleIcon className="w-6 h-6" />
          <span className="text-xs mt-0.5">{t.problems.title}</span>
          {problems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-xs font-semibold min-w-[1.25rem] h-5 flex items-center justify-center rounded-full">
              {problems.length}
            </span>
          )}
        </button>
```

and the matching modal beside the others:

```tsx
      <SectionModal
        open={activeModal === "problems"}
        onClose={() => setActiveModal(null)}
        title={t.problems.title}
      >
        <ProblemsSection onNavigate={() => setActiveModal(null)} />
      </SectionModal>
```

- [ ] **Step 5: Verify**

Run: `cd creation-tool && npx tsc --noEmit && npx eslint .`
Expected: tsc clean; eslint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add creation-tool/src
git commit -m "feat(validation): show story problems in sidebar and bottom bar"
```

---

### Task 9: Blocked-export dialog and shared export flow

**Files:**
- Create: `creation-tool/src/hooks/useExportStory.ts`
- Create: `creation-tool/src/components/ExportBlockedDialog.tsx`
- Modify: `creation-tool/src/components/layout/StorySettingsSection.tsx`
- Modify: `creation-tool/src/main.tsx`

**Interfaces:**
- Consumes: `api.validateStory`, `api.exportBundle`, `<ProblemList>`
- Produces: `useExportStory(): { exportStory, blockedProblems, dismissBlocked }`, `<ExportBlockedDialog problems onClose />`

- [ ] **Step 1: Write the hook**

Create `creation-tool/src/hooks/useExportStory.ts`:

```typescript
import { useCallback, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import api from "../api";
import { translations } from "../i18n";
import type { Problem } from "../types";

/**
 * The export flow, shared by the sidebar button and the File menu.
 *
 * Validates first so a blocked export can name what is wrong. The backend
 * refuses independently; this pre-check exists for the message, not the
 * guarantee.
 */
export function useExportStory(defaultName = "story") {
  const [blockedProblems, setBlockedProblems] = useState<Problem[] | null>(null);

  const exportStory = useCallback(async () => {
    try {
      const report = await api.validateStory();
      const errors = report.problems.filter((p) => p.severity === "error");
      if (errors.length > 0) {
        setBlockedProblems(errors);
        return;
      }

      const filePath = await save({
        defaultPath: `${defaultName}.fabler`,
        filters: [{ name: "Fabler Story", extensions: ["fabler"] }],
      });
      if (!filePath) return;

      await api.exportBundle(filePath);
      alert(translations.alerts.exportSuccess);
    } catch (error) {
      console.error("Failed to export story:", error);
      alert(translations.alerts.exportFailed);
    }
  }, [defaultName]);

  const dismissBlocked = useCallback(() => setBlockedProblems(null), []);

  return { exportStory, blockedProblems, dismissBlocked };
}
```

- [ ] **Step 2: Write the dialog**

Create `creation-tool/src/components/ExportBlockedDialog.tsx`:

```tsx
import { useLocation } from "wouter";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { ProblemList } from "./ProblemList";
import { useTranslation } from "../i18n";
import { getLinkToPage } from "../utilities/routing";
import type { Problem } from "../types";

interface ExportBlockedDialogProps {
  problems: Problem[];
  onClose: () => void;
}

export const ExportBlockedDialog = ({ problems, onClose }: ExportBlockedDialogProps) => {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  return (
    <Dialog
      open
      onClose={onClose}
      title={t.problems.exportBlockedTitle}
      maxWidth="2xl"
    >
      <div data-testid="export-blocked-dialog">
        <p className="text-sm text-gray-700 mb-3">{t.problems.exportBlockedIntro}</p>
        <div className="max-h-[50vh] overflow-y-auto">
          <ProblemList
            problems={problems}
            onNavigate={(pageId) => {
              setLocation(getLinkToPage(pageId));
              onClose();
            }}
          />
        </div>
        <Button onClick={onClose} variant="secondary" className="w-full mt-4">
          {t.problems.close}
        </Button>
      </div>
    </Dialog>
  );
};
```

- [ ] **Step 3: Use it in the sidebar**

In `StorySettingsSection.tsx`, delete the local `handleExportBundle` and the now-unused `save`/`api` imports, then:

```tsx
  const { exportStory, blockedProblems, dismissBlocked } = useExportStory(storyTitle);
```

Change the export button's `onClick` to `exportStory`, and render before the closing tag:

```tsx
      {blockedProblems && (
        <ExportBlockedDialog problems={blockedProblems} onClose={dismissBlocked} />
      )}
```

- [ ] **Step 4: Use it in the menu listener**

In `main.tsx`, the `export-story` listener currently duplicates the save/export/alert flow. Replace the `App` body's export handling: call `useExportStory()` at the top of `App`, change the listener to `listen("export-story", () => void exportStory())`, add `exportStory` to the effect's dependency array, and render the dialog inside `ErrorBoundary`:

```tsx
      {blockedProblems && (
        <ExportBlockedDialog problems={blockedProblems} onClose={dismissBlocked} />
      )}
```

- [ ] **Step 5: Remove the orphaned imports**

Both files lose their inline export flow, so imports go unused. `eslint` is
configured to treat that as an error, so this is not optional:

- `StorySettingsSection.tsx`: drop `save` (from `@tauri-apps/plugin-dialog`)
  and `api` if nothing else in the file uses them.
- `main.tsx`: drop `save` and, if now unused, `api` and `translations`.

- [ ] **Step 6: Verify**

Run: `cd creation-tool && npx tsc --noEmit && npx eslint . && yarn build`
Expected: tsc clean, eslint 0 errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add creation-tool/src
git commit -m "feat(export): show blocked-export dialog listing structural errors"
```

---

### Task 10: End-to-end coverage

**Files:**
- Create: `creation-tool/e2e/validation.spec.ts`
- Modify: `creation-tool/e2e/helpers.ts`

**Interfaces:**
- Consumes: `invoke` helpers, `test_server` `validate_story` and `export_bundle` arms

- [ ] **Step 1: Add the helpers**

Append to `creation-tool/e2e/helpers.ts`:

```typescript
export async function validateStoryViaApi(request: APIRequestContext) {
  return invoke<{ problems: Array<Record<string, unknown>> }>(request, "validate_story");
}

/** Returns true when the backend allowed the export. */
export async function exportBundleViaApi(request: APIRequestContext): Promise<boolean> {
  const response = await request.post(`${API_BASE}/invoke`, {
    data: JSON.stringify({ cmd: "export_bundle", args: {} }),
    headers: { "Content-Type": "application/json" },
  });
  return response.ok();
}
```

- [ ] **Step 2: Write the spec**

Create `creation-tool/e2e/validation.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  resetProject,
  createPageViaApi,
  getPageViaApi,
  savePageViaApi,
  listPagesViaApi,
  navigateToEditor,
  exportBundleViaApi,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetProject(request);
});

/** Point the start page's first choice at a page id that does not exist. */
async function addDanglingChoice(request: APIRequestContext) {
  const pages = await listPagesViaApi(request);
  const start = await getPageViaApi(request, pages[0].id);
  start.choices.push({
    id: "cdead",
    text: "Go deeper",
    target: "gone9",
    flag_operations: [],
    conditions: [],
  });
  await savePageViaApi(request, start);
  return start;
}

test.describe("Story problems", () => {
  test("a clean story reports no problems", async ({ page }) => {
    await navigateToEditor(page);
    await page.getByRole("button", { name: /problems/i }).click();
    await expect(page.getByTestId("problems-empty")).toBeVisible();
  });

  test("a dangling choice target is listed with its page", async ({ page, request }) => {
    await addDanglingChoice(request);
    await navigateToEditor(page);

    await page.getByRole("button", { name: /problems/i }).click();
    const problem = page.getByTestId("problem-dangling_choice_target");
    await expect(problem).toBeVisible();
    await expect(problem).toContainText("Go deeper");
    await expect(problem).toContainText("Start");
  });

  test("following a problem link opens the offending page", async ({ page, request }) => {
    const start = await addDanglingChoice(request);
    await navigateToEditor(page);

    await page.getByRole("button", { name: /problems/i }).click();
    await page
      .getByTestId("problem-dangling_choice_target")
      .getByRole("button", { name: /go to page/i })
      .click();

    await expect(page).toHaveURL(new RegExp(`/editor/page/${start.id}$`));
    await expect(page.locator("#page-title-input")).toHaveValue("Start");
  });

  test("export is blocked and the dialog names the problem", async ({ page, request }) => {
    await addDanglingChoice(request);
    await navigateToEditor(page);

    await page.getByRole("button", { name: /export \.fabler/i }).click();

    const dialog = page.getByTestId("export-blocked-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Go deeper");
  });

  test("the backend refuses a blocked export even without the UI", async ({ request }) => {
    await addDanglingChoice(request);
    expect(await exportBundleViaApi(request)).toBe(false);
  });

  test("fixing the problem unblocks export", async ({ request }) => {
    const start = await addDanglingChoice(request);
    expect(await exportBundleViaApi(request)).toBe(false);

    start.choices = [];
    await savePageViaApi(request, start);

    expect(await exportBundleViaApi(request)).toBe(true);
  });

  test("a warning does not block export", async ({ request }) => {
    // A page nothing links to is unreachable — a warning, not an error.
    await createPageViaApi(request, "Orphan");
    expect(await exportBundleViaApi(request)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the suite**

Run: `cd creation-tool && yarn test:e2e`
Expected: PASS, 17 tests (10 existing + 7 new).

- [ ] **Step 4: Verify the tests catch the regression**

Temporarily comment out the `report.has_errors()` guard in `export.rs`, run `yarn test:e2e --grep "blocked|refuses"`, confirm those tests FAIL, then restore the guard and confirm they pass again.

- [ ] **Step 5: Full verification**

Run: `yarn verify && cd creation-tool && yarn test:e2e && cd ../player && npx playwright test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add creation-tool/e2e
git commit -m "test(validation): cover problem list, links, and blocked export end to end"
```

---

## Self-Review Notes

**Spec coverage.** Four rules → tasks 1–4. Two-layer enforcement → task 5 (backend guarantee) and task 9 (UI pre-check). Command wiring six-step checklist → task 6. Structured-not-prose + i18n → task 7. Badge counts all problems and hides at zero → task 8 step 3. Empty state → task 7 step 6 (`problems-empty`). Story-level problems render without a link → task 7 step 6 (`page_id && onNavigate` guard). `unreachable_pages` silent on invalid start page → task 4 step 1. Export stub replaced so blocked export is testable → task 6 step 2.

**Deferred deliberately.** No `Info`-emitting rule (spec non-goal). No reader-side import validation (spec non-goal). No auto-fix (spec non-goal, tracked in `docs/TODO.md`).
