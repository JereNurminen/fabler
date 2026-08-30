import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { saveStatusAtom } from "../../atoms/saveStatus";
import { SelectWithCreate } from "../ui/SelectWithCreate";

// This project's vitest config does not set `globals: true`, so
// @testing-library/react's automatic afterEach(cleanup) never self-registers.
afterEach(cleanup);

describe("SelectWithCreate", () => {
  it("surfaces a failure into the save-status atom when onCreate reports its own failure", async () => {
    // This is the regression guard for FIX 1: `onCreatePage` in PageCard.tsx
    // wraps `createPage` (which REJECTS on failure) in its own try/catch and
    // reports into `saveStatusAtom` before resolving to null — the same
    // contract `handleCreateFlag` already followed for flags. SelectWithCreate
    // itself must never touch the atom (it has no idea what "failed" means
    // for whatever entity is being created); it only needs to let a
    // conformant `onCreate` do its job without swallowing the result.
    const store = createStore();
    const onCreate = async (_name: string): Promise<{ id: string } | null> => {
      try {
        await Promise.reject(new Error("disk full"));
        return { id: "new-id" };
      } catch (error: unknown) {
        const cause = error instanceof Error ? error.message : String(error);
        store.set(saveStatusAtom, { state: "failed", message: cause });
        return null;
      }
    };

    render(
      <Provider store={store}>
        <SelectWithCreate
          label="Target"
          value=""
          options={[]}
          onChange={() => {}}
          onCreate={onCreate}
        />
      </Provider>,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "__create_new__" },
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "New Page" },
    });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() =>
      expect(store.get(saveStatusAtom).state).toBe("failed"),
    );
    const status = store.get(saveStatusAtom);
    if (status.state !== "failed") throw new Error("expected failed");
    expect(status.message).toContain("disk full");
  });
});

const options = [
  { id: "a1b2c", label: "Entrance" },
  { id: "d4e5f", label: "Great Hall" },
];

describe("SelectWithCreate unresolved value handling", () => {
  it("renders a fallback option for a value it cannot resolve", () => {
    render(
      <SelectWithCreate
        label="Leads to"
        value="b7c1d"
        options={options}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        unknownValueLabel={(id) => `Dark Tunnel (in trash) [${id}]`}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("b7c1d");
    expect(screen.getByText(/Dark Tunnel \(in trash\)/)).toBeTruthy();
  });

  it("does not fire onChange just because the value is unresolvable", () => {
    // A native select whose value matches no option renders blank and does
    // NOT fire onChange — so the stored target survives. This test locks that
    // in, because a regression here would silently rewrite choice targets.
    const onChange = vi.fn();
    render(
      <SelectWithCreate
        label="Leads to"
        value="b7c1d"
        options={options}
        onChange={onChange}
        onCreate={vi.fn()}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds no fallback option when the value does resolve", () => {
    render(
      <SelectWithCreate
        label="Leads to"
        value="a1b2c"
        options={options}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        unknownValueLabel={(id) => `unknown ${id}`}
      />,
    );
    expect(screen.queryByText(/unknown/)).toBeNull();
  });

  it("adds no fallback option for an empty value", () => {
    render(
      <SelectWithCreate
        label="Leads to"
        value=""
        options={options}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        unknownValueLabel={(id) => `unknown ${id}`}
      />,
    );
    expect(screen.queryByText(/unknown/)).toBeNull();
  });

  it("falls back to the raw id when no unknownValueLabel is supplied", () => {
    render(
      <SelectWithCreate
        label="Leads to"
        value="b7c1d"
        options={options}
        onChange={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("b7c1d");
    expect(screen.getByText("b7c1d")).toBeTruthy();
  });
});
