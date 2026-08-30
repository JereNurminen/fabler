import { useState, useEffect, useCallback } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import api from "../../api";
import { Button } from "../ui/Button";
import { useTrackedAction } from "../../hooks/useTrackedAction";

interface AssetsSectionProps {
  className?: string;
}

export function AssetsSection({ className }: AssetsSectionProps) {
  const [assets, setAssets] = useState<string[]>([]);

  const refreshAssets = useCallback(async () => {
    try {
      const list = await api.listAssets();
      setAssets(list);
    } catch {
      // No project open
    }
  }, []);

  // Load, not a write: must not report into the save-status indicator.
  useEffect(() => {
    void refreshAssets().catch((error: unknown) => {
      console.error("Failed to load assets:", error);
    });
  }, [refreshAssets]);

  // Tracked action wraps only the write, so a cancelled dialog never reports
  // "saved" for a save that never happened.
  const uploadAsset = useTrackedAction(async (filePath: string) => {
    await api.copyAsset(filePath);
    await refreshAssets();
  });

  const handleUpload = () => {
    void openDialog({
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
    })
      .then((filePath) => {
        if (!filePath) return;
        uploadAsset(filePath);
      })
      .catch((error: unknown) => {
        console.error("Failed to open file dialog:", error);
      });
  };

  const handleCopyEmbed = (filename: string) => {
    // Clipboard write, not a project write: does not touch the save-status
    // indicator.
    void navigator.clipboard.writeText(`![${filename}](${filename})`).catch((error: unknown) => {
      console.error("Failed to copy embed:", error);
    });
  };

  const handleDelete = useTrackedAction(async (filename: string) => {
    await api.deleteAsset(filename);
    await refreshAssets();
  });

  return (
    <div className={className}>
      <Button size="sm" onClick={handleUpload} className="w-full mb-3">
        Upload Image
      </Button>
      {assets.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No assets yet</p>
      ) : (
        <div className="space-y-2">
          {assets.map((filename) => (
            <div key={filename} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
              <span className="truncate flex-1" title={filename}>{filename}</span>
              <button
                onClick={() => handleCopyEmbed(filename)}
                className="text-gray-500 hover:text-gray-700 shrink-0"
                title="Copy markdown embed"
              >
                Copy
              </button>
              <button
                onClick={() => handleDelete(filename)}
                className="text-gray-500 hover:text-red-600 shrink-0"
                title="Delete"
              >
                Del
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
