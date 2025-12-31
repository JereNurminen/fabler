import { useState } from "react";
import { Collapsible } from "../ui/Collapsible";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Cog6ToothIcon, FlagIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { useStoryAtoms } from "../../atoms/useStoryAtoms";
import { useTranslation } from "../../i18n";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
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
}

export const DesktopSidebar = ({
  storyId,
  storyTitle,
  pages,
  startPage,
}: DesktopSidebarProps) => {
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

  const handleExportSchema = async () => {
    try {
      const schema = await api.getTomlSchema();
      const filePath = await save({
        defaultPath: "story-schema.toml",
        filters: [{ name: "TOML", extensions: ["toml"] }],
      });

      if (filePath) {
        await writeTextFile(filePath, schema);
        alert(t.alerts.schemaExported);
      }
    } catch (error) {
      console.error("Failed to export schema:", error);
      alert(t.alerts.schemaExportFailed);
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
    <div className="hidden lg:flex flex-col w-80 h-screen bg-white border-r border-gray-200">
      {/* Story Title Header */}
      <div className="px-4 py-6 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 truncate">{storyTitle}</h1>
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Story Settings Section */}
        <Collapsible title="Story Settings" icon={Cog6ToothIcon}>
          <div className="px-4 py-3 space-y-3">
            <Select
              label="Start Page"
              value={startPage || ""}
              onChange={(e) => handleStartPageChange(parseInt(e.target.value))}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {t.dynamic.pageDisplay(p.name, p.id)}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportStory}
                className="flex-1"
              >
                Export Story
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportSchema}
                className="flex-1"
              >
                Export Schema
              </Button>
            </div>
          </div>
        </Collapsible>

        {/* Flags Section */}
        <Collapsible title="Flags" icon={FlagIcon} badge={flags.length}>
          <div className="px-4 py-3">
            <Button
              size="sm"
              onClick={() => setShowFlags(true)}
              className="w-full mb-3"
            >
              Manage Flags
            </Button>
            {flags.length > 0 && (
              <div className="space-y-1">
                {flags.slice(0, 5).map((flag) => (
                  <div key={flag.id} className="text-xs text-gray-600 truncate">
                    {flag.name} {flag.default_value ? "(true)" : "(false)"}
                  </div>
                ))}
                {flags.length > 5 && (
                  <button
                    className={clsx(
                      "text-xs font-medium",
                      "text-primary dark:text-blue-400",
                      "hover:underline"
                    )}
                  >
                    +{flags.length - 5} more...
                  </button>
                )}
              </div>
            )}
          </div>
        </Collapsible>

        {/* Pages Section */}
        <Collapsible title="Pages" icon={DocumentTextIcon} defaultOpen badge={pages.length}>
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
