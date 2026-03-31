import { describe, it, expect } from "vitest";
import { documentToTipTap, tipTapToDocument } from "../convert";
import type { Document } from "../../types";

describe("documentToTipTap", () => {
  it("converts a paragraph with formatted text", () => {
    const doc: Document = {
      content: [{
        type: "paragraph",
        content: [
          { text: "Hello ", marks: [] },
          { text: "world", marks: ["bold", "italic"] },
        ],
      }],
    };
    const result = documentToTipTap(doc);
    expect(result.type).toBe("doc");
    expect(result.content![0].type).toBe("paragraph");
    expect(result.content![0].content![0]).toEqual({ type: "text", text: "Hello " });
    expect(result.content![0].content![1]).toEqual({
      type: "text",
      text: "world",
      marks: [{ type: "bold" }, { type: "italic" }],
    });
  });

  it("converts an image", () => {
    const doc: Document = {
      content: [{ type: "image", src: "hero.png", alt: "Hero" }],
    };
    const result = documentToTipTap(doc);
    expect(result.content![0].type).toBe("image");
    expect(result.content![0].attrs).toEqual({ src: "hero.png", alt: "Hero" });
  });

  it("converts a horizontal rule", () => {
    const doc: Document = { content: [{ type: "horizontal_rule" }] };
    const result = documentToTipTap(doc);
    expect(result.content![0].type).toBe("horizontalRule");
  });

  it("converts a blockquote", () => {
    const doc: Document = {
      content: [{
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ text: "Quote", marks: [] }] }],
      }],
    };
    const result = documentToTipTap(doc);
    expect(result.content![0].type).toBe("blockquote");
    expect(result.content![0].content![0].type).toBe("paragraph");
  });

  it("converts empty paragraph without content key", () => {
    const doc: Document = { content: [{ type: "paragraph", content: [] }] };
    const result = documentToTipTap(doc);
    expect(result.content![0].type).toBe("paragraph");
    expect(result.content![0].content).toBeUndefined();
  });
});

describe("tipTapToDocument", () => {
  it("converts a paragraph with marks", () => {
    const tiptap = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
        ],
      }],
    };
    const doc = tipTapToDocument(tiptap);
    expect(doc.content[0].type).toBe("paragraph");
    if (doc.content[0].type === "paragraph") {
      expect(doc.content[0].content[0]).toEqual({ text: "Hello ", marks: [] });
      expect(doc.content[0].content[1]).toEqual({ text: "bold", marks: ["bold"] });
    }
  });

  it("converts horizontalRule to horizontal_rule", () => {
    const tiptap = { type: "doc", content: [{ type: "horizontalRule" }] };
    const doc = tipTapToDocument(tiptap);
    expect(doc.content[0].type).toBe("horizontal_rule");
  });

  it("converts image with attrs", () => {
    const tiptap = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "cave.png", alt: "Cave" } }],
    };
    const doc = tipTapToDocument(tiptap);
    expect(doc.content[0]).toEqual({ type: "image", src: "cave.png", alt: "Cave" });
  });

  it("round-trips through both conversions", () => {
    const original: Document = {
      content: [
        { type: "paragraph", content: [
          { text: "Normal ", marks: [] },
          { text: "bold", marks: ["bold"] },
        ]},
        { type: "horizontal_rule" },
        { type: "image", src: "test.png", alt: "Test" },
        { type: "blockquote", content: [
          { type: "paragraph", content: [{ text: "Quoted", marks: ["italic"] }] },
        ]},
      ],
    };
    const result = tipTapToDocument(documentToTipTap(original));
    expect(result).toEqual(original);
  });
});
