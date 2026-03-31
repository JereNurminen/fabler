import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomBar } from "./BottomBar";

interface MainLayoutProps {
  storyTitle: string;
  pages: Array<{ id: string; name: string }>;
  startPage: string | null;
  children: ReactNode;
  onPlaytest?: () => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
  hasPageSelected?: boolean;
}

export const MainLayout = ({
  storyTitle,
  pages,
  startPage,
  children,
  onPlaytest,
  onTogglePreview,
  showPreview,
  hasPageSelected,
}: MainLayoutProps) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Landscape: Sidebar */}
      <Sidebar
        storyTitle={storyTitle}
        pages={pages}
        startPage={startPage}
        onPlaytest={onPlaytest}
        onTogglePreview={onTogglePreview}
        showPreview={showPreview}
        hasPageSelected={hasPageSelected}
      />

      {/* Portrait: Bottom Bar */}
      <BottomBar
        storyTitle={storyTitle}
        pages={pages}
        startPage={startPage}
        onPlaytest={onPlaytest}
        onTogglePreview={onTogglePreview}
        showPreview={showPreview}
        hasPageSelected={hasPageSelected}
      />

      {/* Main Content Area */}
      <main className="layout-main flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};
