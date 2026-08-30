# Component Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make failed writes visible to the author, collapse `PageCard`'s twelve near-identical handlers, merge the duplicated flag/condition editors, and stop drilling props through `MainLayout`.

**Architecture:** A global `saveStatusAtom` holds write status; a single `<SaveStatus />` renders it. `useTrackedAction` wraps any async action, reports into that atom, and returns a **void-returning** callback — which is simultaneously the error fix and the reason all 35 promise lint warnings disappear. `usePageMutations` builds on it so `PageCard`'s error handling lives at one seam instead of twelve.

**Tech Stack:** React 18, Jotai, TypeScript, Tailwind 4, Vitest, `@testing-library/react` + jsdom (added by Task 1), Playwright (existing).

**Spec:** `docs/superpowers/specs/2026-08-26-component-cleanup-design.md`

## Global Constraints

- All user-facing strings live in `creation-tool/src/i18n/translations.ts`. Never hardcode text in a component.
- Only `Error`-severity concerns block; this phase changes no backend behaviour at all. It is a frontend refactor plus one new indicator.
- eslint currently reports **0 errors, 35 warnings**. The warning count must only ever go DOWN. Task 7 drives it to 0 and promotes both rules to `error`.
- The 18 creation-tool e2e tests are the integration backstop and must stay green after every task.
- Run `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` from `creation-tool/` before every commit.
- Do not touch backend Rust, the export flow's `alert()` calls, the refetch cascade, or type generation — all explicit spec non-goals.

---

### Task 1: Test infrastructure, save-status atom, and `useTrackedAction`

**Files:**
- Modify: `creation-tool/package.json` (devDependencies)
- Modify: `creation-tool/vitest.config.ts`
- Create: `creation-tool/src/atoms/saveStatus.ts`
- Create: `creation-tool/src/hooks/useTrackedAction.ts`
- Modify: `creation-tool/src/i18n/translations.ts`
- Test: `creation-tool/src/hooks/__tests__/useTrackedAction.test.tsx`

**Interfaces:**
- Produces: `SaveStatus` type, `saveStatusAtom`, `useTrackedAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>): (...args: A) => void`

- [ ] **Step 1: Install test dependencies and widen the vitest glob**

```bash
cd creation-tool
yarn add -D @testing-library/react@^16 @testing-library/dom@^10 jsdom@^25
```

Replace `creation-tool/vitest.config.ts` entirely:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // .tsx included so component and hook tests are picked up, not just .ts
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `creation-tool/src/hooks/__tests__/useTrackedAction.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Provider, useAtomValue } from "jotai";
import { saveStatusAtom } from "../../atoms/saveStatus";
import { useTrackedAction } from "../useTrackedAction";

/** Renders the hook and the atom together inside one Jotai store. */
function setup(fn: (...args: never[]) => Promise<unknown>) {
  return renderHook(
    () => ({
      run: useTrackedAction(fn as (...args: unknown[]) => Promise<unknown>),
      status: useAtomValue(saveStatusAtom),
    }),
    { wrapper: Provider },
  );
}

describe("useTrackedAction", () => {
  it("reports saved when the action resolves", async () => {
    const { result } = setup(() => Promise.resolve());

    act(() => result.current.run());

    await waitFor(() => expect(result.current.status.state).toBe("saved"));
  });

  it("reports failed with the cause when the action rejects", async () => {
    const { result } = setup(() => Promise.reject(new Error("disk full")));

    act(() => result.current.run());

    await waitFor(() => expect(result.current.status.state).toBe("failed"));
    const status = result.current.status;
    if (status.state !== "failed") throw new Error("expected failed");
    expect(status.message).toContain("disk full");
  });

  it("returns a void-returning callback, not a promise", () => {
    // This is what makes no-misused-promises and no-floating-promises stop
    // firing at every call site. If this regresses, the lint gate regresses.
    const { result } = setup(() => Promise.resolve());
    let returned: unknown;
    act(() => {
      returned = result.current.run();
    });
    expect(returned).toBeUndefined();
  });

  it("passes its arguments through to the action", async () => {
    const seen: unknown[] = [];
    const { result } = setup(((...args: unknown[]) => {
      seen.push(...args);
      return Promise.resolve();
    }) as (...args: never[]) => Promise<unknown>);

    act(() => result.current.run("a", 1));

    await waitFor(() => expect(result.current.status.state).toBe("saved"));
    expect(seen).toEqual(["a", 1]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd creation-tool && npx vitest run useTrackedAction`
Expected: FAIL — cannot resolve `../../atoms/saveStatus`.

- [ ] **Step 4: Add the translation keys**

In `creation-tool/src/i18n/translations.ts`, add a block before `dynamic`:

```typescript
  // Save status indicator
  saveStatus: {
    saving: "Saving…",
    saved: "Saved",
    failed: "Couldn't save",
  },
```

- [ ] **Step 5: Write the atom**

Create `creation-tool/src/atoms/saveStatus.ts`:

```typescript
import { atom } from "jotai";

/**
 * Status of the most recent write, wherever in the app it originated.
 *
 * This is global rather than local to the page editor on purpose: asset
 * uploads, flag edits and page saves all report here, so one indicator can
 * show all of them.
 */
export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "failed"; message: string };

export const saveStatusAtom = atom<SaveStatus>({ state: "idle" });
```

- [ ] **Step 6: Write the hook**

Create `creation-tool/src/hooks/useTrackedAction.ts`:

```typescript
import { useCallback, useRef } from "react";
import { useSetAtom } from "jotai";
import { saveStatusAtom } from "../atoms/saveStatus";
import { translations } from "../i18n";

/**
 * Wrap an async action so it reports into the global save status and cannot
 * leave an unhandled rejection.
 *
 * The returned callback is VOID-RETURNING, and that is load-bearing:
 * `no-misused-promises` fires when a promise-returning function is handed to
 * an event handler expecting void, and `no-floating-promises` fires when a
 * promise goes unhandled. A void-returning callback that handles its own
 * rejection satisfies both — so wrapping an action here is what removes those
 * lint violations, rather than suppressing them.
 */
export function useTrackedAction<A extends unknown[]>(
  fn: (...args: A) => Promise<unknown>,
): (...args: A) => void {
  const setStatus = useSetAtom(saveStatusAtom);

  // Held in a ref so the returned callback is stable regardless of whether
  // the caller memoised `fn`.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    (...args: A) => {
      setStatus({ state: "saving" });
      // `void` marks the promise intentionally ignored. That is correct here
      // rather than a dodge: rejection IS handled, by the second argument.
      void fnRef.current(...args).then(
        () => setStatus({ state: "saved" }),
        (error: unknown) => {
          console.error("Write failed:", error);
          const cause = error instanceof Error ? error.message : String(error);
          setStatus({ state: "failed", message: cause });
        },
      );
    },
    [setStatus],
  );
}
```

