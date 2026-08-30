import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { atom, Provider } from "jotai";
import type { PageListItem } from "@fabler/types";
import { StorySettingsSection } from "../StorySettingsSection";
import api from "../../../api";

let trashedPages: PageListItem[] = [];

vi.mock("../../../atoms/storyAtoms", () => ({
  trashedPageListAtom: atom(() => trashedPages),
}));

vi.mock("../../../api", () => ({
  default: {
    getStory: vi.fn(),
    saveStory: vi.fn().mockResolvedValue(undefined),
    validateStory: vi.fn().mockResolvedValue({ problems: [] }),
  },
}));

const livePages: PageListItem[] = [{ id: "a1b2c", name: "Entrance" }];

beforeEach(() => {
  trashedPages = [];
  vi.clearAllMocks();
});

/** Fresh store per render — the mocked atom closes over a module-level `let`. */
function renderSection(startPage: string | null) {
  return render(
    <Provider>
      <StorySettingsSection
        storyTitle="Test story"
        pages={livePages}
        startPage={startPage}
      />
    </Provider>,
  );
}

describe("StorySettingsSection start-page dropdown", () => {
  /**
   * Deleting the start page is a supported flow, and this dropdown is where
   * the author lands afterwards. Before this test, the option carried the
   * raw id -- "9a0b1" -- with nothing to say the page was one restore away.
   */
  it("names a start page that is in the trash instead of showing its id", () => {
    trashedPages = [{ id: "b7c1d", name: "Dark Tunnel" }];
    renderSection("b7c1d");

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("b7c1d");
    expect(screen.getByRole("option", { name: "Dark Tunnel (in trash)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "b7c1d" })).toBeNull();
  });

  it("falls back to the raw id for a start page that resolves to no page at all", () => {
    trashedPages = [];
    renderSection("zzz99");

    expect(screen.getByRole("option", { name: "zzz99" })).toBeTruthy();
  });

  it("adds no extra option when the start page is a live one", () => {
    trashedPages = [{ id: "b7c1d", name: "Dark Tunnel" }];
    renderSection("a1b2c");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Entrance" })).toBeTruthy();
  });

  /**
   * Rendering the fallback option must not look like the author picked it:
   * React fires no `onChange` for a value it merely renders, and the stored
   * `start_page` has to survive untouched.
   */
  it("does not save the story just for rendering the fallback option", () => {
    trashedPages = [{ id: "b7c1d", name: "Dark Tunnel" }];
    renderSection("b7c1d");

    expect(api.saveStory).not.toHaveBeenCalled();
  });
});
