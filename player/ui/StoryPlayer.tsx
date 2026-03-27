import { useRef, useEffect, useState } from "react";
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

interface StoryPlayerProps {
  manifest: Manifest;
  storage?: StorageAdapter;
  assets: AssetResolver;
}

export function StoryPlayer({ manifest, storage, assets }: StoryPlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { preferences, updatePreference } = usePreferences(rootRef);
  const { gameState, currentPage, availableChoices, handleChoice, restoreState } =
    useGameState(manifest);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

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
