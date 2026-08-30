import { Suspense, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { useLocation } from "wouter";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { pageAtomFamily, pageListAtom, trashedPageListAtom } from "../atoms/storyAtoms";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import { TrashedPageView } from "../components/TrashedPageView";
import { MainLayout } from "../components/layout/MainLayout";
import { EditorChromeProvider } from "../components/layout/EditorChromeContext";
import { TrashPageProvider } from "../components/TrashPageContext";
import { PlaytestView } from "../player/PlaytestView";
import { PreviewView } from "../player/PreviewView";
import { StoryGraphView } from "../graph/StoryGraphView";
import { editorRoute, getLinkToPage } from "../utilities/routing";
import { useTranslation } from "../i18n";

interface StoryEditorPageProps {
  pageIdParam?: string;
}

function PreviewPanel({ pageId }: { pageId: string }) {
  const page = useAtomValue(pageAtomFamily(pageId));
  if (!page) return null;
  return (
    <div className="w-96 border-l border-gray-200 hidden lg:block">
      <PreviewView page={page} />
    </div>
  );
}

const StoryEditorPage = ({ pageIdParam }: StoryEditorPageProps) => {
  const { t } = useTranslation();
  const { story } = useStoryAtoms();
  const [, setLocation] = useLocation();
  const [playtestOpen, setPlaytestOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const pages = useAtomValue(pageListAtom);
  const trashed = useAtomValue(trashedPageListAtom);
  const isTrashed = !!pageIdParam && trashed.some((p) => p.id === pageIdParam);
  const isLive = !!pageIdParam && pages.some((p) => p.id === pageIdParam);

  /**
   * The routed page exists nowhere: not live, not in the trash. Mounting
   * `PageCard` for it would call `get_page`, get `PageNotFound`, reject the
   * async atom and throw out of `useAtomValue` — into the app-level
   * `ErrorBoundary`, which wraps the whole router and has no reset path. The
   * editor would stay an error screen until the app restarts.
   *
   * Purging is how an author gets here: from the sidebar while viewing that
   * page, from "Empty trash", or from the trashed page's own view. One guard
   * at the routing seam covers all three, and cannot be forgotten by a future
   * purge call site the way a redirect per call site was.
   *
   * `pageListAtom`/`trashedPageListAtom` are async and read through Suspense,
   * so both lists are settled whenever this renders — there is no
   * still-loading window in which this could bounce the author off a page
   * that does exist.
   */
  const routedPageIsGone = !!pageIdParam && !isLive && !isTrashed;

  const startPage = story?.start_page ?? null;
  const startPageIsLive = !!startPage && pages.some((p) => p.id === startPage);

  useEffect(() => {
    if (!routedPageIsGone) return;
    // Back to the start page when there still is one — otherwise the editor
    // root, which renders the empty "select a page" state. Deleting the start
    // page is a supported flow, so "it exists and is itself live" has to be
    // checked rather than assumed.
    setLocation(
      startPage && startPageIsLive ? getLinkToPage(startPage) : editorRoute,
      { replace: true },
    );
  }, [routedPageIsGone, startPage, startPageIsLive, setLocation]);

  if (!story) return <LoadingSpinner />;

  const showPage = !!pageIdParam && !routedPageIsGone;

  return (
    <TrashPageProvider>
      <EditorChromeProvider
        value={{
          onPlaytest: () => setPlaytestOpen(true),
          onTogglePreview: () => setShowPreview((p) => !p),
          onOpenGraph: () => setGraphOpen(true),
          showPreview,
          hasPageSelected: showPage,
        }}
      >
        <MainLayout>
          {showPage && pageIdParam ? (
            <Suspense fallback={<LoadingSpinner />}>
              <div className={showPreview ? "flex h-full" : "h-full"}>
                <div
                  className={showPreview ? "flex-1 overflow-auto" : "h-full"}
                >
                  {isTrashed ? (
                    <TrashedPageView pageId={pageIdParam} />
                  ) : (
                    <PageCard pageId={pageIdParam} />
                  )}
                </div>
                {showPreview && !isTrashed && (
                  <Suspense fallback={<LoadingSpinner />}>
                    <PreviewPanel pageId={pageIdParam} />
                  </Suspense>
                )}
              </div>
            </Suspense>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">{t.status.selectPage}</p>
            </div>
          )}
        </MainLayout>
      </EditorChromeProvider>
      {playtestOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <PlaytestView onClose={() => setPlaytestOpen(false)} />
        </Suspense>
      )}
      {graphOpen && <StoryGraphView onClose={() => setGraphOpen(false)} />}
    </TrashPageProvider>
  );
};

export default StoryEditorPage;