- [ ] **Step 7: Run the tests**

Run: `cd creation-tool && npx vitest run`
Expected: PASS — 10 tests (6 pre-existing + 4 new).

- [ ] **Step 8: Verify nothing regressed**

Run: `cd creation-tool && npx tsc --noEmit && npx eslint .`
Expected: tsc clean; eslint 0 errors and **no more than 35** warnings.

- [ ] **Step 9: Commit**

```bash
git add creation-tool/package.json creation-tool/yarn.lock creation-tool/vitest.config.ts creation-tool/src/atoms/saveStatus.ts creation-tool/src/hooks creation-tool/src/i18n/translations.ts
git commit -m "feat(editor): add save-status atom and useTrackedAction"
```

---

### Task 2: The save-status indicator

**Files:**
- Create: `creation-tool/src/components/SaveStatus.tsx`
- Modify: `creation-tool/src/components/layout/MainLayout.tsx`
- Test: `creation-tool/src/components/__tests__/SaveStatus.test.tsx`

**Interfaces:**
- Consumes: `saveStatusAtom`, `SaveStatus` from `atoms/saveStatus`
- Produces: `<SaveStatus />`, rendered once by `MainLayout`

- [ ] **Step 1: Write the failing test**

Create `creation-tool/src/components/__tests__/SaveStatus.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { saveStatusAtom } from "../../atoms/saveStatus";
import { SaveStatus } from "../SaveStatus";

describe("SaveStatus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders nothing when idle", () => {
    const store = createStore();
    const { container } = render(
      <Provider store={store}>
        <SaveStatus />
      </Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("clears the saved state after its timeout", () => {
    const store = createStore();
    store.set(saveStatusAtom, { state: "saved" });
    const { container } = render(
      <Provider store={store}>
        <SaveStatus />
      </Provider>,
    );
    expect(screen.getByTestId("save-status")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a failure visible indefinitely", () => {
    // A failure the author can miss is the bug this feature exists to fix,
    // so unlike "saved" it must not time out.
    const store = createStore();
    store.set(saveStatusAtom, { state: "failed", message: "disk full" });
    render(
      <Provider store={store}>
        <SaveStatus />
      </Provider>,
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    const el = screen.getByTestId("save-status");
    expect(el.textContent).toContain("disk full");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd creation-tool && npx vitest run SaveStatus`
Expected: FAIL — cannot resolve `../SaveStatus`.

- [ ] **Step 3: Write the component**

Create `creation-tool/src/components/SaveStatus.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { saveStatusAtom } from "../atoms/saveStatus";
import { useTranslation } from "../i18n";

/** How long a successful save stays on screen before fading out. */
const SAVED_VISIBLE_MS = 3000;

export const SaveStatus = () => {
  const status = useAtomValue(saveStatusAtom);
  const { t } = useTranslation();
  const [savedExpired, setSavedExpired] = useState(false);

  useEffect(() => {
    setSavedExpired(false);
    // Only "saved" times out. "failed" persists until the next write
    // succeeds — a message the author can miss is the bug being fixed.
    if (status.state !== "saved") return;
    const id = window.setTimeout(() => setSavedExpired(true), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  if (status.state === "idle") return null;
  if (status.state === "saved" && savedExpired) return null;

  const failed = status.state === "failed";

  return (
    <div
      data-testid="save-status"
      role={failed ? "alert" : "status"}
      className={clsx(
        "fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg border text-xs shadow-sm",
        failed
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-gray-50 border-gray-200 text-gray-700",
      )}
    >
      {status.state === "saving" && t.saveStatus.saving}
      {status.state === "saved" && t.saveStatus.saved}
      {failed && `${t.saveStatus.failed}: ${status.message}`}
    </div>
  );
};
```

- [ ] **Step 4: Render it once from MainLayout**

In `creation-tool/src/components/layout/MainLayout.tsx`, import `SaveStatus` and render it as the last child of the root `<div>`:

```tsx
      <SaveStatus />
```

It is fixed-position, so one instance covers both orientations without being duplicated into `Sidebar` and `BottomBar`.

- [ ] **Step 5: Run the tests**

Run: `cd creation-tool && npx vitest run`
Expected: PASS — 13 tests.

- [ ] **Step 6: Verify and commit**

Run: `cd creation-tool && npx tsc --noEmit && npx eslint . && yarn build`

```bash
git add creation-tool/src
git commit -m "feat(editor): surface write failures in a save-status indicator"
```

---

### Task 3: Pure flag-rule helpers

**Files:**
- Create: `creation-tool/src/utilities/flagRules.ts`
- Test: `creation-tool/src/utilities/__tests__/flagRules.test.ts`

**Interfaces:**
- Produces: `upsertFlagRule<T extends { flag_id: string }>(list: T[], rule: T): T[]`, `removeFlagRule<T extends { flag_id: string }>(list: T[], flagId: string): T[]`

- [ ] **Step 1: Write the failing test**

