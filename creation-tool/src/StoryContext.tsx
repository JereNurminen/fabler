import { createContext, useCallback, useContext, useState } from "react";
import { Story, Page, PagePatch } from "./bindings";
import api, { Result as ApiResult } from "./api";
import useMap from "./hooks/use-map";

type Result<T> = ApiResult<T, any>
type OkResult<T> = ApiResult<T, any> & { status: 'ok' }
type ErrorResult = ApiResult<any, any> & { status: 'error' }

type SuccessfullyLoaded<T> = { status: 'loaded', value: OkResult<T> }
export type Loadable<T> = { isDirty?: boolean } &
  (
    { status: 'not-loaded' } |
    { status: 'loading' } |
    SuccessfullyLoaded<T> |
    { status: 'loaded', value: ErrorResult}
  )

export const notLoaded = <T,>(): Loadable<T> => ({ status: 'not-loaded' });
export const isLoadedAndSuccess = <T,>(loadable: Loadable<T>): loadable is SuccessfullyLoaded<T> =>
  loadable.status === 'loaded' && loadable.value.status === 'ok'
export const loadedResult = <T,>(result: OkResult<T>): SuccessfullyLoaded<T> => ({ status: 'loaded', value: result })
export const errorResult = <T,>(result: ErrorResult): Loadable<T> => ({ status: 'loaded', value: result })

export const handleResult = <T, K extends any>(
  result: Result<T>,
  okFn: (result: OkResult<T>) => K,
  errorFn: (result: ErrorResult) => K
) => result.status === 'ok' ?
    okFn(result) : errorFn(result)

export const handleLoadable = <T, K extends any>(
  loadable: Loadable<T>,
  loadingFn: () => K,
  loadedFn: (result: OkResult<T>) => K,
  errorFn: (result: ErrorResult) => K
) => {
  switch (loadable.status) {
    case 'not-loaded':
    case 'loading':
      return loadingFn()
    case 'loaded':
      return handleResult(loadable.value, loadedFn, errorFn)
  }
}

type StoryContextProps = React.PropsWithChildren<{}>;

type Pages = Map<number, Loadable<Page>>

type StoryInfo = Omit<Story, 'pages'>

type StoryContextType = {
  story: Loadable<StoryInfo>;
  pages: Pages;

  loadStory: (id: number) => Promise<void>;
  getPage: (pageId: number) => Promise<Loadable<Page>>;
  patchPage: (patch: PagePatch) => Promise<Result<null>>;
  /*
  reloadPage: (pageId: number) => Promise<void>;
  deletePage: (pageId: number) => Promise<void>;
  */
};

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export const StoryProvider: React.FC<StoryContextProps> = ({ children }) => {
  const [story, setStory] = useState<Loadable<StoryInfo>>(notLoaded<Story>());
  const pageMap = useMap<number, Loadable<Page>>([])

  const loadStory = useCallback(async (id: number) => {
    setStory({ status: 'loading' });
    const storyResult = await api.getStory(id);
    handleResult(storyResult,
      (ok) => {
        ok.data.pages.forEach(
          page => pageMap.set(page.id, { status: 'loaded', value: { status: 'ok', data: page } })
        )
        setStory({ status: 'loaded', value: { status: 'ok', data: ok.data }})
      },
      (err) => { setStory({ status: 'loaded', value: err }) }
    );
  }, [])

  const getPage = useCallback(async (pageId: number) => {
    const page = pageMap.get(pageId);
    if (page && !page.isDirty && isLoadedAndSuccess(page)) {
      return page;
    }

    const pageResult = await api.getPage(pageId);

    return handleResult<Page, Loadable<Page>>(pageResult,
      (ok) => {
        const newValue: Loadable<Page> = {
          status: 'loaded',
          value: { status: 'ok', data: ok.data }
        }
        pageMap.set(pageId, newValue)
        return newValue
      },
      (err) => {
        const errorValue: Loadable<Page> = { status: 'loaded', value: err }
        pageMap.set(pageId, errorValue)
        return errorValue
      }
    );
  }, [])

  const patchPage = useCallback(async (patch: PagePatch) => {
    const result = await api.patchPage(patch);
    if (result.status === 'ok') {
      const loadedPage = await getPage(patch.id);
      if (isLoadedAndSuccess(loadedPage)) {
        pageMap.set(patch.id, loadedPage);
      }
    }
    return result;
  }, [getPage])

  return <StoryContext.Provider value={
    { story, pages: pageMap.map, loadStory, getPage, patchPage }
  }>
    {children}
  </StoryContext.Provider>
};

// Hook to use the Story context
export const useStoryContext = (): StoryContextType => {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
};
