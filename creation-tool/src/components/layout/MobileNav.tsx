import { useState } from "react";
import { Transition } from "@headlessui/react";
import {
  Bars3Icon,
  XMarkIcon,
  Cog6ToothIcon,
  FlagIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  PlayIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import { useTranslation } from "../../i18n";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import api from "../../api";
import PageLink from "../PageLink";
import NewPageButton from "../NewPageButton";
import { FlagsDialog } from "../FlagsDialog";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";

interface MobileNavProps {
  storyId: number;
  storyTitle: string;
  pages: Array<{ id: number; name: string }>;
  startPage: number | null;
  onPlaytest?: () => void;
  onTogglePreview?: () => void;
  showPreview?: boolean;
  hasPageSelected?: boolean;
}

export const MobileNav = ({
  storyId,
  storyTitle,
  pages,
  startPage,
  onPlaytest,
  onTogglePreview,
  showPreview,
  hasPageSelected,
}: MobileNavProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFlags, setShowFlags] = useState(false);
  const { patchStory, flags } = useStoryAtoms();
  const { t } = useTranslation();

  const handleExportStory = async () => {
    try {
      const result = await api.exportStoryToml(storyId);
      if (result.status === "ok") {
        const tomlContent = result.data;
        const filePath = await save({
          defaultPath: `${storyTitle}.toml`,
          filters: [{ name: "TOML", extensions: ["toml"] }],
        });

        if (filePath) {
          await writeTextFile(filePath, tomlContent);
          alert(t.alerts.exportSuccess);
        }
      } else {
        alert(t.alerts.exportFailed);
      }
    } catch (error) {
      console.error("Failed to export story:", error);
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
    <>
      {/* Top Bar */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 text-gray-600 hover:text-gray-900"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 truncate flex-1 mx-4">
          {storyTitle}
        </h1>
        <button
          onClick={handleExportStory}
          className="p-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowUpTrayIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Slide-out Menu */}
      <Transition
        show={menuOpen}
        enter="transition-transform duration-300"
        enterFrom="-translate-x-full"
        enterTo="translate-x-0"
        leave="transition-transform duration-300"
        leaveFrom="translate-x-0"
        leaveTo="-translate-x-full"
      >
        <div className="sm:hidden fixed top-14 left-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl z-50 overflow-y-auto">
          {/* Close Button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">{t.headings.menu}</h2>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Playtest / Preview Actions */}
          <div className="border-b border-gray-200 px-4 py-3 flex gap-2">
            <button
              onClick={() => {
                setMenuOpen(false);
                onPlaytest?.();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              {t.buttons.playtest}
            </button>
            {hasPageSelected && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePreview?.();
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${showPreview ? "text-white bg-blue-600 hover:bg-blue-700" : "text-gray-700 bg-gray-100 hover:bg-gray-200"}`}
              >
                <EyeIcon className="w-4 h-4" />
                {t.buttons.preview}
              </button>
            )}
          </div>

          {/* Story Settings Panel */}
          <div className="border-b border-gray-200">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
              <Cog6ToothIcon className="w-5 h-5 text-gray-600" />
              <h3 className="font-medium text-gray-900">{t.headings.storySettings}</h3>
            </div>
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
            </div>
          </div>

          {/* Flags Panel */}
          <div className="border-b border-gray-200">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
              <FlagIcon className="w-5 h-5 text-gray-600" />
              <h3 className="font-medium text-gray-900">{t.headings.flags}</h3>
              {flags.length > 0 && (
                <span className="ml-auto bg-primary text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {flags.length}
                </span>
              )}
            </div>
            <div className="px-4 py-3">
              <Button
                size="sm"
                onClick={() => {
                  setShowFlags(true);
                  setMenuOpen(false);
                }}
                className="w-full"
              >
                {t.buttons.manageFlags}
              </Button>
            </div>
          </div>

          {/* Pages Panel */}
          <div>
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
              <DocumentTextIcon className="w-5 h-5 text-gray-600" />
              <h3 className="font-medium text-gray-900">{t.headings.pages}</h3>
              <span className="ml-auto bg-primary text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {pages.length}
              </span>
            </div>
            <div className="px-2 py-3 space-y-1">
              {pages
                .sort((a, b) => a.id - b.id)
                .map((page) => (
                  <PageLink
                    key={page.id}
                    storyId={storyId}
                    pageId={page.id}
                    onClick={() => setMenuOpen(false)}
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
            <div className="px-2 py-3 border-t border-gray-200">
              <NewPageButton storyId={storyId} />
            </div>
          </div>
        </div>
      </Transition>

      {/* Backdrop */}
      {menuOpen && (
        <div
          className="sm:hidden fixed inset-0 bg-black bg-opacity-25 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {showFlags && <FlagsDialog onClose={() => setShowFlags(false)} />}
    </>
  );
};