Create `creation-tool/src/utilities/__tests__/flagRules.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { upsertFlagRule, removeFlagRule } from "../flagRules";

interface Rule { flag_id: string; value: string }

describe("upsertFlagRule", () => {
  it("appends a rule for a flag that has none", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    expect(upsertFlagRule(list, { flag_id: "b", value: "2" })).toEqual([
      { flag_id: "a", value: "1" },
      { flag_id: "b", value: "2" },
    ]);
  });

  it("replaces rather than duplicating an existing flag's rule", () => {
    // Duplicates would silently give one flag two conflicting rules.
    const list: Rule[] = [
      { flag_id: "a", value: "1" },
      { flag_id: "b", value: "2" },
    ];
    const result = upsertFlagRule(list, { flag_id: "a", value: "99" });
    expect(result).toHaveLength(2);
    expect(result.filter((r) => r.flag_id === "a")).toEqual([
      { flag_id: "a", value: "99" },
    ]);
  });

  it("does not mutate the input", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    upsertFlagRule(list, { flag_id: "a", value: "2" });
    expect(list).toEqual([{ flag_id: "a", value: "1" }]);
  });
});

describe("removeFlagRule", () => {
  it("removes only the matching flag", () => {
    const list: Rule[] = [
      { flag_id: "a", value: "1" },
      { flag_id: "b", value: "2" },
    ];
    expect(removeFlagRule(list, "a")).toEqual([{ flag_id: "b", value: "2" }]);
  });

  it("is a no-op for a flag that is not present", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    expect(removeFlagRule(list, "zzz")).toEqual(list);
  });

  it("does not mutate the input", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    removeFlagRule(list, "a");
    expect(list).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd creation-tool && npx vitest run flagRules`
Expected: FAIL — cannot resolve `../flagRules`.

- [ ] **Step 3: Write the helpers**

Create `creation-tool/src/utilities/flagRules.ts`:

```typescript
/**
 * Flag operations and choice conditions are both keyed by `flag_id`, and both
 * allow at most one rule per flag. These two helpers were previously inlined
 * across six near-identical handlers in PageCard.
 */

/** Add a rule, replacing any existing rule for the same flag. */
export function upsertFlagRule<T extends { flag_id: string }>(
  list: T[],
  rule: T,
): T[] {
  return [...list.filter((r) => r.flag_id !== rule.flag_id), rule];
}

/** Drop the rule for a flag, if there is one. */
export function removeFlagRule<T extends { flag_id: string }>(
  list: T[],
  flagId: string,
): T[] {
  return list.filter((r) => r.flag_id !== flagId);
}
```

- [ ] **Step 4: Run the tests**

Run: `cd creation-tool && npx vitest run`
Expected: PASS — 19 tests.

- [ ] **Step 5: Commit**

```bash
git add creation-tool/src/utilities
git commit -m "refactor(editor): extract pure flag-rule list helpers"
```

---

### Task 4: `FlagRuleList` and its two wrappers

**Files:**
- Create: `creation-tool/src/components/FlagRuleList.tsx`
- Rewrite: `creation-tool/src/components/FlagOperations.tsx`
- Rewrite: `creation-tool/src/components/ChoiceConditions.tsx`
- Test: `creation-tool/src/components/__tests__/FlagRuleList.test.tsx`

**Interfaces:**
- Produces: `<FlagRuleList>` (props below). `FlagOperations` and `ChoiceConditions` keep their existing prop signatures so `PageCard` needs no change in this task.

`FlagOperations` today takes `{ operations, availableFlags, onAdd(flagId, operation), onRemove(flagId), onCreateFlag? }`.
`ChoiceConditions` today takes `{ conditions, availableFlags, onAdd(flagId, requiredValue), onRemove(flagId), onCreateFlag? }`.
Both signatures are preserved exactly.

- [ ] **Step 1: Write the failing test**

Create `creation-tool/src/components/__tests__/FlagRuleList.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlagRuleList } from "../FlagRuleList";

const FLAGS = [
  { id: "f1", name: "has_key", default_value: false },
  { id: "f2", name: "is_night", default_value: false },
];

const VALUES = [
  { value: "on", label: "turn on" },
  { value: "off", label: "turn off" },
];

describe("FlagRuleList", () => {
  it("shows an empty state when there are no rules", () => {
    render(
      <FlagRuleList
        rules={[]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    expect(screen.getByTestId("flag-rules-empty")).toBeTruthy();
  });

  it("renders a rule using the flag's name and its value label", () => {
    render(
      <FlagRuleList
        rules={[{ flag_id: "f1", value: "on" }]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    const row = screen.getByTestId("flag-rule-f1");
    expect(row.textContent).toContain("has_key");
    expect(row.textContent).toContain("turn on");
  });

  it("excludes already-ruled flags from the add control", () => {
    // Offering a flag that already has a rule invites silently overwriting it.
    render(
      <FlagRuleList
        rules={[{ flag_id: "f1", value: "on" }]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    const select = screen.getByTestId("flag-rule-add-flag") as HTMLSelectElement;
    const offered = Array.from(select.options).map((o) => o.value);
    expect(offered).not.toContain("f1");
    expect(offered).toContain("f2");
  });

  it("emits onAdd with the chosen flag and value", () => {
    const onAdd = vi.fn();
    render(
      <FlagRuleList
        rules={[]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={onAdd}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    fireEvent.change(screen.getByTestId("flag-rule-add-flag"), {
      target: { value: "f2" },
    });
    fireEvent.change(screen.getByTestId("flag-rule-add-value"), {
      target: { value: "off" },
    });
    fireEvent.click(screen.getByTestId("flag-rule-add"));
    expect(onAdd).toHaveBeenCalledWith("f2", "off");
  });

  it("emits onRemove for the right flag", () => {
    const onRemove = vi.fn();
    render(
      <FlagRuleList
        rules={[{ flag_id: "f1", value: "on" }]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={onRemove}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    fireEvent.click(screen.getByTestId("flag-rule-remove-f1"));
    expect(onRemove).toHaveBeenCalledWith("f1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd creation-tool && npx vitest run FlagRuleList`
Expected: FAIL — cannot resolve `../FlagRuleList`.

- [ ] **Step 3: Add the translation keys**

In `creation-tool/src/i18n/translations.ts`, add to the existing `emptyStates` block:

```typescript
    noFlagRules: "None yet",
```

- [ ] **Step 4: Write `FlagRuleList`**

Create `creation-tool/src/components/FlagRuleList.tsx`:

