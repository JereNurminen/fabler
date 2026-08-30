# Rust → TypeScript type generation — design

Date: 2026-08-26
Status: approved for implementation
Phase 3 of the maintainability programme in `docs/TODO.md`. Finding [13].

## Problem

The same data model is written out by hand three times: once in Rust, and
again in `creation-tool/src/types.ts`, `player/engine/types.ts` and
`reader/src/types.ts` — 213 lines of TypeScript mirroring roughly 20 Rust
types. Nothing checks that the copies agree.

They already disagree. `player/engine/types.ts`'s `ManifestPage` declares
`assets: string[]`, a field Rust's `Page` does not have. It is always `[]`,
nothing production reads it, and two test assertions keep it alive.

The mirroring is also inconsistent in a way that hides work. The player does
not merely copy the Rust types, it *renames* them: `ManifestFlag`,
`ManifestPage`, `ManifestChoice`, `ManifestFlagOperation` and
`ManifestCondition` are TypeScript inventions for things Rust calls `Flag`,
`Page`, `Choice`, `FlagOperation` and `Condition`. Rust's `Manifest` embeds
those types directly; the prefix exists only on the TypeScript side.

And there is a third mirroring site that is easy to miss: `SavedState`,
`SlotInfo` and `GameState` are defined in the **reader's** Rust *and* in the
**player's** TypeScript, kept in agreement by explicit
`#[serde(rename = "gameState")]`-style attributes.

Every type added from here on — including the editor metadata the planned
graph view needs — multiplies this by hand.

## Goals

- One source of truth for every type that crosses the Rust/TypeScript boundary.
- Drift becomes impossible to commit: CI fails if regenerating changes anything.
- The known drift (`assets`) is eliminated rather than regenerated.
- The two names for one concept (`Page` / `ManifestPage`) collapse to one.

## Non-goals

- Generating command bindings. `api.ts` is deliberately dual-mode — Tauri
  `invoke()` in production, HTTP `fetch` in tests — and tools that generate
  typed commands only understand the Tauri half. The player is not a Tauri app
  at all.
- Normalising the save wire format. See "A deliberate inconsistency" below.
- Any behaviour change. Nothing here should alter what the apps do at runtime.
- Prettifying generated output. It is machine-written and machine-checked.

## What the spike established

ts-rs was not designed against; it was measured. A throwaway spike derived
`TS` on `Story`, `Flag`, `Severity`, `ProblemDetail` and `Problem`, ran the
export, inspected the output, and was reverted. Findings, all load-bearing:

| Question | Measured answer |
|---|---|
| Version | ts-rs **12.0.1** |
| Output shape | **One file per type**, named after the type |
| Cross-type imports | Relative — `import type { Flag } from "./Flag"` |
| Index file | **None is generated** |
| `#[serde(rename_all = "snake_case")]` on a unit enum | Honoured → `"error" \| "warning" \| "info"` |
| `#[serde(tag = "code", rename_all = ...)]` | Honoured → a discriminated union keyed on `"code"` |
| `Option<String>` | → `string \| null` |
| Rust doc comments | Carried through as TSDoc |
| `export_to` base directory | Relative to the **source file's** directory, not the crate root |

Two of these would have been guessed wrong. There is no generated index, so
the design needs one. And an `export_to` written relative to the crate root
emits files **outside the repository** — the spike's first attempt did exactly
that, silently.

The serde result is the one that matters: generated output is *semantically
identical* to the hand-written types. This is a mechanical migration, not a
semantic one.

## Architecture

### Part 1 — the save types move to `shared/`

