import { useState, useCallback, useEffect } from "react";
import type {
  Manifest,
  ManifestChoice,
  GameState,
  UserPreferences,
} from "../engine/types";
import { DEFAULT_PREFERENCES } from "../engine/types";
import {
  initGameState,
  navigate,
  getAvailableChoices,
} from "../engine/runtime";
import { applyPreferences } from "./preferences";

export function useGameState(manifest: Manifest) {
  const [gameState, setGameState] = useState<GameState>(() =>
    initGameState(manifest),
  );

  const currentPage = manifest.pages.find(
    (p) => p.id === gameState.currentPageId,
  );

  const availableChoices = currentPage
    ? getAvailableChoices(currentPage, gameState.flags)
    : [];

  // Set when a choice points at a page that isn't in the manifest. Cleared on
  // the next successful move; the reader stays put and can choose again.
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const handleChoice = useCallback(
    (choice: ManifestChoice) => {
      const result = navigate(manifest, gameState, choice);
      if (!result.ok) {
        setNavigationError(result.target);
        return;
      }
      setNavigationError(null);
      setGameState(result.state);
    },
    [manifest, gameState],
  );

  const restoreState = useCallback((saved: GameState) => {
    setNavigationError(null);
    setGameState(saved);
  }, []);

  return {
    gameState,
    currentPage,
    availableChoices,
    handleChoice,
    restoreState,
    navigationError,
  };
}

export function usePreferences(rootRef: React.RefObject<HTMLElement | null>) {
  const [preferences, setPreferences] = useState<UserPreferences>(
    DEFAULT_PREFERENCES,
  );

  useEffect(() => {
    if (rootRef.current) {
      applyPreferences(rootRef.current, preferences);
    }
  }, [preferences, rootRef]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { preferences, updatePreference };
}