```tsx
import { useState } from "react";
import { Button } from "./ui/Button";
import { SelectWithCreate } from "./ui/SelectWithCreate";
import { useTranslation } from "../i18n";
import type { Flag } from "../types";

export interface FlagRule<V extends string> {
  flag_id: string;
  value: V;
}

interface FlagRuleListProps<V extends string> {
  rules: Array<FlagRule<V>>;
  availableFlags: Flag[];
  /** The value set this list edits — three for operations, two for conditions. */
  valueOptions: Array<{ value: V; label: string }>;
  onAdd: (flagId: string, value: V) => void;
  onRemove: (flagId: string) => void;
  onCreateFlag?: (name: string) => Promise<{ id: string } | null>;
  addLabel: string;
  valueLabel: string;
}

/**
 * "Pick a flag, pick a value" — shared by the page/choice flag-operation
 * editors and the choice-condition editor. The two callers differ only in
 * their stored shape and their value set, so the value set is passed as data
 * rather than the component branching on which caller it is serving.
 */
export function FlagRuleList<V extends string>({
  rules,
  availableFlags,
  valueOptions,
  onAdd,
  onRemove,
  onCreateFlag,
  addLabel,
  valueLabel,
}: FlagRuleListProps<V>) {
  const { t } = useTranslation();
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [selectedValue, setSelectedValue] = useState<V>(valueOptions[0].value);

  const usedFlagIds = new Set(rules.map((r) => r.flag_id));
  const availableForAdd = availableFlags.filter((f) => !usedFlagIds.has(f.id));

  const handleAdd = () => {
    if (!selectedFlagId) return;
    onAdd(selectedFlagId, selectedValue);
    setSelectedFlagId("");
  };

  const selectClass =
    "flex-1 px-2.5 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 ? (
        <div
          className="py-3 text-center text-gray-500 text-xs italic"
          data-testid="flag-rules-empty"
        >
          {t.emptyStates.noFlagRules}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rules.map((rule) => {
            const flag = availableFlags.find((f) => f.id === rule.flag_id);
            const valueLabelText =
              valueOptions.find((o) => o.value === rule.value)?.label ?? rule.value;
            return (
              <div
                key={rule.flag_id}
                data-testid={`flag-rule-${rule.flag_id}`}
                className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs"
              >
                <span className="text-gray-900">
                  <strong>{flag?.name ?? t.dynamic.flagFallback(rule.flag_id)}</strong>
                  {" → "}
                  <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-xs">
                    {valueLabelText}
                  </span>
                </span>
                <button
                  onClick={() => onRemove(rule.flag_id)}
                  data-testid={`flag-rule-remove-${rule.flag_id}`}
                  aria-label={`Remove ${flag?.name ?? rule.flag_id}`}
                  className="text-danger text-xl w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end mt-1">
        {onCreateFlag ? (
          <div className="flex-1">
            <SelectWithCreate
              label=""
              value={selectedFlagId}
              options={availableForAdd.map((f) => ({ id: f.id, label: f.name }))}
              onChange={setSelectedFlagId}
              onCreate={onCreateFlag}
              createLabel={t.buttons.addFlag}
              createPlaceholder={t.placeholders.flagName}
              createPromptLabel={t.placeholders.flagName}
              placeholder={`${t.labels.flag}...`}
            />
          </div>
        ) : (
          <select
            aria-label={t.labels.flag}
            data-testid="flag-rule-add-flag"
            className={selectClass}
            value={selectedFlagId}
            onChange={(e) => setSelectedFlagId(e.target.value)}
          >
            <option value="">{t.labels.flag}...</option>
            {availableForAdd.map((flag) => (
              <option key={flag.id} value={flag.id}>
                {flag.name}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label={valueLabel}
          data-testid="flag-rule-add-value"
          className={selectClass}
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value as V)}
        >
          {valueOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <Button
          onClick={handleAdd}
          disabled={!selectedFlagId}
          size="sm"
          data-testid="flag-rule-add"
          className="whitespace-nowrap"
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
```

Note: the test renders `FlagRuleList` WITHOUT `onCreateFlag`, so the plain `<select data-testid="flag-rule-add-flag">` branch is what the test drives.

- [ ] **Step 5: Rewrite the two wrappers**

Replace `creation-tool/src/components/FlagOperations.tsx` entirely:

```tsx
import { FlagRuleList } from "./FlagRuleList";
import { useTranslation } from "../i18n";
import type { Flag, FlagOperation } from "../types";

type FlagOperationsProps = {
  operations: FlagOperation[];
  availableFlags: Flag[];
  onAdd: (flagId: string, operation: string) => void;
  onRemove: (flagId: string) => void;
  onCreateFlag?: (name: string) => Promise<{ id: string } | null>;
};

/** Adapter: stored as `{flag_id, operation}`, edited as `{flag_id, value}`. */
export const FlagOperations = ({
  operations,
  availableFlags,
  onAdd,
  onRemove,
  onCreateFlag,
}: FlagOperationsProps) => {
  const { t } = useTranslation();
  return (
    <FlagRuleList
      rules={operations.map((op) => ({ flag_id: op.flag_id, value: op.operation }))}
      availableFlags={availableFlags}
      valueOptions={[
        { value: "set_true" as const, label: t.operations.set_true },
        { value: "set_false" as const, label: t.operations.set_false },
        { value: "toggle" as const, label: t.operations.toggle },
      ]}
      onAdd={onAdd}
      onRemove={onRemove}
      onCreateFlag={onCreateFlag}
      addLabel={t.buttons.addOperation}
      valueLabel={t.labels.operation}
    />
  );
};
```

Replace `creation-tool/src/components/ChoiceConditions.tsx` entirely:

```tsx
import { FlagRuleList } from "./FlagRuleList";
import { useTranslation } from "../i18n";
import type { Flag, Condition } from "../types";

type ChoiceConditionsProps = {
  conditions: Condition[];
  availableFlags: Flag[];
  onAdd: (flagId: string, requiredValue: boolean) => void;
  onRemove: (flagId: string) => void;
  onCreateFlag?: (name: string) => Promise<{ id: string } | null>;
};

/**
 * Adapter: stored as `{flag_id, required_value: boolean}`, edited as
 * `{flag_id, value: "true" | "false"}`.
 */
export const ChoiceConditions = ({
  conditions,
  availableFlags,
  onAdd,
  onRemove,
  onCreateFlag,
}: ChoiceConditionsProps) => {
  const { t } = useTranslation();
  return (
    <FlagRuleList
      rules={conditions.map((c) => ({
        flag_id: c.flag_id,
        value: c.required_value ? ("true" as const) : ("false" as const),
      }))}
      availableFlags={availableFlags}
      valueOptions={[
        { value: "true" as const, label: t.conditions.mustBeTrue },
        { value: "false" as const, label: t.conditions.mustBeFalse },
      ]}
      onAdd={(flagId, value) => onAdd(flagId, value === "true")}
      onRemove={onRemove}
      onCreateFlag={onCreateFlag}
      addLabel={t.buttons.addCondition}
      valueLabel={t.labels.requiredValue}
    />
  );
};
```

