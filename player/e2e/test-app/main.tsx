import React from "react";
import ReactDOM from "react-dom/client";
import { StoryPlayer } from "../../ui/StoryPlayer";
import { MemoryStorage } from "./memory-storage";
import type { Manifest, AssetResolver } from "../../engine/types";
import "../../ui/player.css";

const noopAssets: AssetResolver = {
  getAssetUrl: (path: string) => path,
};

const storage = new MemoryStorage();

const params = new URLSearchParams(window.location.search);
const fixtureName = params.get("fixture") || "branching";

async function loadAndRender() {
  const response = await fetch(`/${fixtureName}.json`);
  const manifest: Manifest = await response.json();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <StoryPlayer manifest={manifest} storage={storage} assets={noopAssets} />
    </React.StrictMode>,
  );
}

loadAndRender();
