import { Suspense, useEffect } from "react";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import styled from "styled-components";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import NewPageButton from "../components/NewPageButton";
import { theme } from "../style";
import PageLink from "../components/PageLink";

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
      <Sidebar>
        <StoryHeading>{story.title}</StoryHeading>
        <PageList>
          {pages
            .sort((a, b) => a.id - b.id)
            .map((page) => (
              <PageLink key={page.id} storyId={storyId} pageId={page.id}>
                {`${page.name || `Page ${page.id}`}`}
              </PageLink>
            ))}
          <NewPageButton />
        </PageList>
      </Sidebar>
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

const Sidebar = styled.div`
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  flex-gap: ${theme.spacing.m};
  border-right: 1px solid black;
`;

const Main = styled.div`
  grid-column: 2;
  grid-row: 1;
`;

const StoryHeading = styled.h1`
  font-size: 1.5em;
  text-align: center;
  color: palevioletred;
`;

const PageList = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
`;
