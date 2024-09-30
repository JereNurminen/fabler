import { useEffect } from "react";
import {
  handleLoadable,
  isLoadedAndSuccess,
  useStoryContext,
} from "../StoryContext";
import styled from "styled-components";
import LoadingSpinner from "../components/LoadingSpinner";
import PageCard from "../components/PageCard";
import NewPageButton from "../components/NewPageButton";
import style from "../style";
import { useRoute } from "wouter";
import { pageRoute } from "../utilities/routing";
import PageLink from "../components/PageLink";

interface StoryEditorPageProps {
  storyIdParam: string;
  pageIdParam?: string;
}

export default ({ storyIdParam, pageIdParam }: StoryEditorPageProps) => {
  const storyId = parseInt(storyIdParam);
  const pageId = pageIdParam !== undefined ? parseInt(pageIdParam) : undefined;

  console.debug(storyId, pageId);

  const { story, pages, loadStory } = useStoryContext();

  useEffect(() => {
    void loadStory(storyId);
  }, [storyId]);

  return handleLoadable(
    story,
    () => <LoadingSpinner />,
    (story) => (
      <>
        <StoryPage>
          <Sidebar>
            <StoryHeading>{story.data.title}</StoryHeading>
            <PageList>
              {pages
                .filter(isLoadedAndSuccess)
                .sort((a, b) => a.value.data.id - b.value.data.id)
                .map((page) => (
                  <PageLink
                    key={page.value.data.id}
                    storyId={storyId}
                    pageId={page.value.data.id}
                  >
                    {page.value.data.name}
                  </PageLink>
                ))}
              <NewPageButton />
            </PageList>
          </Sidebar>
          <Main>{pageId ? <PageCard pageId={pageId} /> : <></>}</Main>
        </StoryPage>
      </>
    ),
    (err) => <p>Error: {err.error}</p>,
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
  flex-gap: ${style.spacing.m};
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
