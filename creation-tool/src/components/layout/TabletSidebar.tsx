import { useState } from "react";
import { IconButton } from "../ui/IconButton";
import { Cog6ToothIcon, FlagIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import { useTranslation } from "../../i18n";
import { FlagsDialog } from "../FlagsDialog";
import { StorySettingsDialog } from "../StorySettingsDialog";
import PageLink from "../PageLink";
import NewPageButton from "../NewPageButton";

interface TabletSidebarProps {
  storyId: number;
  storyTitle: string;
  pages: Array<{ id: number; name: string }>;
  startPage: number | null;
}

type Panel = "settings" | "flags" | "pages" | null;

export const TabletSidebar = ({
  storyId,
  storyTitle,
  pages,
  startPage,
}: TabletSidebarProps) => {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const { flags, patchStory } = useStoryAtoms();
  const { t } = useTranslation();

  const handleSaveSettings = async (title: string, newStartPage: number) => {
    try {
      await patchStory({
        id: storyId,
        title,
        start_page: newStartPage,
      });
      setActivePanel(null);
    } catch (error) {
      console.error("Failed to update story settings:", error);
      alert(t.alerts.updateSettingsFailed);
    }
  };

  return (
    <>
      {/* Icon Sidebar */}
      <div className="hidden sm:flex lg:hidden flex-col w-20 h-screen bg-white border-r border-gray-200 items-center py-4 gap-2">
        <IconButton
          icon={Cog6ToothIcon}
          label="Story Settings"
          onClick={() => setActivePanel(activePanel === "settings" ? null : "settings")}
        />
        <IconButton
          icon={FlagIcon}
          label="Flags"
          badge={flags.length}
          onClick={() => setActivePanel(activePanel === "flags" ? null : "flags")}
        />
        <IconButton
          icon={DocumentTextIcon}
          label="Pages"
          badge={pages.length}
          onClick={() => setActivePanel(activePanel === "pages" ? null : "pages")}
        />
      </div>

      {/* Floating Panels */}
      {activePanel === "settings" && (
        <StorySettingsDialog
          storyId={storyId}
          initialTitle={storyTitle}
          initialStartPage={startPage}
          pages={pages}
          onConfirm={handleSaveSettings}
          onCancel={() => setActivePanel(null)}
        />
      )}

      {activePanel === "flags" && (
        <FlagsDialog onClose={() => setActivePanel(null)} />
      )}

      {activePanel === "pages" && (
        <div className="fixed left-20 top-0 bottom-0 w-64 bg-white border-r border-gray-200 shadow-lg z-40 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Pages</h2>
            <div className="space-y-1">
              {pages
                .sort((a, b) => a.id - b.id)
                .map((page) => (
                  <PageLink
                    key={page.id}
                    storyId={storyId}
                    pageId={page.id}
                    onClick={() => setActivePanel(null)}
                  >
                    {page.id === startPage && (
                      <span className="inline-block bg-primary text-white text-xs font-bold px-2 py-0.5 rounded mr-2">
                        {t.badges.start}
                      </span>
                    )}
                    {t.dynamic.pageDisplay(page.name, page.id)}
                  </PageLink>
                ))}
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4">
              <NewPageButton storyId={storyId} />
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {activePanel === "pages" && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-30"
          onClick={() => setActivePanel(null)}
        />
      )}
    </>
  );
};