`GameState` (renamed from the reader's `GameStateData`), `SavedState` and
`SlotInfo` move into a new `shared/src/save.rs`. The reader's
`storage.rs` imports them instead of defining them.

This is not cosmetic. The **player** needs `SavedState` and `SlotInfo` for its
`StorageAdapter` interface, but the Rust definitions live in the **reader** —
so generating them where they sit would make `@fabler/player` depend on types
generated from the reader, inverting the package dependency. Moving them to
`shared/`, which both already depend on, is what makes the rest possible.

#### A deliberate inconsistency, preserved

These three types carry camelCase serde renames (`gameState`, `slotId`,
`currentPageId`) while every other type in the project serialises as
snake_case. The renames are kept exactly as they are.

Keeping them means the generated TypeScript matches the existing TypeScript
character for character, so these types migrate with zero consumer churn.
Normalising the save format would be a wire-format change wearing a
type-generation costume — a different piece of work, with its own risk, that
happens to touch the same files. It is recorded in `docs/TODO.md` instead.

### Part 2 — codegen

ts-rs derives on exactly these, and nothing else:

- `models.rs` — `Story`, `Flag`, `Page`, `Choice`, `FlagOperation`,
  `Condition`, `PageListItem`
- `content.rs` — `Document`, `Block`, `Inline`, `Mark`
- `bundle.rs` — `Manifest`, `ManifestStory`
- `validation.rs` — `Severity`, `ProblemDetail`, `Problem`, `Report`
- `save.rs` (new, Part 1) — `GameState`, `SavedState`, `SlotInfo`
- `reader/src-tauri/src/library.rs` — `InstalledStory`

Twenty-one types. Deliberately excluded: `BundleContents` and `BundleError`
(internal to packing, never serialised to the frontend) and `StoryContext`
(a borrowed lifetime type that exists only during validation).

They emit into a new yarn workspace package:

```
types/
  package.json          @fabler/types
  src/*.ts              generated, one file per type, committed
  index.ts              generated by a script
```

A workspace package rather than a path alias, because three packages consume
these types and the repo already resolves `@fabler/player` this way — no new
mechanism to learn or configure per-bundler.

`export_to` is `"../../types/src/"` from `shared/src/`, and
`"../../../types/src/"` from `reader/src-tauri/src/` — both relative to the
source file, per the spike.

Because ts-rs emits no index, a script globs `types/src/*.ts` and writes one.
It is generated rather than hand-written on purpose: a hand-maintained index
is itself a drift risk, and the freshness check below would not catch a type
someone forgot to re-export.

### Part 3 — one way to say each thing

`creation-tool/src/types.ts` and `reader/src/types.ts` are deleted outright.

`player/engine/types.ts` keeps exactly seven things, the ones with no Rust
counterpart: `FlagState`, `StorageAdapter`, `AssetResolver`, `FontSize`,
`Theme`, `UserPreferences` and `DEFAULT_PREFERENCES`. Everything else it
currently declares becomes generated — including `GameState`, `SavedState` and
`SlotInfo`, which Part 1 moves into `shared/`. It re-exports the generated
types, so `@fabler/player/engine/types` remains a working public API for an
embedder who has not installed `@fabler/types`.

`FlagState` stays hand-written because it is a TypeScript convenience alias
(`Record<string, boolean>`) that `runtime.ts` uses directly; Rust expresses the
same thing inline as `HashMap<String, bool>` inside `GameState`.

The renames, which `tsc` will locate exhaustively:

| Was | Becomes |
|---|---|
| `ManifestFlag` | `Flag` |
| `ManifestPage` | `Page` |
| `ManifestChoice` | `Choice` |
| `ManifestFlagOperation` | `FlagOperation` |
| `ManifestCondition` | `Condition` |
| `ValidationReport` | `Report` |

`Manifest` and `ManifestStory` keep their names — Rust has those types.

The generated `Page` has no `assets`, so `convertToManifest.ts` stops setting
it and the two assertions that pinned the ghost field are deleted.

## Drift enforcement

`yarn codegen` runs the exports and regenerates the index. CI runs
`yarn codegen` then `git diff --exit-code types/`, so a Rust type change that
was not regenerated fails the build. Generated files are committed, which
keeps a type change's TypeScript blast radius visible in review and means a
checkout does not need a working Rust toolchain merely to typecheck.

## Testing

There are no new unit tests to write: this phase adds no behaviour. Its
correctness is established by four gates, all of which already exist.

- `tsc --noEmit` across all three packages is the real proof. Every one of the
  28 consumer files must compile against the generated types, and a rename or
  a dropped field that was missed cannot pass.
- `cargo test --workspace` — the save-type move must not disturb the reader's
  storage round-trip, which is already covered by its existing tests.
- The e2e suites (18 creation-tool, 16 player) are the behaviour backstop. If
  any fails, something changed at runtime and the change is wrong, since this
  phase is meant to be inert.
- `yarn codegen && git diff --exit-code types/` — the freshness check, proven
  by making a Rust type change and confirming the check fails.

## Risk

This has the largest blast radius of any phase so far: 28 consumer files plus
a Rust module move. What makes it tractable is that it is almost entirely
mechanical — the spike showed generated output is semantically identical to
what it replaces, so nothing changes at runtime, and the compiler locates
every site that must change. The danger is not subtle breakage; it is volume.
