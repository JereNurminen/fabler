import { Suspense, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { pageAtomFamily } from "../atoms/storyAtoms";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import { MainLayout } from "../components/layout/MainLayout";
import { useTranslation } from "../i18n";
import { PlaytestView } from "../player/PlaytestView";
import { PreviewView } from "../player/PreviewView";
import type { Page } from "../bindings";

interface StoryEditorPageProps {
  storyIdParam: string;
  pageIdParam?: string;
}

function PreviewPanel({ pageId }: { pageId: number }) {
  const page = useAtomValue(pageAtomFamily(pageId)) as Page;
  if (!page) return null;
  return (
    <div className="w-96 border-l border-gray-200 hidden lg:block">
      <PreviewView page={page} />
    </div>
  );
}

export default ({ storyIdParam, pageIdParam }: StoryEditorPageProps) => {
  const storyId = parseInt(storyIdParam);
  const pageId = pageIdParam !== undefined ? parseInt(pageIdParam) : undefined;

  const { story, pages, loadStory } = useStoryAtoms();
  const { t } = useTranslation();

  const [playtestOpen, setPlaytestOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadStory(storyId);
  }, [storyId, loadStory]);

  // story and pages are always loaded here (or component suspended)
  if (!story) return <LoadingSpinner />;

  return (
    <>
      <MainLayout
        storyId={storyId}
        storyTitle={story.title}
        pages={pages}
        startPage={story.start_page}
        onPlaytest={() => setPlaytestOpen(true)}
        onTogglePreview={() => setShowPreview((v) => !v)}
        showPreview={showPreview}
        hasPageSelected={pageId !== undefined}
      >
        {pageId ? (
          <Suspense fallback={<LoadingSpinner />}>
            <div className={showPreview ? "flex h-full" : "h-full"}>
              <div className={showPreview ? "flex-1 overflow-auto" : "h-full"}>
                <PageCard pageId={pageId} />
              </div>
              {showPreview && (
                <Suspense fallback={<LoadingSpinner />}>
                  <PreviewPanel pageId={pageId} />
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

      {playtestOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <PlaytestView onClose={() => setPlaytestOpen(false)} />
        </Suspense>
      )}
    </>
  );
};
