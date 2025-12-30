import { useState } from "react";
import styled from "styled-components";
import PageLink from "./PageLink";
import NewPageButton from "./NewPageButton";
import { StorySettingsDialog } from "./StorySettingsDialog";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { theme } from "../style";

interface StorySidebarProps {
  storyId: number;
  storyTitle: string;
  pages: Array<{ id: number; name: string }>;
  startPage: number | null;
}

export default function StorySidebar({
  storyId,
  storyTitle,
  pages,
  startPage,
}: StorySidebarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { patchStory } = useStoryAtoms();

  const handleSaveSettings = async (title: string, newStartPage: number) => {
    try {
      await patchStory({
        id: storyId,
        title,
        start_page: newStartPage,
      });
      setShowSettings(false);
    } catch (error) {
      console.error("Failed to update story settings:", error);
      alert("Failed to update story settings");
    }
  };

  return (
    <>
      <Sidebar>
        <Header>
          <StoryHeading>{storyTitle}</StoryHeading>
          <SettingsButton onClick={() => setShowSettings(true)}>
            ⚙️
          </SettingsButton>
        </Header>
        <PageList>
          {pages
            .sort((a, b) => a.id - b.id)
            .map((page) => (
              <PageLink key={page.id} storyId={storyId} pageId={page.id}>
                {page.id === startPage && <StartBadge>START</StartBadge>}
                {`${page.name || `Page ${page.id}`}`}
              </PageLink>
            ))}
          <NewPageButton storyId={storyId} />
        </PageList>
      </Sidebar>

      {showSettings && (
        <StorySettingsDialog
          storyId={storyId}
          initialTitle={storyTitle}
          initialStartPage={startPage}
          pages={pages}
          onConfirm={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

const Sidebar = styled.div`
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  flex-gap: ${theme.spacing.m};
  border-right: 1px solid black;
  padding: ${theme.spacing.m} ${theme.spacing.m};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const StoryHeading = styled.h1`
  font-size: 1.5em;
  text-align: center;
  color: palevioletred;
  flex: 1;
`;

const SettingsButton = styled.button`
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`;

const StartBadge = styled.span`
  display: inline-block;
  background-color: ${(props) => props.theme.primary};
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
`;

const PageList = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
`;
