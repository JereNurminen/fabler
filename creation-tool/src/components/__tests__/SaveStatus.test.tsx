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
    expect(container.innerHTML).toBe("");
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

    expect(container.innerHTML).toBe("");
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
