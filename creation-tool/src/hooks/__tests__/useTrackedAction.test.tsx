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
