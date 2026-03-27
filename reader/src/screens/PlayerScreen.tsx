import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { StoryPlayer } from "@fabler/player/ui";
import type { Manifest } from "@fabler/player/engine/types";
import { TauriStorageAdapter } from "../adapters/TauriStorageAdapter";
import { TauriAssetResolver } from "../adapters/TauriAssetResolver";
import type { InstalledStory } from "../types";

interface PlayerScreenProps {
  story: InstalledStory;
  onBack: () => void;
}

export function PlayerScreen({ story, onBack }: PlayerScreenProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const storageRef = useRef(new TauriStorageAdapter());
  const assetsRef = useRef(new TauriAssetResolver(story.path));

  useEffect(() => {
    async function load() {
      const m = await invoke<Manifest>("get_manifest", { storyId: story.id });
      setManifest(m);
    }
    load();
  }, [story.id]);

  if (!manifest) {
    return (
      <div
        className="h-full flex items-center justify-center"
        data-theme="light"
        data-font-size="medium"
        style={{ backgroundColor: "var(--player-bg)", color: "var(--player-text)" }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-theme="light" data-font-size="medium">
      <div
        className="flex items-center px-2 py-1 shrink-0"
        style={{
          backgroundColor: "var(--player-surface)",
          borderBottom: "1px solid var(--player-border)",
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back to library"
          className="p-2 rounded min-w-[44px] min-h-[44px] cursor-pointer text-sm"
          style={{ color: "var(--player-text-muted)" }}
        >
          ← Library
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <StoryPlayer
          manifest={manifest}
          storage={storageRef.current}
          assets={assetsRef.current}
        />
      </div>
    </div>
  );
}
