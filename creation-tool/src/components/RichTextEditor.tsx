import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";
import { documentToTipTap, tipTapToDocument } from "../editor/convert";
import type { Document } from "../types";

interface RichTextEditorProps {
  document: Document;
  onUpdate: (doc: Document) => void;
  onImageInsert?: () => Promise<string | null>;
}

export function RichTextEditor({ document, onUpdate, onImageInsert }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ],
    content: documentToTipTap(document),
    onBlur: ({ editor }) => {
      const doc = tipTapToDocument(editor.getJSON());
      onUpdate(doc);
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentJSON = JSON.stringify(editor.getJSON());
      const newJSON = JSON.stringify(documentToTipTap(document));
      if (currentJSON !== newJSON) {
        editor.commands.setContent(documentToTipTap(document));
      }
    }
  }, [document, editor]);

  if (!editor) return null;

  const handleImageInsert = async () => {
    if (!onImageInsert) return;
    const filename = await onImageInsert();
    if (filename) {
      editor.chain().focus().setImage({ src: filename, alt: "" }).run();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Blockquote"
        >
          &ldquo;
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="Horizontal rule"
        >
          ―
        </ToolbarButton>
        {onImageInsert && (
          <ToolbarButton
            active={false}
            onClick={handleImageInsert}
            label="Insert image"
          >
            🖼
          </ToolbarButton>
        )}
      </div>
      <EditorContent
        editor={editor}
        className="p-3 min-h-[200px] prose prose-sm max-w-none focus:outline-none"
      />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`px-2 py-1 rounded text-sm min-w-[32px] min-h-[32px] ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}
