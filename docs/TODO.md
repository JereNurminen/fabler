# Fabler — outstanding work

High-level todos from the codebase review of 2026-08-26. Items are grouped by
kind and carry a rough size. Numbers in brackets are the finding ids from that
review, kept so discussion threads stay traceable.

Done since the review: build/lint/CI restoration [1][2], stable story ids [3],
player dead-end fix [4], story-structure validation (detection half of [5]),
mechanical hygiene, and the component cleanup — [9], [10] and [12] are done,
see `docs/superpowers/specs/2026-08-26-component-cleanup-design.md`.

**eslint is now 0 warnings**, with `no-floating-promises` and
`no-misused-promises` enforced as errors (`ignoreVoid: false`).

## Correctness

- [ ] **Prevent and clean up dangling references** [5] — *medium*
      **Detection shipped.** Validation now reports dangling choice targets and
      dangling flag references, blocks export on them, and links the author to
      the offending page. What remains is the *prevention* half: deciding what
      happens at delete time (block the delete, cascade-clean the references,
      or warn and proceed), and offering a one-click fix from the problems
      list rather than making the author hand-edit each site.
- [ ] **`AssetResolver.getAssetUrl` async branch is dead** [6] — *small*
      The interface promises `string | Promise<string>`, but every call site
      does `typeof src === "string" ? src : ""`, so a Promise-returning
      resolver silently renders nothing. Either drop the async half from the
      type or make the renderers await it.
- [ ] **Open-project dialog filter is wrong** — *trivial*
      `StartPage.tsx` filters on `extensions: ["story.json"]`; Tauri dialog
      filters take single-segment extensions, so this likely matches nothing
      and users cannot select their own project file.

## Security

- [ ] **Sanitize rendered markdown** [7] — *medium*
      `ContentRenderer` passes `marked` output straight to
      `dangerouslySetInnerHTML` with no sanitizer. In the reader that content
      comes from a downloaded `.fabler` bundle, and both apps set
      `"csp": null`. Needs a sanitizer pass plus a real CSP.
- [ ] **Tighten asset access** [8] — *small*
      The creation tool's `assetProtocol` scope is `["**"]` — the whole
      filesystem; the reader correctly scopes to `$APPDATA/**`. Separately,
      `library.rs::get_asset_path` joins a caller-supplied name with no
      traversal check.

## Maintainability

- [ ] **Break up `PageCard.tsx`** [9] — *medium*
      ~405 lines with ten near-identical async handlers; six differ only in
      the choice-patch body. Collapses to `updatePage`/`updateChoice` helpers
      plus an extracted `<ChoiceEditor>`. All ten currently swallow write
      failures into `console.error` — a failed disk write is invisible to the
      author.
- [ ] **Merge `FlagOperations` and `ChoiceConditions`** [10] — *small*
      ~90% identical; they differ only in the value control (operation string
      vs boolean).
- [ ] **Reduce save-time refetch cascade** [11] — *medium*
      Every page save bumps `refreshAtom`, invalidating story *and* page list;
      `list_pages` then re-parses every page file to extract `{id, name}`.
      Story validation adds another full read per mutation. Derive the list
      from filenames, or scope invalidation per atom.
- [ ] **Stop drilling seven props through `MainLayout`** [12] — *small*
      `Sidebar` and `BottomBar` take the same seven props and already call
      `useStoryAtoms()` internally anyway.
- [ ] **Generate TS types from Rust** [13] — *medium*
      `Document`/`Block`/`Inline`/`Mark` and the flag/choice/condition shapes
      are hand-maintained in three places. `ManifestPage.assets` is already a
      ghost field — present in TS, absent in Rust. `ts-rs` or `typeshare`
      removes the whole category.
- [ ] **Clear remaining dead code** — *small*
      `import.rs` (`import_bundle_to_project` is unreachable — the Import menu
      item is wired to an empty listener), `migration.rs` (never called),
      `read_asset_base64` (registered in both apps, called by neither),
      `AppError::NoProjectOpen`, `Project::dir`. Kept deliberately for now as
      scaffolding for planned features; delete once those land or are dropped.

## Product gaps

- [ ] **Persist player preferences** [14] — *small*
      `usePreferences` never touches storage, so font size and theme reset
      every launch despite `StorageAdapter` being available. The reader also
      hardcodes `data-theme="light"` on its shells.
- [ ] **Close i18n gaps** [15] — *small*
      ~8 strings bypass `translations.ts` (`MarkdownEditor`, `AssetsSection`,
      `StoryEditorPage`, `PreviewView`); `StartPage` hedges with
      `t.buttons.x || "literal"` for keys that exist. The reader and the
      player package have no i18n layer at all.

## Deferred from the component cleanup