- [ ] **Step 6: Verify**

Run: `cd creation-tool && npx vitest run && npx tsc --noEmit && npx eslint . && yarn build`
Expected: 24 tests pass; tsc clean; eslint 0 errors, warnings **at or below 35**.

Run: `cd creation-tool && yarn test:e2e`
Expected: 18 passing — the flag and condition editors are exercised by the choice-management tests.

- [ ] **Step 7: Commit**

```bash
git add creation-tool/src
git commit -m "refactor(editor): merge flag operation and condition editors"
```

---

### Task 5: `usePageMutations`, `ChoiceEditor`, and the PageCard refactor

**Files:**
- Create: `creation-tool/src/hooks/usePageMutations.ts`
- Create: `creation-tool/src/components/ChoiceEditor.tsx`
- Rewrite: `creation-tool/src/components/PageCard.tsx`
- Test: `creation-tool/src/hooks/__tests__/usePageMutations.test.tsx`

**Interfaces:**
- Consumes: `useTrackedAction`, `upsertFlagRule`, `removeFlagRule`, `FlagOperations`, `ChoiceConditions`
- Produces: `usePageMutations(page: Page | null): { updatePage(patch: Partial<Page>): void; updateChoice(choiceId: string, patch: Partial<Choice>): void; addChoice(defaultTarget: string): void; removeChoice(choiceId: string): void }`, `<ChoiceEditor>`

- [ ] **Step 1: Write the failing test**

Create `creation-tool/src/hooks/__tests__/usePageMutations.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import type { Page } from "../../types";
import { usePageMutations } from "../usePageMutations";
import api from "../../api";

vi.mock("../../api", () => ({
  default: {
    savePage: vi.fn(() => Promise.resolve()),
  },
}));

const PAGE: Page = {
  id: "p1",
  name: "Start",
  body: { content: [{ type: "markdown", source: "hi" }] },
  choices: [
    { id: "c1", text: "Go", target: "p2", flag_operations: [], conditions: [] },
  ],
  flag_operations: [],
};

const savePage = vi.mocked(api).savePage;

describe("usePageMutations", () => {
  beforeEach(() => savePage.mockClear());

  it("merges a page patch and saves the whole page", async () => {
    const { result } = renderHook(() => usePageMutations(PAGE), {
      wrapper: Provider,
    });

    act(() => result.current.updatePage({ name: "Renamed" }));

    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    const saved = savePage.mock.calls[0][0] as Page;
    expect(saved.name).toBe("Renamed");
    // Unpatched fields must survive — the backend takes a whole Page.
    expect(saved.choices).toHaveLength(1);
    expect(saved.id).toBe("p1");
  });

  it("patches only the named choice", async () => {
    const { result } = renderHook(() => usePageMutations(PAGE), {
      wrapper: Provider,
    });

    act(() => result.current.updateChoice("c1", { text: "Changed" }));

    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    const saved = savePage.mock.calls[0][0] as Page;
    expect(saved.choices[0].text).toBe("Changed");
    expect(saved.choices[0].target).toBe("p2");
  });

  it("removes a choice by id", async () => {
    const { result } = renderHook(() => usePageMutations(PAGE), {
      wrapper: Provider,
    });

    act(() => result.current.removeChoice("c1"));

    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    expect((savePage.mock.calls[0][0] as Page).choices).toHaveLength(0);
  });

  it("does nothing when there is no page", () => {
    const { result } = renderHook(() => usePageMutations(null), {
      wrapper: Provider,
    });
    act(() => result.current.updatePage({ name: "x" }));
    expect(savePage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd creation-tool && npx vitest run usePageMutations`
Expected: FAIL — cannot resolve `../usePageMutations`.

- [ ] **Step 3: Write the hook**

Create `creation-tool/src/hooks/usePageMutations.ts`:

```typescript
import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { savePageAtom } from "../atoms/storyActions";
import { useTrackedAction } from "./useTrackedAction";
import { generateId } from "../utilities/id";
import type { Choice, Page } from "../types";

/**
 * Every write PageCard performs, in one place.
 *
 * Callers pass a patch; this saves the whole entity, because the backend save
 * API takes a complete `Page`. Built on useTrackedAction so a failed write is
 * reported once here rather than swallowed at twelve call sites.
 */
export function usePageMutations(page: Page | null) {
  const savePage = useSetAtom(savePageAtom);

  const save = useTrackedAction(async (next: Page) => {
    await savePage(next);
  });

  const updatePage = useCallback(
    (patch: Partial<Page>) => {
      if (!page) return;
      save({ ...page, ...patch });
    },
    [page, save],
  );

  const updateChoice = useCallback(
    (choiceId: string, patch: Partial<Choice>) => {
      if (!page) return;
      save({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId ? { ...c, ...patch } : c,
        ),
      });
    },
    [page, save],
  );

  // The default target is passed in rather than read from `pageListAtom`.
  // That atom is async, so reading it here would make this hook suspend —
  // which breaks `renderHook` and would force a Suspense boundary on every
  // consumer for no benefit. PageCard already has the page list to hand.
  const addChoice = useCallback(
    (defaultTarget: string) => {
      if (!page) return;
      save({
        ...page,
        choices: [
          ...page.choices,
          {
            id: generateId(),
            text: "",
            target: defaultTarget,
            flag_operations: [],
            conditions: [],
          },
        ],
      });
    },
    [page, save],
  );

  const removeChoice = useCallback(
    (choiceId: string) => {
      if (!page) return;
      save({ ...page, choices: page.choices.filter((c) => c.id !== choiceId) });
    },
    [page, save],
  );

  return { updatePage, updateChoice, addChoice, removeChoice };
}
```

