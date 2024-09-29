import { useCallback, useEffect, useState } from "react";
import { StoryListing } from "../bindings";
import api from "../api";
import { handleResult, Loadable } from "../StoryContext";
import styled from "styled-components";
import { Link } from "wouter";
import { getLinkToStoryPage } from "../main";

export const StartPage = () => {
  const [stories, setStories] = useState<Loadable<StoryListing[]>>({ status: 'not-loaded' });

  const loadStories = useCallback(async () => {
    setStories({ status: 'loading' });
    const result = await api.getStoryList()

    if (result.status === "ok") {
      setStories({ status: 'loaded', value: result });
    } else {
      // TODO: Error handling
    }
  }, [])

  useEffect(() => {
    void loadStories();
  }, []);

  const createNewStory = useCallback(async () => {
    await api.createStory('New Story');
    loadStories();
  }, [])

  const content = (() => {
    switch (stories.status) {
      case 'not-loaded':
      case 'loading':
        return <p>Loading...</p>;
      case 'loaded':
        return handleResult(
          stories.value,
          (ok) =>
            <StoryList>
              {ok.data.map((story) => <StoryListItem key={story.id} href={getLinkToStoryPage(story.id)}>
                {`${story.id}: ${story.title}`}
              </StoryListItem>)}
            </StoryList>,
          (err) => <p>Error: {err.error}</p>);
    }
  })()

  return (
    <StartPageContainer>
      <h1>Hello</h1>
      <div>
        {content}
      </div>
      <div>
        <button onClick={createNewStory}>
          New Story
        </button>
      </div>
    </StartPageContainer>
  );
}

const StartPageContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
    background-color: #f0f0f0;
    font-family: Arial, sans-serif;
    `

const StoryList = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    `

const StoryListItem = styled(Link)`
    padding: 10px;
    margin: 10px;
    border: 1px solid black;
    `
