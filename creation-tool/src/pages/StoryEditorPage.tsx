import { Suspense, useEffect } from "react";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import { MainLayout } from "../components/layout/MainLayout";
import { useTranslation } from "../i18n";

interface StoryEditorPageProps {
  storyIdParam: string;
  pageIdParam?: string;
}

export default ({ storyIdParam, pageIdParam }: StoryEditorPageProps) => {
  const storyId = parseInt(storyIdParam);
  const pageId = pageIdParam !== undefined ? parseInt(pageIdParam) : undefined;

  const { story, pages, loadStory } = useStoryAtoms();
  const { t } = useTranslation();

  useEffect(() => {
    loadStory(storyId);
  }, [storyId, loadStory]);

  // story and pages are always loaded here (or component suspended)
  if (!story) return <LoadingSpinner />;

  return (
    <MainLayout
      storyId={storyId}
      storyTitle={story.title}
      pages={pages}
      startPage={story.start_page}
    >
      {pageId ? (
        <Suspense fallback={<LoadingSpinner />}>
          <PageCard pageId={pageId} />
        </Suspense>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">{t.status.selectPage}</p>
        </div>
      )}
    </MainLayout>
  );
};