- [ ] **Two residuals from the final fix wave** — *small, do together*
      1. `SelectWithCreate.test.tsx` is a FALSE PROOF: it was added to guard
         the "page creation fails silently" fix, but it hand-writes its own
         conformant `onCreate` and never exercises `PageCard`'s
         `onCreatePage`. Reverting the fix leaves all 34 tests green. The fix
         itself is correct and verified; only its guard is decorative. A test
         that implies coverage it does not provide is worse than none.
      2. Five empty `.catch(() => {})` in `SelectWithCreate.tsx` (×2) and
         `StartPage.tsx` (×3), added to satisfy `ignoreVoid: false`. Justified
         as "these never reject", but nothing enforces that: a future edit
         moving a call outside the inner try turns them into exactly the
         silent-failure bug this phase removed. Use
         `.catch((e: unknown) => console.error(...))` instead — same rule
         satisfied, honest if the assumption breaks.

- [ ] **Stale-closure race can silently drop an edit** — *medium*
      `usePageMutations` builds each write from the `page` snapshot it
      captured, and `pageAtomFamily` only refreshes after the write completes.
      The trigger is not exotic: **type in a choice's text field, then click a
      condition button** — the blur-commit and the rule-commit both read the
      same `page`, so the second whole-page write drops the first edit. Predates
      the refactor (verified byte-identical) and its root cause is atom-refresh
      timing, so it belongs with the refetch-cascade work [11].

- [ ] **The save-status indicator is unreachable during modal writes** — *small*
      HeadlessUI portals `Dialog` and inerts the rest of `body`, so
      `<SaveStatus />`'s `role="alert"` is never announced and the badge sits
      dimmed behind the backdrop. Affects every `FlagsDialog` write and
      portrait-mode asset writes — a whole class of writes whose failures are
      degraded rather than visible.

- [ ] **`vitest.config.ts` has an invisible type error** — *trivial*
      `plugins: [react()]` mismatches because vitest bundles its own copy of
      vite. No project gate sees it: `tsconfig.json` includes only
      `["src", "e2e"]`, so package-root config files are typechecked by
      nothing. `react() as PluginOption` fixes it; do not delete the plugin
      blind.

## Deferred from the validation build

Recorded during the story-validation implementation. None block use; listed so
they are not silently lost now that the run's scratch workspace is gone.

- [ ] **Thin Rust rule tests** — *small*
      `does_not_report_flag_references_that_resolve` omits the choice-level
      `flag_operations` site. `reports_an_unset_start_page` does not assert the
      `page_id: None` story-level contract (the sibling variant does).
      `stays_silent_when_the_start_page_is_invalid` covers only the "missing"
      branch, not the "unset" one.
- [ ] **`AppError::ExportBlocked` pluralization** — *trivial*
      Reads "1 structural error(s)". Console-only — authors see
      `t.alerts.exportFailed` — and it matches the surrounding `AppError`
      style, so this is cosmetic.
- [ ] **Broad `try/catch` in `useExportStory`** — *small*
      A throw from `validateStory()` surfaces as "Failed to export story".
      Not misleading (export genuinely did not happen), but a distinct message
      would be better.
- [ ] **`unreachable_pages` enqueues duplicates** — *trivial*
      A node can be pushed more than once before dedup. Harmless at story-file
      scale; noted only so it is a known choice rather than an oversight.
- [ ] **Unnecessary `mut` in a reader test closure** — *trivial*
      `reader/src-tauri/src/library.rs:210`. Predates the validation work.

## Engineering hygiene

- [ ] **Resolve the 36 deferred lint warnings** — *medium*
      `no-floating-promises` / `no-misused-promises` across async `onClick`
      handlers and unawaited saves. Same root cause as the swallowed errors in
      [9]; fix together, then promote both rules back to `error`.
- [ ] **Typecheck test files** — *small*
      `player/tsconfig.json` excludes `**/__tests__/**`, which let a fixture
      set `body` to a bare string where the type is a `Document`.
- [ ] **Get `cargo fmt --check` clean and clear clippy** — *small*
      `cargo fmt --all` produces a large mechanical diff, so it was left out
      of CI; clippy runs advisory because of ~15 warnings. Once clean, gate on
      both.
- [ ] **Harden the e2e harness against cold Rust builds** — *small*
      `creation-tool/scripts/test-with-backend.sh` waits 30s for the test
      server on port 3001. After a dependency change forces a cold rebuild
      that window can be missed, and the observed failure mode is a dozen-plus
      confusing test timeouts rather than one clear "server never started".
      Seen once during the Phase 1 cleanup; did not reproduce on a clean run.
      Raise the timeout and fail loudly with a distinct message.

- [ ] **Add frontend component tests** — *medium*
      4 unit tests, all on `convertToManifest`. The atoms layer, `PageCard`
      save logic, and the flag/condition editors are covered only by e2e.
