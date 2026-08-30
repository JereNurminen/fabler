import { useState } from "react";
import { Collapsible } from "../ui/Collapsible";
import {
  Cog6ToothIcon,
  FlagIcon,
  DocumentTextIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import { useTranslation } from "../../i18n";
import { FlagsDialog } from "../FlagsDialog";
import { StorySettingsSection } from "./StorySettingsSection";
import { FlagsSection } from "./FlagsSection";
import { PagesSection } from "./PagesSection";
import { AssetsSection } from "./AssetsSection";
import { ProblemsSection } from "./ProblemsSection";
import clsx from "clsx";

interface SidebarProps {
  storyTitle: string;
  pages: Array<{ id: string; name: string }>;
  startPage: string | null;
  onPlaytest?: () => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
  hasPageSelected?: boolean;
}

export const Sidebar = ({
  storyTitle,
  pages,
  startPage,
  onPlaytest,
  onTogglePreview,
  showPreview,
  hasPageSelected,
}: SidebarProps) => {
  const [showFlags, setShowFlags] = useState(false);
  const { flags, problems } = useStoryAtoms();
  const { t } = useTranslation();

  return (
    <div className="layout-sidebar flex-col w-80 h-screen bg-white border-r border-gray-200 sidebar">
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
          <StorySettingsSection
            storyTitle={storyTitle}
            pages={pages}
            startPage={startPage}
          />
        </Collapsible>

        {/* Flags Section */}
        <Collapsible
          title={t.headings.flags}
          icon={FlagIcon}
          badge={flags.length}
          className="flags-section"
        >
          <FlagsSection onManageFlags={() => setShowFlags(true)} />
        </Collapsible>

        {/* Problems Section */}
        <Collapsible
          title={t.problems.title}
          icon={ExclamationTriangleIcon}
          badge={problems.length || undefined}
          className="problems-section"
        >
          <ProblemsSection />
        </Collapsible>

        {/* Assets Section */}
        <Collapsible
          title={t.headings.assets}
          icon={PhotoIcon}
          className="assets-section"
        >
          <AssetsSection />
        </Collapsible>

        {/* Pages Section */}
        <Collapsible
          title={t.headings.pages}
          icon={DocumentTextIcon}
          defaultOpen
          badge={pages.length}
          className="pages-section"
        >
          <PagesSection pages={pages} startPage={startPage} />
        </Collapsible>
      </div>

      {showFlags && <FlagsDialog onClose={() => setShowFlags(false)} />}
    </div>
  );
};
