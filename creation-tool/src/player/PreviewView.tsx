import { useState, useEffect } from "react";
import { ContentRenderer } from "@fabler/player/ui/ContentRenderer";
import type { Page } from "@fabler/types";
import type { AssetResolver } from "@fabler/player/engine/types";
import { convertFileSrc } from "@tauri-apps/api/core";
import api from "../api";

interface PreviewViewProps {
  page: Page;
}

export function PreviewView({ page }: PreviewViewProps) {
  const [assets, setAssets] = useState<AssetResolver>({
    getAssetUrl: (p: string) => p,
  });

  useEffect(() => {
    api.getProjectAssetsDir().then((dir) => {
      setAssets({
        getAssetUrl: (filename: string) => convertFileSrc(`${dir}/${filename}`),
      });
    }).catch(() => {});
  }, []);

  return (
    <div
      className="h-full overflow-y-auto p-6"
      data-theme="light"
      data-font-size="medium"
    >
      <article className="max-w-prose mx-auto">
        <h1 className="text-xl font-bold mb-4 text-gray-900">
          {page.name}
        </h1>
        <ContentRenderer document={page.body} assets={assets} />
        {page.choices.length > 0 && (
          <nav className="mt-8 pt-4 border-t border-gray-200">
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {page.choices.map((choice) => (
                <li key={choice.id}>
                  <div className="w-full text-left p-4 rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                    {choice.text}
                  </div>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {page.choices.length === 0 && (
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-center italic text-gray-400">The End</p>
          </div>
        )}
      </article>
    </div>
  );
}
