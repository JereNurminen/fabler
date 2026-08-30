import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { StoryPlayer } from "@fabler/player/ui";
import type { StoryPlayerHandle } from "@fabler/player/ui";
import type { Manifest } from "@fabler/player/engine/types";
import { TauriStorageAdapter } from "../adapters/TauriStorageAdapter";
import { TauriAssetResolver } from "../adapters/TauriAssetResolver";
import type { InstalledStory } from "../types";
import { PlayerBar } from "../components/PlayerBar";

interface PlayerScreenProps {
  story: InstalledStory;
  onBack: () => void;
}

export function PlayerScreen({ story, onBack }: PlayerScreenProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const storageRef = useRef(new TauriStorageAdapter());
  const assetsRef = useRef(new TauriAssetResolver(story.path));
  const playerRef = useRef<StoryPlayerHandle>(null);

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
    <div
      className="h-full player-bar-offset"
      data-theme="light"
      data-font-size="medium"
      style={{ height: "100vh" }}
    >
      <PlayerBar
        onBack={onBack}
        onSave={() => playerRef.current?.openSave()}
        onSettings={() => playerRef.current?.openSettings()}
      />
      <StoryPlayer
        ref={playerRef}
        manifest={manifest}
        storage={storageRef.current}
        assets={assetsRef.current}
        hideChrome
      />
    </div>
  );
}
