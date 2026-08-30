# Story validation — design

Date: 2026-08-26
Status: approved for implementation

## Problem

Nothing checks that a story is structurally coherent. Deleting a page leaves
every choice that targeted it dangling; deleting a flag leaves flag operations
and conditions referencing an id that no longer exists. These survive into
exported `.fabler` bundles, where a reader hits them as broken gameplay.

Runtime hardening already landed (`navigate()` refuses to move to a missing
page), so a dangling target degrades gracefully instead of ending the story.
This design covers the other half: telling the author the problem exists, and
refusing to export a story that has one.

## Goals

- Detect structural problems in a story and report them as structured data.
- Block export on problems severe enough to break a reader.
- Make adding a new validation a one-function, one-line change.
- Show the author what is wrong and let them jump straight to the offending
  page.

## Non-goals

- Repairing problems automatically, or cascading cleanup when a page or flag
  is deleted. Detection only; the delete-time policy is a separate decision
  (see `docs/TODO.md`, "Prevent and clean up dangling references").
- Validating bundles on import in the reader. The rules live in `shared/` so
  this stays possible later, but nothing in the reader calls them yet.
- Any Info-severity check. The severity exists and is plumbed end to end, but
  no v1 rule emits it.

## Architecture

Rules live in Rust, in `shared/src/validation.rs`, beside `bundle.rs` — the
same domain. Three reasons over a TypeScript implementation:

1. Export is a backend operation. A block enforced only in the frontend is
   advisory, not a block.
2. The Rust layer is where this repo's tests are strongest.
3. `shared/` is reachable from the reader, leaving import validation open.

The cost: validation reads every page file, and the badge is live, so a full
story read happens per mutation. Stories are small local JSON files, so this
is acceptable now. It does compound the existing refetch cascade; that is
tracked separately rather than pre-optimised here.

### Rule registry

```rust
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
```

`StoryContext` precomputes `HashSet<&str>` of page ids and flag ids, plus a
`&str -> &Page` lookup, so rules stay linear rather than quadratic. Rules are
pure functions over the context: no I/O, independently testable.

**Adding a validation** = write one `fn(&StoryContext) -> Vec<Problem>`, add
one line to `RULES`, write its test. Nothing else changes — not the command,
not the types, not the UI, provided it reuses an existing `ProblemDetail`
variant. A genuinely new problem kind additionally needs a `ProblemDetail`
variant, its TS mirror, and a message key.

### Data model

```rust
#[derive(Serialize, Deserialize, ...)]
#[serde(rename_all = "snake_case")]
pub enum Severity { Error, Warning, Info }

pub struct Problem {
    pub severity: Severity,
    /// Page this problem belongs to; None for story-level problems.
    pub page_id: Option<String>,
    /// Page name at validation time, so the UI need not look it up.
    pub page_name: Option<String>,
    pub detail: ProblemDetail,
}

#[serde(tag = "code", rename_all = "snake_case")]
pub enum ProblemDetail {
    DanglingChoiceTarget { choice_id: String, choice_text: String, target: String },
    DanglingPageFlagOperation { flag_id: String },
    DanglingChoiceFlagOperation { choice_id: String, choice_text: String, flag_id: String },
    DanglingChoiceCondition { choice_id: String, choice_text: String, flag_id: String },
    StartPageUnset,
    StartPageMissing { start_page: String },
    UnreachablePage,
}

pub struct Report { pub problems: Vec<Problem> }

impl Report {
    pub fn errors(&self) -> impl Iterator<Item = &Problem>;
    pub fn error_count(&self) -> usize;
    pub fn has_errors(&self) -> bool;  // ignores Warning and Info
}
```

Rust deliberately emits a **code plus fields, never prose**. The project rule
is that all user-facing strings live in `i18n/translations.ts`; if validation
returned English sentences it would be the one feature bypassing i18n. TS owns
the wording.

`display_order` sorts Error before Warning before Info, then by page name,
then by code — deterministic, so tests and the UI agree on ordering.

### The four v1 rules