- [ ] **Step 4: Run the hook tests**

Run: `cd creation-tool && npx vitest run usePageMutations`
Expected: PASS — 4 tests.

- [ ] **Step 5: Extract `ChoiceEditor`**

Create `creation-tool/src/components/ChoiceEditor.tsx`. Move the per-choice JSX out of `PageCard` verbatim, changing only how it reports edits — through the props below instead of local handlers:

```tsx
import clsx from "clsx";
import { useLocation } from "wouter";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { SelectWithCreate } from "./ui/SelectWithCreate";
import { FlagOperations } from "./FlagOperations";
import { ChoiceConditions } from "./ChoiceConditions";
import { useTranslation } from "../i18n";
import { getLinkToPage } from "../utilities/routing";
import { upsertFlagRule, removeFlagRule } from "../utilities/flagRules";
import type { Choice, Flag, PageListItem } from "../types";

interface ChoiceEditorProps {
  choice: Choice;
  pages: PageListItem[];
  flags: Flag[];
  /** Local (unsaved) text edits, mirroring the previous inline behaviour. */
  onDraftChange: (patch: Partial<Choice>) => void;
  onCommit: (patch: Partial<Choice>) => void;
  onDelete: () => void;
  onCreatePage: (name: string) => Promise<{ id: string } | null>;
  onCreateFlag: (name: string) => Promise<{ id: string } | null>;
}

export const ChoiceEditor = ({
  choice,
  pages,
  flags,
  onDraftChange,
  onCommit,
  onDelete,
  onCreatePage,
  onCreateFlag,
}: ChoiceEditorProps) => {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t.labels.choiceText}
          type="text"
          id={`choice-text-${choice.id}`}
          value={choice.text}
          onChange={(e) => onDraftChange({ text: e.target.value })}
          onBlur={() => onCommit({ text: choice.text })}
          placeholder={t.placeholders.choiceText}
        />

        <div>
          <SelectWithCreate
            label={t.labels.leadsTo}
            id={`choice-target-${choice.id}`}
            value={choice.target}
            options={pages.map((p) => ({
              id: p.id,
              label: t.dynamic.pageDisplay(p.name, p.id),
            }))}
            onChange={(target) => {
              onDraftChange({ target });
              onCommit({ target });
            }}
            onCreate={onCreatePage}
            createLabel={t.buttons.createPage}
            createPlaceholder={t.placeholders.newPageTitle}
            createPromptLabel={t.placeholders.newPageTitle}
          />
          <button
            onClick={() => setLocation(getLinkToPage(choice.target))}
            className={clsx(
              "text-sm font-medium mt-1",
              "text-primary dark:text-blue-400",
              "hover:underline",
            )}
          >
            {t.buttons.goToPage} →
          </button>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="p-3 bg-white rounded border border-gray-200">
            <h4 className="text-xs font-medium text-gray-600 mb-2">
              {t.labels.showChoiceIf}
            </h4>
            <ChoiceConditions
              conditions={choice.conditions}
              availableFlags={flags}
              onAdd={(flagId, requiredValue) =>
                onCommit({
                  conditions: upsertFlagRule(choice.conditions, {
                    flag_id: flagId,
                    required_value: requiredValue,
                  }),
                })
              }
              onRemove={(flagId) =>
                onCommit({ conditions: removeFlagRule(choice.conditions, flagId) })
              }
              onCreateFlag={onCreateFlag}
            />
          </div>

          <div className="p-3 bg-white rounded border border-gray-200">
            <h4 className="text-xs font-medium text-gray-600 mb-2">
              {t.labels.whenSelected}
            </h4>
            <FlagOperations
              operations={choice.flag_operations}
              availableFlags={flags}
              onAdd={(flagId, operation) =>
                onCommit({
                  flag_operations: upsertFlagRule(choice.flag_operations, {
                    flag_id: flagId,
                    operation: operation as "set_true" | "set_false" | "toggle",
                  }),
                })
              }
              onRemove={(flagId) =>
                onCommit({
                  flag_operations: removeFlagRule(choice.flag_operations, flagId),
                })
              }
            />
          </div>
        </div>
      )}

      <Button variant="danger" size="sm" className="mt-4" onClick={onDelete}>
        {t.buttons.delete}
      </Button>
    </div>
  );
};
```

- [ ] **Step 6: Rewrite `PageCard`**

Replace `creation-tool/src/components/PageCard.tsx` entirely. Note `handleCreateFlag` does NOT use `useTrackedAction`: that returns `void`, but `SelectWithCreate` awaits this function and needs the new flag's id back. It reports failure by writing the status atom directly instead.

Preserved exactly because e2e depends on them: the `page-title-input` id, the `page-flag-operations` testid, and the `choice-text-${id}` / `choice-target-${id}` ids inside `ChoiceEditor`.

