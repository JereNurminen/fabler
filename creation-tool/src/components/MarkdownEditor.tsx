import { useState, useMemo } from "react";
import { marked } from "marked";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  resolveImageUrl?: (filename: string) => string;
}

export function MarkdownEditor({ value, onChange, onBlur, resolveImageUrl }: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(true);

  const renderedHtml = useMemo(() => {
    let html = marked.parse(value, { async: false }) as string;
    if (resolveImageUrl) {
      html = html.replace(
        /<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/g,
        (match, before, src, after) => {
          if (!src.includes("://") && !src.startsWith("/")) {
            return `<img ${before}src="${resolveImageUrl(src)}"${after}>`;
          }
          return match;
        }
      );
    }
    return html;
  }, [value, resolveImageUrl]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500 font-medium">Markdown</span>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
      </div>
      <div className={showPreview ? "flex divide-x divide-gray-200" : ""}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="flex-1 p-3 min-h-[200px] resize-y font-mono text-sm border-0 focus:outline-none"
          style={{ width: showPreview ? "50%" : "100%" }}
          placeholder="Write your page content in Markdown..."
        />
        {showPreview && (
          <div
            className="flex-1 p-3 min-h-[200px] overflow-y-auto prose prose-sm max-w-none"
            style={{ width: "50%" }}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </div>
    </div>
  );
}
