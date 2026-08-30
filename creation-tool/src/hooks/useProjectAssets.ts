import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { AssetResolver } from "@fabler/player/engine/types";
import api from "../api";

const identityResolver: AssetResolver = { getAssetUrl: (path: string) => path };

/**
 * An `AssetResolver` that maps a page's asset filenames onto the open
 * project's `assets/` directory.
 *
 * Shared by every editor-side use of `ContentRenderer` (the preview panel and
 * the read-only trashed-page view) so an image renders the same way wherever
 * the author looks at it. Falls back to the raw path until the directory is
 * known, and stays there if the lookup fails — a missing image is a better
 * outcome than a blank panel.
 */
export function useProjectAssets(): AssetResolver {
  const [assets, setAssets] = useState<AssetResolver>(identityResolver);

  useEffect(() => {
    let cancelled = false;
    api
      .getProjectAssetsDir()
      .then((dir) => {
        if (cancelled || !dir) return;
        setAssets({
          getAssetUrl: (filename: string) => convertFileSrc(`${dir}/${filename}`),
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to resolve the project's assets directory:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return assets;
}
