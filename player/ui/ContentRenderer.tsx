import type { AssetResolver, Block, Document, Inline } from "../engine/types";

interface ContentRendererProps {
  document: Document;
  assets: AssetResolver;
}

export function ContentRenderer({ document, assets }: ContentRendererProps) {
  return (
    <div className="leading-relaxed" style={{ color: "var(--player-text)" }}>
      {document.content.map((block, i) => (
        <BlockRenderer key={i} block={block} assets={assets} />
      ))}
    </div>
  );
}

function BlockRenderer({ block, assets }: { block: Block; assets: AssetResolver }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="mb-[1em]">
          {block.content.map((inline, i) => (
            <InlineRenderer key={i} inline={inline} />
          ))}
        </p>
      );
    case "blockquote":
      return (
        <blockquote
          className="border-l-4 pl-[1em] mb-[1em] italic"
          style={{ borderColor: "var(--player-border)", color: "var(--player-text-muted)" }}
        >
          {block.content.map((child, i) => (
            <BlockRenderer key={i} block={child} assets={assets} />
          ))}
        </blockquote>
      );
    case "image": {
      const src = assets.getAssetUrl(block.src);
      return (
        <figure className="mb-[1em]">
          <img
            src={typeof src === "string" ? src : ""}
            alt={block.alt}
            className="w-full rounded"
            loading="lazy"
          />
        </figure>
      );
    }
    case "horizontal_rule":
      return (
        <hr
          className="my-[1.5em] border-0 h-px"
          style={{ backgroundColor: "var(--player-border)" }}
        />
      );
    default:
      return null;
  }
}

function InlineRenderer({ inline }: { inline: Inline }) {
  let element: React.ReactNode = inline.text;

  for (const mark of inline.marks) {
    switch (mark) {
      case "bold":
        element = <strong>{element}</strong>;
        break;
      case "italic":
        element = <em>{element}</em>;
        break;
    }
  }

  return <>{element}</>;
}
