import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import type {
  Manifest,
  StorageAdapter,
  AssetResolver,
} from "../engine/types";
import { useGameState, usePreferences } from "./hooks";
import { PageView } from "./PageView";
import { ChoiceList } from "./ChoiceList";
import { PlayerChrome } from "./PlayerChrome";
import { Settings } from "./Settings";
import { SaveLoadMenu } from "./SaveLoadMenu";

export interface StoryPlayerHandle {
  openSave: () => void;
  openSettings: () => void;
}

interface StoryPlayerProps {
  manifest: Manifest;
  storage?: StorageAdapter;
  assets: AssetResolver;
  hideChrome?: boolean;
}

export const StoryPlayer = forwardRef<StoryPlayerHandle, StoryPlayerProps>(
  function StoryPlayer({ manifest, storage, assets, hideChrome = false }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const { preferences, updatePreference } = usePreferences(rootRef);
    const { gameState, currentPage, availableChoices, handleChoice, restoreState } =
      useGameState(manifest);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      openSave: () => setSaveOpen(true),
      openSettings: () => setSettingsOpen(true),
    }));

    // Scroll to top and focus content on page change
    useEffect(() => {
      const main = rootRef.current?.querySelector("main");
      main?.scrollTo(0, 0);
      const article = main?.querySelector("article");
      if (article instanceof HTMLElement) {
        article.focus();
      }
    }, [gameState.currentPageId]);

    if (!currentPage) {
      return (
        <div
          ref={rootRef}
          role="alert"
          style={{ color: "var(--player-text)", padding: "1em" }}
        >
          Page not found: {gameState.currentPageId}
        </div>
      );
    }

    return (
      <div
        ref={rootRef}
        className="h-full"
        style={{ backgroundColor: "var(--player-bg)" }}
      >
        {hideChrome ? (
          <div className="flex flex-col h-full">
            <main className="flex-1 overflow-y-auto p-[1.5em]">
              <div aria-live="polite">
                <PageView page={currentPage} assets={assets} />
              </div>
              <ChoiceList choices={availableChoices} onChoose={handleChoice} />
            </main>
          </div>
        ) : (
          <PlayerChrome
            title={manifest.story.title}
            onSettingsOpen={() => setSettingsOpen(true)}
            onSaveOpen={() => setSaveOpen(true)}
          >
            <div aria-live="polite">
              <PageView page={currentPage} assets={assets} />
            </div>
            <ChoiceList choices={availableChoices} onChoose={handleChoice} />
          </PlayerChrome>
        )}

        {settingsOpen && (
          <Settings
            preferences={preferences}
            onUpdate={updatePreference}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {saveOpen && storage && (
          <SaveLoadMenu
            storyId={manifest.story.id}
            storage={storage}
            gameState={gameState}
            onRestore={restoreState}
            onClose={() => setSaveOpen(false)}
          />
        )}
      </div>
    );
  }
);
