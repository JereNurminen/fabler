import { createContext, useContext, type ReactNode } from "react";

/**
 * View state owned by StoryEditorPage and needed by both layout bars.
 *
 * Story data (title, pages, start page) is deliberately NOT here — both bars
 * already read it from atoms, so passing it as props was redundant.
 */
export interface EditorChrome {
  onPlaytest: () => void;
  onTogglePreview: () => void;
  onOpenGraph: () => void;
  showPreview: boolean;
  hasPageSelected: boolean;
}

const EditorChromeContext = createContext<EditorChrome | null>(null);

export const EditorChromeProvider = ({
  value,
  children,
}: {
  value: EditorChrome;
  children: ReactNode;
}) => (
  <EditorChromeContext.Provider value={value}>
    {children}
  </EditorChromeContext.Provider>
);

export function useEditorChrome(): EditorChrome {
  const ctx = useContext(EditorChromeContext);
  if (!ctx) {
    throw new Error("useEditorChrome must be used inside EditorChromeProvider");
  }
  return ctx;
}
