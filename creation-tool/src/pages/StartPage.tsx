import { useState } from "react";
import { useLocation } from "wouter";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useSetAtom } from "jotai";
import { openProjectAtom, createProjectAtom } from "../atoms/storyActions";
import { useTranslation } from "../i18n";
import { getLinkToEditor } from "../utilities/routing";

export const StartPage = () => {
  const [_, setLocation] = useLocation();
  const openProject = useSetAtom(openProjectAtom);
  const createProject = useSetAtom(createProjectAtom);
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    try {
      const filePath = await openDialog({
        filters: [{ name: "Fabler Story", extensions: ["story.json"] }],
      });
      if (!filePath) return;
      await openProject(filePath);
      setLocation(getLinkToEditor());
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const dirPath = await openDialog({
        directory: true,
        title: "Choose project location",
      });
      if (!dirPath) return;
      await createProject({ path: dirPath, title: newTitle.trim() });
      setLocation(getLinkToEditor());
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="max-w-md w-full p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Fabler
        </h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <button
            onClick={handleOpen}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            {t.buttons.openProject || "Open Project"}
          </button>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              {t.buttons.newProject || "New Project"}
            </button>
          ) : (
            <div className="p-4 border border-gray-200 rounded-lg space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.placeholders.storyTitle || "Story title"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 py-2 px-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  {t.buttons.create || "Create"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="py-2 px-3 text-gray-600 hover:text-gray-800"
                >
                  {t.buttons.cancel || "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
