import { useState, useEffect, useRef } from "react";
import { StoryPlayer } from "@fabler/player/ui";
import type { AssetResolver, Manifest } from "@fabler/player/engine/types";
import { convertToManifest } from "./convertToManifest";
import { MemoryStorage } from "./MemoryStorage";
import { useTranslation } from "../i18n";
import api from "../api";
import type { Page } from "../types";
import "../../../player/ui/theme.css";

const noopAssets: AssetResolver = {
  getAssetUrl: (path: string) => path,
};

interface PlaytestViewProps {
  onClose: () => void;
}

export function PlaytestView({ onClose }: PlaytestViewProps) {
  const { t } = useTranslation();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const storageRef = useRef(new MemoryStorage());

  useEffect(() => {
    async function loadStory() {
      const story = await api.getStory();
      const pageList = await api.listPages();
      const pages = await Promise.all(
        pageList.map((p) => api.getPage(p.id)),
      );
      setManifest(convertToManifest(story, pages));
    }
    loadStory();
  }, []);

  if (!manifest) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <p className="text-white">{t.status.loadingPlaytest}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b shrink-0">
        <span className="text-sm font-medium text-gray-600">
          {t.labels.playtestMode}
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
        >
          {t.buttons.closePlaytest}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <StoryPlayer
          manifest={manifest}
          storage={storageRef.current}
          assets={noopAssets}
        />
      </div>
    </div>
  );
}
