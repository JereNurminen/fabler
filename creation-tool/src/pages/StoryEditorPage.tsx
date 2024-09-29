import { useEffect } from "react";
import { handleLoadable, useStoryContext } from "../StoryContext";
import styled from "styled-components";

interface StoryEditorPageProps {
  idParam: string;
}

export default ({ idParam }: StoryEditorPageProps) => {
  const id = parseInt(idParam);

  const { story, pages, loadStory } = useStoryContext()

  useEffect(() => {
    void loadStory(id)
  }, [id])

  console.debug({story, pages})

  return handleLoadable(
    story,
    () => <LoadingIndicator />,
    (story) =>
      <>
        <StoryHeading>{story.data.title}</StoryHeading>
        <PageList>
          {Array.from(pages.values()).map((page) =>
            handleLoadable(
              page,
              () => <LoadingIndicator />,
              ({ data }) => <PageCard>
                <PageTitle>{data.name}</PageTitle>
                <PageBody>{data.body}</PageBody>
              </PageCard>,
              (error) => <p>Error: {error.error}</p>
            ))}
        </PageList>
      </>,
    (err) => <p>Error: {err.error}</p>
  )
}

const LoadingIndicator = () => <p>Loading...</p>

const StoryHeading = styled.h1`
  font-size: 1.5em;
  text-align: center;
  color: palevioletred;
`;

const PageList = styled.div`
  list-style-type: none;
  padding: 0;
`;

const PageCard = styled.div`
  margin: 10px;
  padding: 10px;
  border: 1px solid black;
  border-radius: 5px;
`;

const PageTitle = styled.h2`
  font-size: 1.2em;
  color: palevioletred;
`;

const PageBody = styled.p`
  color: black;
`;
