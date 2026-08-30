# Component cleanup — design

Date: 2026-08-26
Status: approved for implementation
Phase 2 of the maintainability programme in `docs/TODO.md`.

## Problem

Three defects share one root.

`PageCard.tsx` is 405 lines containing twelve near-identical async handlers.
Six differ only in the object patch they apply to a choice. Eleven of them end
in `console.error`, so a failed disk write is **invisible to the author**; the
twelfth, `handleCreateFlag`, has no error handling at all.

Separately, eslint reports 35 warnings — 23 `no-misused-promises` and 12
`no-floating-promises` — spread across **nine** files, not just `PageCard`.
Both rules fire for the same reason: async functions are handed to `onClick`
and `onBlur`, which expect `void`, and nothing handles their rejection.

`FlagOperations.tsx` (117 lines) and `ChoiceConditions.tsx` (120) are roughly
90% identical. `MainLayout` forwards seven props to two children that already
read most of that data from atoms themselves.

The lint warnings could be silenced cheaply. That would leave the real bug —
authors cannot tell when a write failed — while making it look addressed.

## Goals

- Failed writes become visible to the author, wherever they originate.
- The 35 lint violations disappear *because the rejection is handled*, after
  which both rules are promoted to `error`.
- `PageCard` becomes readable; the twelve handlers collapse to four.
- The duplicated flag/condition editors become one component.
- `MainLayout` stops drilling props its children can read themselves.

## Non-goals

- The save-time refetch cascade (Phase 3 in `docs/TODO.md`).
- Generating TypeScript types from Rust (Phase 4).
- Broad component-test coverage. Tests here are targeted at what is refactored.
- Replacing the `alert()` calls in the export flow. Export is not a save, it
  already reports outcomes, and touching it would widen this phase.

## Architecture

### Write status is global, the indicator is a view of it

The chosen UX is an inline save-status indicator rather than toasts. On its
own that would only cover the page editor, while the failing writes are spread
across nine files. So the status lives in an atom and the indicator renders it:

```ts
// atoms/saveStatus.ts
export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "failed"; message: string };

export const saveStatusAtom = atom<SaveStatus>({ state: "idle" });
```

Any mutation anywhere reports into it. `<SaveStatus />` renders once in the
editor chrome. An asset upload, a flag edit and a page save all surface in the
same place.

Two display rules, deliberately asymmetric:

- `saved` **auto-clears** to `idle` after 3 seconds. It is reassurance, not
  information; a permanent "saved" badge is noise.
- `failed` **does not auto-clear**. It persists until the next write succeeds,
  because a message the author might miss is the failure mode being fixed.

The timer lives in the component, not the atom — it is a display concern.

`StartPage` is excluded: it runs before any editor chrome exists and already
has its own inline error display.

### One utility fixes the bug and the lint together

```ts
// hooks/useTrackedAction.ts
export function useTrackedAction<A extends unknown[]>(
  fn: (...args: A) => Promise<unknown>,
): (...args: A) => void;
```

It sets `saving`, awaits, then sets `saved` or `failed`, and returns a
**void-returning** callback.

That return type is the point. `no-misused-promises` fires when a
promise-returning function is passed where `void` is expected;
`no-floating-promises` fires when a promise is left unhandled. A void-returning
callback that handles its own rejection violates neither. The 35 warnings go
away as a consequence of fixing the bug rather than by suppression, after which
both rules move from `warn` to `error` in `eslint.config.js`.

Concurrency is last-write-wins: two overlapping saves leave the status of
whichever settles last. Writes here are small, per-field, and already
serialized by the UI, so this is adequate and not worth a request-id scheme.

The failure message is composed from a translated label plus the raw backend
error, matching the existing `t.dynamic.errorMessage` pattern. No English
string is introduced outside `translations.ts`.

### PageCard decomposition

```ts
// hooks/usePageMutations.ts
export function usePageMutations(page: Page | null): {
  updatePage: (patch: Partial<Page>) => void;
  updateChoice: (choiceId: string, patch: Partial<Choice>) => void;
  addChoice: () => void;
  removeChoice: (choiceId: string) => void;
};
```

