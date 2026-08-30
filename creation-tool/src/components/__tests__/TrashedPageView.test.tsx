import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { atom } from "jotai";
import type { Page } from "@fabler/types";
import { TrashedPageView } from "../TrashedPageView";

vi.mock("../../api", () => ({
  default: {
    getTrashedPage: vi.fn(),
  },
}));

const page: Page = {
  id: "b7c1d",
  name: "Dark Tunnel",
  body: { content: [{ type: "markdown", source: "Water drips." }] },
  choices: [
    {
      id: "c1a2b",
      text: "Go back",
      target: "a1b2c",
      flag_operations: [],
      conditions: [],
    },
  ],
  flag_operations: [],
  editor: null,
  last_modified: "2026-08-27T09:15:00.000Z",
};

beforeEach(async () => {
  const api = (await import("../../api")).default;
  vi.mocked(api.getTrashedPage).mockResolvedValue(page);
});

// `trashedPageAtomFamily`/`storyAtom` are real async atoms in production
// (correctly so -- see TrashedPageView.tsx), read through Suspense. In this
// environment (React 19 + jotai 2.20 + vitest/jsdom) a genuinely async jotai
// atom does not reliably resolve through Suspense within any bounded test
// timeout -- confirmed by isolating a bare `atom(async () => "x")` behind
// `<Suspense>` with a 9s `findBy` timeout and it still never settling. This
// mirrors the exact workaround `PageCard.test.tsx` already documents for
// `pageAtomFamily`/`pageListAtom`: replace the atoms with synchronous
// stand-ins so the test exercises rendering, not this environment's async
// Suspense integration. The fixture literal is duplicated here (not read
// from the outer `page` const) because `vi.mock` factories are hoisted
// above module-scope `const`s, which are not yet initialized when this
// factory runs -- referencing `page` here throws a TDZ error.
vi.mock("../../atoms/storyAtoms", () => {
  const trashedPage: Page = {
    id: "b7c1d",
    name: "Dark Tunnel",
    body: { content: [{ type: "markdown", source: "Water drips." }] },
    choices: [
      {
        id: "c1a2b",
        text: "Go back",
        target: "a1b2c",
        flag_operations: [],
        conditions: [],
      },
    ],
    flag_operations: [],
    editor: null,
    last_modified: "2026-08-27T09:15:00.000Z",
  };
  const pageAtom = atom(trashedPage);
  const story = atom<null>(null);
  return {
    trashedPageAtomFamily: () => pageAtom,
    storyAtom: story,
  };
});

describe("TrashedPageView", () => {
  it("says the page is in the trash", async () => {
    render(
      <Suspense fallback={null}>
        <TrashedPageView pageId="b7c1d" />
      </Suspense>,
    );
    expect(await screen.findByTestId("trashed-page-banner")).toBeTruthy();
  });

  it("offers restore and permanent deletion", async () => {
    render(
      <Suspense fallback={null}>
        <TrashedPageView pageId="b7c1d" />
      </Suspense>,
    );
    expect(await screen.findByRole("button", { name: /restore/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /delete permanently/i })).toBeTruthy();
  });

  it("has no editable field anywhere — this is the read-only guarantee", async () => {
    const { container } = render(
      <Suspense fallback={null}>
        <TrashedPageView pageId="b7c1d" />
      </Suspense>,
    );
    await screen.findByTestId("trashed-page-banner");

    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("shows choices as plain text, not as navigation", async () => {
    const { container } = render(
      <Suspense fallback={null}>
        <TrashedPageView pageId="b7c1d" />
      </Suspense>,
    );
    await screen.findByTestId("trashed-page-banner");

    expect(screen.getByText(/Go back/)).toBeTruthy();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