```tsx
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { pageAtomFamily, pageListAtom } from "../atoms/storyAtoms";
import { saveStoryAtom } from "../atoms/storyActions";
import { saveStatusAtom } from "../atoms/saveStatus";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { usePageMutations } from "../hooks/usePageMutations";
import { useTranslation } from "../i18n";
import { generateId } from "../utilities/id";
import { upsertFlagRule, removeFlagRule } from "../utilities/flagRules";
import { FlagOperations } from "./FlagOperations";
import { ChoiceEditor } from "./ChoiceEditor";
import { Input } from "./ui/Input";
import { MarkdownEditor } from "./MarkdownEditor";
import { Button } from "./ui/Button";
import api from "../api";
import type { Choice } from "../types";

const PageCard = ({ pageId }: { pageId: string }) => {
  // Draft state: edits are local until blur, matching the previous behaviour.
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [assetsDir, setAssetsDir] = useState<string | null>(null);

  const page = useAtomValue(pageAtomFamily(pageId));
  const pages = useAtomValue(pageListAtom);
  const { flags, createPage, story } = useStoryAtoms();
  const saveStory = useSetAtom(saveStoryAtom);
  const setSaveStatus = useSetAtom(saveStatusAtom);
  const { updatePage, updateChoice, addChoice, removeChoice } =
    usePageMutations(page);
  const { t } = useTranslation();

  useEffect(() => {
    void api
      .getProjectAssetsDir()
      .then(setAssetsDir)
      .catch((error: unknown) => {
        console.error("Failed to resolve assets dir:", error);
      });
  }, []);

  useEffect(() => {
    if (!page) return;
    setName(page.name);
    const md = page.body.content?.[0];
    setBody(md?.type === "markdown" ? md.source : "");
    setChoices(page.choices);
  }, [page]);

  const resolveImageUrl = useCallback(
    (filename: string) => {
      if (!assetsDir) return filename;
      return convertFileSrc(`${assetsDir}/${filename}`);
    },
    [assetsDir],
  );

  const commitTitleAndBody = () => {
    if (!page) return;
    const newBody = { content: [{ type: "markdown" as const, source: body }] };
    const changed =
      name !== page.name ||
      JSON.stringify(newBody) !== JSON.stringify(page.body);
    if (changed) updatePage({ name, body: newBody });
  };

  // Not wrapped in useTrackedAction: SelectWithCreate awaits this and needs
  // the new id back, so it must stay promise-returning. It reports its own
  // failure instead of swallowing it.
  const handleCreateFlag = async (
    flagName: string,
  ): Promise<{ id: string } | null> => {
    if (!story) return null;
    const id = generateId();
    try {
      await saveStory({
        ...story,
        flags: [...story.flags, { id, name: flagName, default_value: false }],
      });
      return { id };
    } catch (error: unknown) {
      const cause = error instanceof Error ? error.message : String(error);
      setSaveStatus({ state: "failed", message: cause });
      return null;
    }
  };

  if (!page) return null;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="space-y-4">
        <Input
          label={t.labels.pageTitle}
          type="text"
          id="page-title-input"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitTitleAndBody}
          value={name}
        />

        <MarkdownEditor
          value={body}
          onChange={setBody}
          onBlur={commitTitleAndBody}
          resolveImageUrl={resolveImageUrl}
        />
      </div>

      {flags.length > 0 && (
        <div
          className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
          data-testid="page-flag-operations"
        >
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            {t.labels.whenPageShown}
          </h3>
          <FlagOperations
            operations={page.flag_operations}
            availableFlags={flags}
            onAdd={(flagId, operation) =>
              updatePage({
                flag_operations: upsertFlagRule(page.flag_operations, {
                  flag_id: flagId,
                  operation: operation as "set_true" | "set_false" | "toggle",
                }),
              })
            }
            onRemove={(flagId) =>
              updatePage({
                flag_operations: removeFlagRule(page.flag_operations, flagId),
              })
            }
            onCreateFlag={handleCreateFlag}
          />
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t.labels.choices}
        </h3>

        {choices.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-4">
            {t.emptyStates.noChoices}
          </div>
        ) : (
          <div className="space-y-4">
            {choices.map((choice) => (
              <ChoiceEditor
                key={choice.id}
                choice={choice}
                pages={pages}
                flags={flags}
                onDraftChange={(patch) =>
                  setChoices((prev) =>
                    prev.map((c) =>
                      c.id === choice.id ? { ...c, ...patch } : c,
                    ),
                  )
                }
                onCommit={(patch) => updateChoice(choice.id, patch)}
                onDelete={() => removeChoice(choice.id)}
                onCreatePage={async (pageName) => {
                  const created = await createPage(pageName);
                  return created ? { id: created.id } : null;
                }}
                onCreateFlag={handleCreateFlag}
              />
            ))}
          </div>
        )}

        <Button
          variant="success"
          className="mt-4 w-full sm:w-auto"
          onClick={() => addChoice(pages[0]?.id ?? "")}
        >
          {t.buttons.addChoice}
        </Button>
      </div>
    </div>
  );
};

export default PageCard;
```

- [ ] **Step 7: Verify**

Run: `cd creation-tool && npx vitest run && npx tsc --noEmit && npx eslint . && yarn build`
Expected: 28 tests pass; tsc clean; eslint 0 errors; warnings **materially below 35** (PageCard's 12 should be gone).

Run: `cd creation-tool && yarn test:e2e`
Expected: 18 passing. These cover page title editing, body editing, choice creation and choice targeting — the exact paths restructured here. If any fail, the refactor changed behaviour; fix the code, not the test.

- [ ] **Step 8: Confirm the file actually shrank**

Run: `wc -l creation-tool/src/components/PageCard.tsx`
Expected: roughly 120 lines, down from 405. Report the real number.

- [ ] **Step 9: Commit**

```bash
git add creation-tool/src
git commit -m "refactor(editor): collapse PageCard handlers into usePageMutations"
```

---

### Task 6: Editor chrome context

**Files:**
- Create: `creation-tool/src/components/layout/EditorChromeContext.tsx`
- Modify: `creation-tool/src/components/layout/MainLayout.tsx`
- Modify: `creation-tool/src/components/layout/Sidebar.tsx`
- Modify: `creation-tool/src/components/layout/BottomBar.tsx`
- Modify: `creation-tool/src/pages/StoryEditorPage.tsx`

**Interfaces:**
- Produces: `EditorChromeProvider`, `useEditorChrome(): EditorChrome`

- [ ] **Step 1: Create the context**

Create `creation-tool/src/components/layout/EditorChromeContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from "react";

/**
 * View state owned by StoryEditorPage and needed by both layout bars.
 *
 * Story data (title, pages, start page) is deliberately NOT here — both bars
 * already read it from atoms, so passing it as props was redundant.
 */
export interface EditorChrome {
  onPlaytest: () => void;
  onTogglePreview: () => void;
  showPreview: boolean;
  hasPageSelected: boolean;
}

const EditorChromeContext = createContext<EditorChrome | null>(null);

export const EditorChromeProvider = ({
  value,
  children,
}: {
  value: EditorChrome;
  children: ReactNode;
}) => (
  <EditorChromeContext.Provider value={value}>
    {children}
  </EditorChromeContext.Provider>
);

export function useEditorChrome(): EditorChrome {
  const ctx = useContext(EditorChromeContext);
  if (!ctx) {
    throw new Error("useEditorChrome must be used inside EditorChromeProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Reduce `MainLayout` to children plus the indicator**

```tsx
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomBar } from "./BottomBar";
import { SaveStatus } from "../SaveStatus";