Both take a partial and merge it into the current entity before persisting the
whole thing — `updatePage(patch)` saves `{...page, ...patch}`, and
`updateChoice(id, patch)` replaces the matching choice with `{...choice,
...patch}` within the page's choice list. The backend save API takes a whole
`Page`, so a patch-shaped call site is a convenience, not a partial write.

Built on `useTrackedAction`, so error handling lives at one seam instead of
eleven. This covers eleven of the twelve current handlers; `handleCreateFlag`
mutates the *story* rather than the page and stays in `PageCard`, wrapped in
`useTrackedAction` so it reports status too.

The flag-rule list manipulation repeated across six handlers becomes two pure,
independently testable functions:

```ts
// utilities/flagRules.ts
export function upsertFlagRule<T extends { flag_id: string }>(list: T[], rule: T): T[];
export function removeFlagRule<T extends { flag_id: string }>(list: T[], flagId: string): T[];
```

`<ChoiceEditor>` is extracted for the per-choice JSX. `PageCard` is left at
roughly 120 lines of layout.

### FlagRuleList

Both editors are "pick a flag, then pick a value". One component takes the
value set as data rather than needing render props:

```ts
interface FlagRuleListProps<V extends string> {
  rules: Array<{ flag_id: string; value: V }>;
  availableFlags: Flag[];
  valueOptions: Array<{ value: V; label: string }>;
  onAdd: (flagId: string, value: V) => void;
  onRemove: (flagId: string) => void;
  onCreateFlag?: (name: string) => Promise<{ id: string } | null>;
}
```

Three options for operations (`set_true` / `set_false` / `toggle`), two for
conditions (`true` / `false`).

`FlagOperations` and `ChoiceConditions` survive as thin wrappers, because the
two stored shapes differ — `{flag_id, operation}` versus
`{flag_id, required_value: boolean}` — and each wrapper owns that adapter plus
its own labels. Expect roughly 237 lines to become roughly 170, not the ~130 an
outright merge would suggest; the wrappers are what keep `FlagRuleList` free of
conditionals about which caller it is serving.

### Editor chrome context

`Sidebar` and `BottomBar` already call `useStoryAtoms()` themselves, so
`storyTitle`, `pages` and `startPage` need not be props at all. Only the four
pieces of *view state* owned by `StoryEditorPage` do:

```ts
interface EditorChrome {
  onPlaytest: () => void;
  onTogglePreview: () => void;
  showPreview: boolean;
  hasPageSelected: boolean;
}
```

Provided by `StoryEditorPage`, consumed by both bars. `MainLayout` reduces to
taking `children`.

## Testing

Component testing infrastructure does not exist yet: `@testing-library/react`
and `jsdom` are not installed, and the vitest glob matches `.ts` only. Both are
added, scoped to what this phase refactors.

- `useTrackedAction` — success sets `saved`; rejection sets `failed` carrying
  the message; the returned callback is void-returning. That last assertion is
  what protects the lint fix from silently regressing.
- `upsertFlagRule` / `removeFlagRule` — pure, including replacing an existing
  rule for the same flag rather than appending a duplicate.
- `FlagRuleList` — renders existing rules, excludes already-used flags from the
  add control, and emits `onAdd` / `onRemove`.
- `ChoiceEditor` — renders a choice and emits patches.
- `SaveStatus` — `saved` clears itself; `failed` does not.

The 18 creation-tool e2e tests remain the integration backstop and must stay
green throughout, since they cover the page editing paths being restructured.

## Sequencing

The status atom and `useTrackedAction` must land first — both the `PageCard`
refactor and the 35 warning fixes depend on them.

1. Test infrastructure, `saveStatusAtom`, `useTrackedAction`, `<SaveStatus />`
2. `upsertFlagRule` / `removeFlagRule` with tests
3. `FlagRuleList` plus the two wrappers
4. `usePageMutations`, `<ChoiceEditor>`, `PageCard` refactor
5. Convert the remaining promise sites in the other eight files
6. Promote `no-floating-promises` and `no-misused-promises` to `error`

Step 6 is the gate: it can only pass once every site is converted, so it
doubles as the completeness check for step 5.
