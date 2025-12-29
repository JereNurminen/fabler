import { useCallback, useEffect, useState } from "react";
import { StoryListing } from "../bindings";
import api from "../api";
import { handleResult, Loadable } from "../StoryContext";
import styled from "styled-components";
import { Link, useLocation } from "wouter";
import { getLinkToStoryPage } from "../utilities/routing";
import { NewStoryDialog } from "../components/NewStoryDialog";

export const StartPage = () => {
  const [stories, setStories] = useState<Loadable<StoryListing[]>>({
    status: "not-loaded",
  });
  const [showNewStoryModal, setShowStoryModal] = useState(false);
  const [_, setLocation] = useLocation();

  const loadStories = useCallback(async () => {
    setStories({ status: "loading" });
    const result = await api.getStoryList();

    if (result.status === "ok") {
      setStories({ status: "loaded", value: result });
    } else {
      // TODO: Error handling
    }
  }, []);

  useEffect(() => {
    void loadStories();
  }, []);

  const createNewStory = useCallback(async (title: string) => {
    const newStoryId = await api.createStory(title);
    await loadStories();
    return newStoryId;
  }, []);

  const content = (() => {
    switch (stories.status) {
      case "not-loaded":
      case "loading":
        return <p>Loading...</p>;
      case "loaded":
        return handleResult(
          stories.value,
          (ok) => (
            <StoryList>
              {ok.data.map((story) => (
                <StoryListItem
                  key={story.id}
                  href={getLinkToStoryPage(story.id)}
                >
                  {`${story.id}: ${story.title}`}
                </StoryListItem>
              ))}
            </StoryList>
          ),
          (err) => <p>Error: {err.error}</p>,
        );
    }
  })();

  return (
    <StartPageContainer>
      <h1>Hello</h1>
      <div>{content}</div>
      <div>
        <button
          onClick={() => {
            setShowStoryModal(true);
          }}
        >
          New Story
        </button>
      </div>
      {showNewStoryModal ? (
        <NewStoryDialog
          onConfirm={async (title) => {
            const result = await createNewStory(title);
            if (result.status === "ok") {
              setLocation(getLinkToStoryPage(result.data));
            }
          }}
          onCancel={() => setShowStoryModal(false)}
        />
      ) : null}
    </StartPageContainer>
  );
};

const StartPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background-color: #f0f0f0;
  font-family: Arial, sans-serif;
`;

const StoryList = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const StoryListItem = styled(Link)`
  padding: 10px;
  margin: 10px;
  border: 1px solid black;
`;
