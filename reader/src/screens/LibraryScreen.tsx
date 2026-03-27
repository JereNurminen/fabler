import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import type { InstalledStory } from "../types";

interface LibraryScreenProps {
  onPlay: (story: InstalledStory) => void;
}

export function LibraryScreen({ onPlay }: LibraryScreenProps) {
  const [stories, setStories] = useState<InstalledStory[]>([]);

  const refreshStories = useCallback(async () => {
    const list = await invoke<InstalledStory[]>("list_stories");
    setStories(list);
  }, []);

  useEffect(() => {
    refreshStories();
  }, [refreshStories]);

  const handleImport = async () => {
    const filePath = await open({
      filters: [{ name: "Fabler Story", extensions: ["fabler"] }],
    });
    if (!filePath) return;

    const data = await readFile(filePath);
    await invoke("install_bundle", { bundleData: Array.from(data) });
    refreshStories();
  };

  const handleDelete = async (storyId: string) => {
    await invoke("delete_story", { storyId });
    refreshStories();
  };

  return (
    <div
      className="h-full flex flex-col"
      data-theme="light"
      data-font-size="medium"
      style={{ backgroundColor: "var(--player-bg)" }}
    >
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          backgroundColor: "var(--player-surface)",
          borderBottom: "1px solid var(--player-border)",
        }}
      >
        <h1
          className="text-lg font-bold"
          style={{ color: "var(--player-text)" }}
        >
          Fabler Reader
        </h1>
        <button
          onClick={handleImport}
          className="px-4 py-2 rounded-lg font-medium min-h-[44px] cursor-pointer"
          style={{
            backgroundColor: "var(--player-accent)",
            color: "var(--player-accent-text)",
          }}
        >
          Open Story
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {stories.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p
              className="text-center italic"
              style={{ color: "var(--player-text-muted)" }}
            >
              No stories installed. Tap "Open Story" to add one.
            </p>
          </div>
        ) : (
          <ul className="list-none p-0 m-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stories.map((story) => (
              <li key={story.id}>
                <button
                  onClick={() => onPlay(story)}
                  className="w-full text-left p-4 rounded-xl border min-h-[80px] cursor-pointer transition-colors duration-150"
                  style={{
                    backgroundColor: "var(--player-choice-bg)",
                    borderColor: "var(--player-choice-border)",
                    color: "var(--player-choice-text)",
                  }}
                >
                  <div className="font-semibold text-lg">{story.title}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
