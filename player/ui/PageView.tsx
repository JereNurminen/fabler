import type { AssetResolver, ManifestPage } from "../engine/types";

interface PageViewProps {
  page: ManifestPage;
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
      <div
        className="leading-relaxed whitespace-pre-wrap"
        style={{ color: "var(--player-text)" }}
      >
        {page.body}
      </div>
    </article>
  );
}
