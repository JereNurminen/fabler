import { useState } from "react";
import { IconButton } from "../ui/IconButton";
import { Cog6ToothIcon, FlagIcon, DocumentTextIcon, PlayIcon, EyeIcon } from "@heroicons/react/24/outline";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import { useTranslation } from "../../i18n";
import { FlagsDialog } from "../FlagsDialog";
import { StorySettingsDialog } from "../StorySettingsDialog";
import PageLink from "../PageLink";
import NewPageButton from "../NewPageButton";
import clsx from "clsx";
import api from "../../api";

interface TabletSidebarProps {
  storyTitle: string;
  pages: Array<{ id: string; name: string }>;
  startPage: string | null;
  onPlaytest?: () => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
  hasPageSelected?: boolean;
}

type Panel = "settings" | "flags" | "pages" | null;

export const TabletSidebar = ({
  storyTitle,
  pages,
  startPage,
  onPlaytest,
  onTogglePreview,
  showPreview,
  hasPageSelected,
}: TabletSidebarProps) => {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const { flags } = useStoryAtoms();
  const { t } = useTranslation();

  const handleSaveSettings = async (title: string, newStartPage: string) => {
    try {
      const currentStory = await api.getStory();
      await api.saveStory({ ...currentStory, title, start_page: newStartPage });
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
          label={t.headings.storySettings}
          onClick={() => setActivePanel(activePanel === "settings" ? null : "settings")}
        />
        <IconButton
          icon={FlagIcon}
          label={t.headings.flags}
          badge={flags.length}
          onClick={() => setActivePanel(activePanel === "flags" ? null : "flags")}
        />
        <IconButton
          icon={DocumentTextIcon}
          label={t.headings.pages}
          badge={pages.length}
          onClick={() => setActivePanel(activePanel === "pages" ? null : "pages")}
        />
        <IconButton
          icon={PlayIcon}
          label={t.buttons.playtest}
          onClick={onPlaytest}
          className="text-indigo-600 hover:bg-indigo-50"
        />
        {hasPageSelected && (
          <IconButton
            icon={EyeIcon}
            label={t.buttons.preview}
            onClick={onTogglePreview}
            className={clsx(showPreview && "bg-blue-100 text-blue-700 hover:bg-blue-100")}
          />
        )}
      </div>

      {/* Floating Panels */}
      {activePanel === "settings" && (
        <StorySettingsDialog
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
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/25 z-30"
            onClick={() => setActivePanel(null)}
          />

          {/* Pages Panel */}
          <div className="fixed left-20 top-4 bottom-4 w-80 max-w-[calc(100vw-6rem)] bg-white border border-gray-200 rounded-lg shadow-xl z-40 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">{t.headings.pages}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {pages
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map((page) => (
                    <PageLink
                      key={page.id}
                      pageId={page.id}
                      onClick={() => setActivePanel(null)}
                    >
                      {page.id === startPage && (
                        <span className="inline-block bg-primary text-white text-xs font-bold px-2 py-0.5 rounded mr-2">
                          {t.badges.start}
                        </span>
                      )}
                      {page.name || page.id}
                    </PageLink>
                  ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200">
              <NewPageButton />
            </div>
          </div>
        </>
      )}
    </>
  );
};
