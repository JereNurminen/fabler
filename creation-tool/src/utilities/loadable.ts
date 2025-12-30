import type { Result as ApiResult } from "../api";

type Result<T> = ApiResult<T, any>;
type OkResult<T> = ApiResult<T, any> & { status: "ok" };
type ErrorResult = ApiResult<any, any> & { status: "error" };

type SuccessfullyLoaded<T> = { status: "loaded"; value: OkResult<T> };
export type Loadable<T> = (
  | { status: "not-loaded" }
  | { status: "loading" }
  | SuccessfullyLoaded<T>
  | { status: "loaded"; value: ErrorResult }
) & { isDirty?: boolean };

export const notLoaded = <T,>(): Loadable<T> => ({ status: "not-loaded" });

export const isLoadedAndSuccess = <T,>(
  loadable: Loadable<T>,
): loadable is SuccessfullyLoaded<T> =>
  loadable.status === "loaded" && loadable.value.status === "ok";

export const loadedResult = <T,>(
  result: OkResult<T>,
): SuccessfullyLoaded<T> => ({ status: "loaded", value: result });

export const errorResult = (errorMsg: string): ErrorResult => ({
  status: "error",
  error: errorMsg,
});

export const handleResult = <T, K extends any>(
  result: Result<T>,
  okFn: (result: OkResult<T>) => K,
  errorFn: (result: ErrorResult) => K,
) => (result.status === "ok" ? okFn(result) : errorFn(result));

export const handleLoadable = <T, K extends any>(
  loadable: Loadable<T>,
  loadingFn: () => K,
  loadedFn: (result: OkResult<T>) => K,
  errorFn: (result: ErrorResult) => K,
) => {
  switch (loadable.status) {
    case "not-loaded":
    case "loading":
      return loadingFn();
    case "loaded":
      return handleResult(loadable.value, loadedFn, errorFn);
  }
};
