import { Suspense, useEffect } from "react";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import styled from "styled-components";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import StorySidebar from "../components/StorySidebar";

interface StoryEditorPageProps {
  storyIdParam: string;
  pageIdParam?: string;
}

export default ({ storyIdParam, pageIdParam }: StoryEditorPageProps) => {
  const storyId = parseInt(storyIdParam);
  const pageId = pageIdParam !== undefined ? parseInt(pageIdParam) : undefined;

  const { story, pages, loadStory } = useStoryAtoms();

  useEffect(() => {
    loadStory(storyId);
  }, [storyId, loadStory]);

  // story and pages are always loaded here (or component suspended)
  if (!story) return <LoadingSpinner />;

  return (
    <StoryPage>
      <StorySidebar
        storyId={storyId}
        storyTitle={story.title}
        pages={pages}
        startPage={story.start_page}
      />
      <Main>
        {pageId ? (
          <Suspense fallback={<LoadingSpinner />}>
            <PageCard pageId={pageId} />
          </Suspense>
        ) : (
          <></>
        )}
      </Main>
    </StoryPage>
  );
};

const StoryPage = styled.div`
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-columns: fit-content(20%) auto;
  grid-template-rows: auto;
`;

const Main = styled.div`
  grid-column: 2;
  grid-row: 1;
`;
