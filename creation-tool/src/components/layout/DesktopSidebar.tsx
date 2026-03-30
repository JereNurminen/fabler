import { useState } from "react";
import { Collapsible } from "../ui/Collapsible";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import {
  Cog6ToothIcon,
  FlagIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import { useTranslation } from "../../i18n";
import { save } from "@tauri-apps/plugin-dialog";
import api from "../../api";
import PageLink from "../PageLink";
import NewPageButton from "../NewPageButton";
import { FlagsDialog } from "../FlagsDialog";
import clsx from "clsx";

interface DesktopSidebarProps {
  storyId: number;
  storyTitle: string;
  pages: Array<{ id: number; name: string }>;
  startPage: number | null;
  onPlaytest?: () => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
  hasPageSelected?: boolean;
}

export const DesktopSidebar = ({
  storyId,
  storyTitle,
  pages,
  startPage,
  onPlaytest,
  onTogglePreview,
  showPreview,
  hasPageSelected,
}: DesktopSidebarProps) => {
  const [showFlags, setShowFlags] = useState(false);
  const { patchStory, flags } = useStoryAtoms();
  const { t } = useTranslation();

  const handleExportBundle = async () => {
    try {
      const filePath = await save({
        defaultPath: `${storyTitle}.fabler`,
        filters: [{ name: "Fabler Story", extensions: ["fabler"] }],
      });

      if (filePath) {
        await api.exportBundle(filePath);
        alert(t.alerts.exportSuccess);
      }
    } catch (error) {
      console.error("Failed to export bundle:", error);
      alert(t.alerts.exportFailed);
    }
  };

  const handleStartPageChange = async (newStartPage: number) => {
    try {
      await patchStory({
        id: storyId,
        start_page: newStartPage,
      });
    } catch (error) {
      console.error("Failed to update start page:", error);
      alert(t.alerts.updateSettingsFailed);
    }
  };

  return (
    <div className="hidden lg:flex flex-col w-80 h-screen bg-white border-r border-gray-200 sidebar">
      {/* Story Title Header */}
      <div className="px-4 py-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 truncate">
          {storyTitle}
        </h1>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onPlaytest}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
          >
            {t.buttons.playtest}
          </button>
          {hasPageSelected && (
            <button
              onClick={onTogglePreview}
              className={clsx(
                "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                showPreview
                  ? "text-white bg-blue-600 hover:bg-blue-700"
                  : "text-gray-700 bg-gray-100 hover:bg-gray-200",
              )}
            >
              {t.buttons.preview}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Story Settings Section */}
        <Collapsible
          title={t.headings.storySettings}
          icon={Cog6ToothIcon}
          className="story-settings-section"
        >
          <div className="px-4 py-3 space-y-3">
            <Select
              label={t.labels.startPage}
              value={startPage || ""}
              onChange={(e) => handleStartPageChange(parseInt(e.target.value))}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {t.dynamic.pageDisplay(p.name, p.id)}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              onClick={handleExportBundle}
              className="w-full"
            >
              {t.buttons.exportBundle}
            </Button>
          </div>
        </Collapsible>

        {/* Flags Section */}
        <Collapsible
          title={t.headings.flags}
          icon={FlagIcon}
          badge={flags.length}
          className="flags-section"
        >
          <div className="px-4 py-3">
            <Button
              size="sm"
              onClick={() => setShowFlags(true)}
              className="w-full mb-3"
            >
              {t.buttons.manageFlags}
            </Button>
            {flags.length > 0 && (
              <div className="space-y-1">
                {flags.slice(0, 5).map((flag) => (
                  <div key={flag.id} className="text-xs text-gray-600 truncate">
                    {flag.name} {flag.default_value ? t.badges.flagDefaultTrue : t.badges.flagDefaultFalse}
                  </div>
                ))}
                {flags.length > 5 && (
                  <button
                    className={clsx(
                      "text-xs font-medium",
                      "text-primary dark:text-blue-400",
                      "hover:underline",
                    )}
                  >
                    {t.dynamic.moreFlags(flags.length - 5)}
                  </button>
                )}
              </div>
            )}
          </div>
        </Collapsible>

        {/* Pages Section */}
        <Collapsible
          title={t.headings.pages}
          icon={DocumentTextIcon}
          defaultOpen
          badge={pages.length}
          className="pages-section"
        >
          <div className="space-y-1 p-2">
            {pages
              .sort((a, b) => a.id - b.id)
              .map((page) => (
                <PageLink key={page.id} storyId={storyId} pageId={page.id}>
                  {page.id === startPage && (
                    <span className="inline-block bg-primary text-white text-xs font-bold px-2 py-0.5 rounded mr-2">
                      {t.badges.start}
                    </span>
                  )}
                  {t.dynamic.pageDisplay(page.name, page.id)}
                </PageLink>
              ))}
          </div>
          <div className="p-2 border-t border-gray-200">
            <NewPageButton storyId={storyId} />
          </div>
        </Collapsible>
      </div>

      {showFlags && <FlagsDialog onClose={() => setShowFlags(false)} />}
    </div>
  );
};
