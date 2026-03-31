import type { Document, Block, Inline, Mark } from "../types";

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, string>;
}

// --- Document → TipTap ---

export function documentToTipTap(doc: Document): TipTapNode {
  return {
    type: "doc",
    content: doc.content.map(blockToTipTap),
  };
}

function blockToTipTap(block: Block): TipTapNode {
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
        content: block.content.map(blockToTipTap),
      };
    case "image":
      return {
        type: "image",
        attrs: { src: block.src, alt: block.alt },
      };
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

export function tipTapToDocument(tiptap: TipTapNode): Document {
  return {
    content: (tiptap.content || []).map(tipTapToBlock),
  };
}

function tipTapToBlock(node: TipTapNode): Block {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: (node.content || []).map(tipTapToInline),
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: (node.content || []).map(tipTapToBlock),
      };
    case "image":
      return {
        type: "image",
        src: node.attrs?.src || "",
        alt: node.attrs?.alt || "",
      };
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
