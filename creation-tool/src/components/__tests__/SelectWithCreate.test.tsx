import { describe, it, expect, afterEach } from "vitest";
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
