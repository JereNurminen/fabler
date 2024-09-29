import { createContext, useCallback, useContext, useState } from "react";
import { Story, Page } from "./bindings";
import api, { Result as ApiResult } from "./api";

type Result<T> = ApiResult<T, any>
type OkResult<T> = ApiResult<T, any> & { status: 'ok' }
type ErrorResult = ApiResult<any, any> & { status: 'error' }

export type Loadable<T> = { isDirty?: boolean } &
  (
    { status: 'not-loaded' } |
    { status: 'loading' } |
    { status: 'loaded', value: Result<T> }
  )

export const notLoaded = <T,>(): Loadable<T> => ({ status: 'not-loaded' });

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
  /*
  getPage: (pageId: number) => Promise<Result<Page>>;
  reloadPage: (pageId: number) => Promise<void>;
  deletePage: (pageId: number) => Promise<void>;
  updatePage: (pageId: number, page: Partial<Page>) => Promise<Result<Page>>;
  */
};

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export const StoryProvider: React.FC<StoryContextProps> = ({ children }) => {
  const [story, setStory] = useState<Loadable<StoryInfo>>(notLoaded<Story>());
  const [pages, setPages] = useState<Pages>(new Map());

  const loadStory = useCallback(async (id: number) => {
    setStory({ status: 'loading' });
    const storyResult = await api.getStory(id);
    handleResult(storyResult,
      (ok) => {
        const pageMap: Pages = new Map();
        ok.data.pages.forEach(page => pageMap.set(page.id, { status: 'loaded', value: { status: 'ok', data: page } }));
        setStory({ status: 'loaded', value: { status: 'ok', data: ok.data }})
        console.log('setPages', pageMap)
        setPages(pageMap)
      },
      (err) => { setStory({ status: 'loaded', value: err }) }
    );
  }, [])

  return <StoryContext.Provider value={
    { story, pages, loadStory }
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
