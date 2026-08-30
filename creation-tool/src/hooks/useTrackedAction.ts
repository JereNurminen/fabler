import { useCallback, useRef } from "react";
import { useSetAtom } from "jotai";
import { saveStatusAtom } from "../atoms/saveStatus";

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
