import type { AssetResolver, Page } from "../engine/types";
import { ContentRenderer } from "./ContentRenderer";

interface PageViewProps {
  page: Page;
  assets: AssetResolver;
}

export function PageView({ page, assets }: PageViewProps) {
  return (
    <article
      className="max-w-prose mx-auto"
      aria-label={page.name}
      tabIndex={-1}
    >
      <h1
        className="text-[1.5em] font-bold mb-[1em]"
        style={{ color: "var(--player-text)" }}
      >
        {page.name}
      </h1>
      <ContentRenderer document={page.body} assets={assets} />
    </article>
  );
}
