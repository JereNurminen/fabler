import type { AssetResolver } from "@fabler/player/engine/types";

export class TauriAssetResolver implements AssetResolver {
  private storyPath: string;

  constructor(storyPath: string) {
    this.storyPath = storyPath;
  }

  getAssetUrl(assetPath: string): string {
    const fullPath = `${this.storyPath}/assets/${assetPath}`;
    // Construct asset URL directly — convertFileSrc double-encodes the path
    return `asset://localhost${fullPath}`;
  }
}
