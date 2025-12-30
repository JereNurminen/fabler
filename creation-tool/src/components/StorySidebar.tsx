import { useState } from "react";
import styled from "styled-components";
import PageLink from "./PageLink";
import NewPageButton from "./NewPageButton";
import { StorySettingsDialog } from "./StorySettingsDialog";
import { FlagsDialog } from "./FlagsDialog";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { theme } from "../style";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import api from "../api";
import { useTranslation } from "../i18n";

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
  const [showFlags, setShowFlags] = useState(false);
  const { patchStory } = useStoryAtoms();
  const { t } = useTranslation();

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
      alert(t.alerts.updateSettingsFailed);
    }
  };

  const handleExportStory = async () => {
    try {
      const result = await api.exportStoryToml(storyId);
      if (result.status === "ok") {
        const tomlContent = result.data;
        const filePath = await save({
          defaultPath: `${storyTitle}.toml`,
          filters: [
            {
              name: "TOML",
              extensions: ["toml"],
            },
          ],
        });

        if (filePath) {
          await writeTextFile(filePath, tomlContent);
          alert(t.alerts.exportSuccess);
        }
      } else {
        alert(t.alerts.exportFailed);
      }
    } catch (error) {
      console.error("Failed to export story:", error);
      alert(t.alerts.exportFailed);
    }
  };

  const handleExportSchema = async () => {
    try {
      const schema = await api.getTomlSchema();
      const filePath = await save({
        defaultPath: "story-schema.toml",
        filters: [
          {
            name: "TOML",
            extensions: ["toml"],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, schema);
        alert(t.alerts.schemaExported);
      }
    } catch (error) {
      console.error("Failed to export schema:", error);
      alert(t.alerts.schemaExportFailed);
    }
  };

  return (
    <>
      <Sidebar>
        <Header>
          <StoryHeading>{storyTitle}</StoryHeading>
          <FlagsButton onClick={() => setShowFlags(true)} title={t.buttons.manageFlags}>
            🏴
          </FlagsButton>
          <ExportButton onClick={handleExportStory} title="Export story">
            📤
          </ExportButton>
          <SettingsButton onClick={() => setShowSettings(true)}>
            ⚙️
          </SettingsButton>
        </Header>
        <PageList>
          {pages
            .sort((a, b) => a.id - b.id)
            .map((page) => (
              <PageLink key={page.id} storyId={storyId} pageId={page.id}>
                {page.id === startPage && <StartBadge>{t.badges.start}</StartBadge>}
                {t.dynamic.pageDisplay(page.name, page.id)}
              </PageLink>
            ))}
          <NewPageButton storyId={storyId} />
          <SchemaButton onClick={handleExportSchema}>
            {t.buttons.exportSchema}
          </SchemaButton>
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

      {showFlags && <FlagsDialog onClose={() => setShowFlags(false)} />}
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

const ExportButton = styled.button`
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

const SchemaButton = styled.button`
  margin-top: 8px;
  padding: 8px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
`;

const FlagsButton = styled.button`
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
