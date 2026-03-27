import { ReactNode } from "react";
import { DesktopSidebar } from "./DesktopSidebar";
import { TabletSidebar } from "./TabletSidebar";
import { MobileNav } from "./MobileNav";

interface MainLayoutProps {
  storyId: number;
  storyTitle: string;
  pages: Array<{ id: number; name: string }>;
  startPage: number | null;
  children: ReactNode;
  onPlaytest?: () => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
  hasPageSelected?: boolean;
}

export const MainLayout = ({
  storyId,
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
      {/* Desktop Sidebar (>= 1024px) */}
      <DesktopSidebar
        storyId={storyId}
        storyTitle={storyTitle}
        pages={pages}
        startPage={startPage}
        onPlaytest={onPlaytest}
        onTogglePreview={onTogglePreview}
        showPreview={showPreview}
        hasPageSelected={hasPageSelected}
      />

      {/* Tablet Sidebar (640px - 1024px) */}
      <TabletSidebar
        storyId={storyId}
        storyTitle={storyTitle}
        pages={pages}
        startPage={startPage}
        onPlaytest={onPlaytest}
        onTogglePreview={onTogglePreview}
        showPreview={showPreview}
        hasPageSelected={hasPageSelected}
      />

      {/* Mobile Navigation (< 640px) */}
      <MobileNav
        storyId={storyId}
        storyTitle={storyTitle}
        pages={pages}
        startPage={startPage}
        onPlaytest={onPlaytest}
        onTogglePreview={onTogglePreview}
        showPreview={showPreview}
        hasPageSelected={hasPageSelected}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto pt-14 sm:pt-0">
        {children}
      </main>
    </div>
  );
};
