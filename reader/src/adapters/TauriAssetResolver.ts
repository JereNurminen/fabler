import { convertFileSrc } from "@tauri-apps/api/core";
import type { AssetResolver } from "@fabler/player/engine/types";

export class TauriAssetResolver implements AssetResolver {
  private storyPath: string;

  constructor(storyPath: string) {
    this.storyPath = storyPath;
  }

  getAssetUrl(assetPath: string): string {
    return convertFileSrc(`${this.storyPath}/assets/${assetPath}`);
  }
}