| Rule | Severity | Emits |
|---|---|---|
| `dangling_choice_targets` | Error | `DanglingChoiceTarget` |
| `dangling_flag_references` | Error | `DanglingPageFlagOperation`, `DanglingChoiceFlagOperation`, `DanglingChoiceCondition` |
| `start_page_valid` | Error | `StartPageUnset`, `StartPageMissing` |
| `unreachable_pages` | Warning | `UnreachablePage` |

`unreachable_pages` walks choice targets from the start page and reports any
page not visited. It treats every choice as traversable regardless of its
conditions — a choice gated behind an unsatisfiable flag combination still
counts as reachable. Modelling flag reachability is a much harder problem and
would produce false positives on legitimate designs.

If the start page is itself unset or missing, `unreachable_pages` returns
nothing rather than reporting every page in the story as unreachable.

## Enforcement

Two independent layers.

**Structured, for the UI:** a `validate_story` command returning `Report`.

**The guarantee:** `export::export_bundle` validates first and returns
`AppError::ExportBlocked(error_count)` when errors exist. This is a plain
string at the command boundary. The UI never depends on it — it pre-checks via
`validate_story` and shows the dialog — but it means export cannot be bypassed
by a frontend bug or a direct command call.

Warnings never block. A story with only unreachable pages exports fine.

`Project` gains `read_all_pages()`, extracted from the loop currently inlined
in `export_bundle` and reused by `validate()`.

## Command wiring

Following the checklist in `CLAUDE.md`:

1. `Project::validate()` in `project/mod.rs`
2. `#[tauri::command] validate_story` in `commands.rs`
3. register in `main.rs` `invoke_handler`
4. `api.ts` — both `buildHttpApi()` and `buildTauriApi()`
5. `test_server.rs` — a `validate_story` match arm
6. `types.ts` — `Severity`, `ProblemDetail`, `Problem`, `ValidationReport`

`exportBundle` is currently a no-op stub in HTTP test mode
(`async () => {}`), which makes export unreachable from e2e. It gets a real
implementation against the test server, writing to a temp path, so blocked
export is actually testable.

## Frontend

- `atoms/storyAtoms.ts` — `validationAtom`, async, derived off the existing
  `refreshAtom` so it refreshes with every mutation.
- `components/ProblemList.tsx` — renders a `Problem[]`, grouped by page, each
  entry linking to its page. **One renderer**, used by both surfaces below.
- `components/layout/ProblemsSection.tsx` — the sidebar section, with a live
  count badge. The badge counts **all** problems, errors and warnings alike,
  matching the other section badges; it is hidden at zero. With no problems
  the section shows an empty state rather than disappearing, so the author can
  tell "checked, all clear" from "not checked".
- `components/ExportBlockedDialog.tsx` — `Dialog` + `ProblemList`, shown when
  export is refused.
- `hooks/useExportStory.ts` — the export flow (pick path, pre-validate, export
  or open the dialog). Export currently happens in two places,
  `StorySettingsSection` and the `main.tsx` menu listener; both switch to this
  hook, removing that duplication.
- `Sidebar.tsx` gets a `Collapsible`; `BottomBar.tsx` gets the matching
  `SectionModal`, mirroring how every other section already works.
- `i18n/translations.ts` — a `problemMessages` map keyed by problem code, plus
  severity labels and dialog copy.

Story-level problems (`StartPageUnset`, `StartPageMissing`) have no
`page_id`. They render under a "Story" heading with no page link.

## Testing

**Rust, `shared/src/validation.rs`** — per rule: a clean story producing no
problems, and each violation it can emit. Plus: `has_errors` ignores warnings;
`display_order` is deterministic; `unreachable_pages` stays silent when the
start page is invalid.

**Rust, `creation-tool`** — `export_bundle` refuses when errors exist and
writes nothing; succeeds when the only problems are warnings; succeeds on a
clean story. `Project::validate` reads all pages.

**TS unit** — message rendering for every `ProblemDetail` code, so a new
variant without a message is caught.

**E2E** — the whole path: introduce a dangling target via the API, see the
Problems badge, click through to the offending page, attempt export, see the
blocked dialog listing it, fix it, export succeeds. Plus: a warning-only story
exports without being blocked.

Every regression test is verified to fail against the pre-fix behaviour before
being accepted.
