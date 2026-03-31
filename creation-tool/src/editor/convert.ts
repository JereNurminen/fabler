import type { Document, Block, Inline, Mark } from "../types";

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, string>;
}

// --- Document → TipTap ---

export function documentToTipTap(doc: Document, assetsBaseUrl?: string): TipTapNode {
  return {
    type: "doc",
    content: doc.content.map((b) => blockToTipTap(b, assetsBaseUrl)),
  };
}

function blockToTipTap(block: Block, assetsBaseUrl?: string): TipTapNode {
  switch (block.type) {
    case "paragraph":
      return {
        type: "paragraph",
        ...(block.content.length > 0
          ? { content: block.content.map(inlineToTipTap) }
          : {}),
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: block.content.map((b) => blockToTipTap(b, assetsBaseUrl)),
      };
    case "image": {
      const src = assetsBaseUrl ? `${assetsBaseUrl}/${block.src}` : block.src;
      return {
        type: "image",
        attrs: { src, alt: block.alt },
      };
    }
    case "horizontal_rule":
      return { type: "horizontalRule" };
  }
}

function inlineToTipTap(inline: Inline): TipTapNode {
  const node: TipTapNode = { type: "text", text: inline.text };
  if (inline.marks.length > 0) {
    node.marks = inline.marks.map((m) => ({ type: m }));
  }
  return node;
}

// --- TipTap → Document ---

export function tipTapToDocument(tiptap: TipTapNode, assetsBaseUrl?: string): Document {
  return {
    content: (tiptap.content || []).map((n) => tipTapToBlock(n, assetsBaseUrl)),
  };
}

function tipTapToBlock(node: TipTapNode, assetsBaseUrl?: string): Block {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: (node.content || []).map(tipTapToInline),
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: (node.content || []).map((n) => tipTapToBlock(n, assetsBaseUrl)),
      };
    case "image": {
      let src = node.attrs?.src || "";
      // Strip base URL to store just the filename
      if (assetsBaseUrl && src.startsWith(assetsBaseUrl + "/")) {
        src = src.slice(assetsBaseUrl.length + 1);
      } else if (src.includes("/")) {
        // If it's a full path, extract just the filename
        src = src.split("/").pop() || src;
      }
      return {
        type: "image",
        src,
        alt: node.attrs?.alt || "",
      };
    }
    case "horizontalRule":
      return { type: "horizontal_rule" };
    default:
      return { type: "paragraph", content: [] };
  }
}

function tipTapToInline(node: TipTapNode): Inline {
  return {
    text: node.text || "",
    marks: (node.marks || []).map((m) => m.type as Mark),
  };
}