export const MainLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
    <Sidebar />
    <BottomBar />
    <main className="layout-main flex-1 overflow-auto">{children}</main>
    <SaveStatus />
  </div>
);
```

- [ ] **Step 3: Make the bars read their own data**

In `Sidebar.tsx` and `BottomBar.tsx`: delete the props interfaces and all seven props. Replace with

```tsx
  const { story, pages, flags, problems } = useStoryAtoms();
  const { onPlaytest, onTogglePreview, showPreview, hasPageSelected } = useEditorChrome();
```

and use `story?.title ?? ""` where `storyTitle` was used, and `story?.start_page ?? null` where `startPage` was used. `StorySettingsSection` and `PagesSection` still take `pages`/`startPage` as props — pass them from these locals; do not change those two components in this task.

- [ ] **Step 4: Provide the context from `StoryEditorPage`**

Wrap the `MainLayout` usage:

```tsx
      <EditorChromeProvider
        value={{
          onPlaytest: () => setPlaytestOpen(true),
          onTogglePreview: () => setShowPreview((p) => !p),
          showPreview,
          hasPageSelected: !!pageIdParam,
        }}
      >
        <MainLayout>{/* existing children unchanged */}</MainLayout>
      </EditorChromeProvider>
```

- [ ] **Step 5: Verify**

Run: `cd creation-tool && npx vitest run && npx tsc --noEmit && npx eslint . && yarn build && yarn test:e2e`
Expected: all unit tests pass; tsc clean; eslint 0 errors; 18 e2e passing.

- [ ] **Step 6: Commit**

```bash
git add creation-tool/src
git commit -m "refactor(editor): replace MainLayout prop drilling with chrome context"
```

---

### Task 7: Convert the remaining promise sites and promote the rules

**Files:**
- Modify: `creation-tool/src/components/FlagsDialog.tsx` (5 sites)
- Modify: `creation-tool/src/components/layout/AssetsSection.tsx` (6 sites)
- Modify: `creation-tool/src/pages/StartPage.tsx` (3 sites)
- Modify: `creation-tool/src/main.tsx` (3 sites)
- Modify: `creation-tool/src/components/layout/StorySettingsSection.tsx` (2 sites)
- Modify: `creation-tool/src/components/ui/SelectWithCreate.tsx` (2 sites)
- Modify: `creation-tool/src/components/NewPageButton.tsx` (1 site)
- Modify: `creation-tool/src/player/PlaytestView.tsx` (1 site)
- Modify: `creation-tool/eslint.config.js`

**Interfaces:**
- Consumes: `useTrackedAction` from `hooks/useTrackedAction`

- [ ] **Step 1: Convert each site using one of three patterns**

**Pattern A — an async function passed to an event handler** (`no-misused-promises`). Wrap it:

```tsx
// before
const handleDelete = async (filename: string) => {
  await api.deleteAsset(filename);
  refreshAssets();
};
// ... onClick={() => handleDelete(filename)}

// after
const handleDelete = useTrackedAction(async (filename: string) => {
  await api.deleteAsset(filename);
  await refreshAssets();
});
// ... onClick={() => handleDelete(filename)}
```

**Pattern B — a fire-and-forget call inside `useEffect`** (`no-floating-promises`). These are loads, not writes, so they must NOT report save status. Attach a rejection handler:

```tsx
// before
useEffect(() => {
  refreshAssets();
}, [refreshAssets]);

// after
useEffect(() => {
  void refreshAssets().catch((error: unknown) => {
    console.error("Failed to load assets:", error);
  });
}, [refreshAssets]);
```

**Pattern C — an unhandled promise in a non-event context** (`main.tsx`'s `unlisten` cleanup, `PlaytestView`'s loader). Same as B: `void` plus a `.catch`.

Use judgement per site: a **write** goes through `useTrackedAction`; a **load** gets pattern B. `StartPage` keeps its existing local `setError` display rather than adopting the save-status indicator, since it renders before any editor chrome exists.

- [ ] **Step 2: Confirm every site is converted**

Run: `cd creation-tool && npx eslint .`
Expected: **0 errors, 0 warnings.** Any remaining warning names a site you missed.

- [ ] **Step 3: Promote both rules to error**

In `creation-tool/eslint.config.js`, replace:

```javascript
      // TODO: these flag ~36 real sites (async onClick handlers and unawaited
      // saves) whose rejections are currently swallowed. Warn until those are
      // refactored, then promote back to "error".
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
```

with:

```javascript
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
```

- [ ] **Step 4: Verify the gate holds**

Run: `cd creation-tool && npx eslint .`
Expected: 0 errors, 0 warnings — now enforced as errors.

This step is the completeness check for Step 1: it cannot pass while any site remains unconverted.

- [ ] **Step 5: Full verification**

Run from the repo root: `yarn verify`
Then: `cd creation-tool && yarn test:e2e`
Then: `cd player && npx playwright test`
Expected: everything green — 52 Rust tests, all unit tests, 18 + 16 e2e, both builds.

- [ ] **Step 6: Commit**

```bash
git add creation-tool/src creation-tool/eslint.config.js
git commit -m "fix(editor): handle async rejections at every call site, enforce with lint"
```

---

## Self-Review Notes

**Spec coverage.** Global write status → Task 1. Asymmetric `saved`/`failed` display → Task 2. Pure flag-rule helpers → Task 3. `FlagRuleList` + wrappers → Task 4. `usePageMutations`, `ChoiceEditor`, PageCard → Task 5. Editor chrome context → Task 6. The 35 promise sites and rule promotion → Task 7. Targeted test infrastructure → Task 1 Step 1.

**Deliberately deferred.** `AssetsSection` contains hardcoded English ("Upload Image", "No assets yet", "Copy markdown embed", "Delete") — finding [15] in `docs/TODO.md`. Task 7 edits that file, so folding the i18n fix in would be tempting, but it is outside the approved spec. Left alone; the TODO entry stands.

**Verification note.** Task 5 is the highest-risk task: it rewrites the file the e2e suite exercises most. Its e2e run is not optional, and a failure there means the refactor changed behaviour.
