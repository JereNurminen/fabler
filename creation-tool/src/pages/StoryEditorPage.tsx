import { Suspense, useState } from "react";
import { useAtomValue } from "jotai";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { pageAtomFamily } from "../atoms/storyAtoms";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import { MainLayout } from "../components/layout/MainLayout";
import { PlaytestView } from "../player/PlaytestView";
import { PreviewView } from "../player/PreviewView";

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
  const { story, pages } = useStoryAtoms();
  const [playtestOpen, setPlaytestOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!story) return <LoadingSpinner />;

  return (
    <>
      <MainLayout
        storyTitle={story.title}
        pages={pages}
        startPage={story.start_page}
        onPlaytest={() => setPlaytestOpen(true)}
        onTogglePreview={() => setShowPreview((p) => !p)}
        showPreview={showPreview}
        hasPageSelected={!!pageIdParam}
      >
        {pageIdParam ? (
          <Suspense fallback={<LoadingSpinner />}>
            <div className={showPreview ? "flex h-full" : "h-full"}>
              <div className={showPreview ? "flex-1 overflow-auto" : "h-full"}>
                <PageCard pageId={pageIdParam} />
              </div>
              {showPreview && (
                <Suspense fallback={<LoadingSpinner />}>
                  <PreviewPanel pageId={pageIdParam} />
                </Suspense>
              )}
            </div>
          </Suspense>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a page to edit</p>
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

export default StoryEditorPage;
