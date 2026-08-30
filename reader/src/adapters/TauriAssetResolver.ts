import { invoke } from "@tauri-apps/api/core";
import type { AssetResolver } from "@fabler/player/engine/types";

export class TauriAssetResolver implements AssetResolver {
  private storyId: string;
  private cache: Record<string, string> = {};

  constructor(storyId: string) {
    this.storyId = storyId;
  }

  getAssetUrl(assetPath: string): string {
    if (this.cache[assetPath]) return this.cache[assetPath];

    // Load async, cache for next render
    invoke<string>("read_asset_base64", {
      storyId: this.storyId,
      filename: assetPath,
    }).then((dataUrl) => {
      this.cache[assetPath] = dataUrl;
    }).catch(() => {});

    return ""; // Empty while loading
  }
}
