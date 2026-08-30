import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChoiceEditor } from "../ChoiceEditor";
import type { Choice } from "@fabler/types";

// This project's vitest config does not set `globals: true`, so
// @testing-library/react's automatic afterEach(cleanup) never self-registers.
afterEach(cleanup);

const baseChoice: Choice = {
  id: "c1",
  text: "Go north",
  target: "b7c1d",
  flag_operations: [],
  conditions: [],
};

const livePages = [
  { id: "a1b2c", name: "Entrance" },
  { id: "d4e5f", name: "Great Hall" },
];

function renderEditor(choice: Choice, trashedPages: Array<{ id: string; name: string }>) {
  return render(
    <ChoiceEditor
      choice={choice}
      pages={livePages}
      flags={[]}
      trashedPages={trashedPages}
      onDraftChange={() => {}}
      onCommit={() => {}}
      onDelete={() => {}}
      onCreatePage={vi.fn()}
      onCreateFlag={vi.fn()}
    />,
  );
}

describe("ChoiceEditor", () => {
  it("labels a trashed target using the trashed page's name, not its raw id", () => {
    renderEditor(baseChoice, [{ id: "b7c1d", name: "Dark Tunnel" }]);

    // The label must come from the trashed page's NAME ("Dark Tunnel"), not
    // its id ("b7c1d") -- a regression here would show the author an opaque
    // id instead of a page they can recognise.
    expect(screen.getByText(/Dark Tunnel \(in trash\)/)).toBeTruthy();
    expect(screen.queryByText("b7c1d")).toBeNull();
  });

  it("falls back to the raw id when the target resolves to no page at all", () => {
    // Not in `pages` and not in `trashedPages` either -- a genuinely dangling
    // target, which pre-dates the trash feature.
    renderEditor(baseChoice, [{ id: "someOtherId", name: "Unrelated Page" }]);

    expect(screen.getByText("b7c1d")).toBeTruthy();
    expect(screen.queryByText(/in trash/)).toBeNull();
  });
});
