import React, { useEffect, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route, useLocation } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { pageRoute, storyRoute } from "./utilities/routing";
import { listen } from "@tauri-apps/api/event";
import { message, open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { translations } from "./i18n";
import api from "./api";
import { getLinkToStoryPage } from "./utilities/routing";
import { Provider as JotaiProvider } from "jotai";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import "./index.css";

function App() {
  const [_, setLocation] = useLocation();

  useEffect(() => {
    const unlisten = listen("database-reset", async () => {
      setLocation("/");
      await message(translations.status.databaseReset, { title: "", kind: "info" });
      window.location.reload();
    });

    const unlistenExport = listen("export-story", async () => {
      const match = window.location.pathname.match(/\/story\/(\d+)/);
      if (!match) return;
      const storyId = parseInt(match[1]);

      try {
        const result = await api.exportStoryToml(storyId);
        if (result.status !== "ok") {
          alert(translations.alerts.exportFailed);
          return;
        }

        const filePath = await save({
          defaultPath: `story-${storyId}.toml`,
          filters: [{ name: "TOML", extensions: ["toml"] }],
        });
        if (!filePath) return;

        await writeTextFile(filePath, result.data);
        alert(translations.alerts.exportSuccess);
      } catch (error) {
        console.error("Failed to export story:", error);
        alert(translations.alerts.exportFailed);
      }
    });

    const unlistenImport = listen("import-story", async () => {
      try {
        const filePath = await open({
          filters: [{ name: "TOML", extensions: ["toml"] }],
        });
        if (!filePath) return;

        const tomlContent = await readTextFile(filePath);
        const result = await api.importStoryToml(tomlContent);
        if (result.status === "ok") {
          setLocation(getLinkToStoryPage(result.data));
        } else {
          alert(translations.alerts.importFailed);
        }
      } catch (error) {
        console.error("Failed to import story:", error);
        alert(translations.alerts.importFailed);
      }
    });

    // Cleanup listeners when component unmounts
    return () => {
      unlisten.then((unlistenFn) => unlistenFn());
      unlistenExport.then((unlistenFn) => unlistenFn());
      unlistenImport.then((unlistenFn) => unlistenFn());
    };
  }, [setLocation]);

  return (
    <JotaiProvider>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <Switch>
            <Route path="/">
              <StartPage />
            </Route>

            <Route path={pageRoute}>
              {(params) => (
                <StoryEditorPage
                  storyIdParam={params.story}
                  pageIdParam={params.page}
                />
              )}
            </Route>

            <Route path={storyRoute}>
              {(params) => <StoryEditorPage storyIdParam={params.story} />}
            </Route>
          </Switch>
        </Suspense>
      </ErrorBoundary>
    </JotaiProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
