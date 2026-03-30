import React, { useEffect, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route, useLocation } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { editorRoute, editorPageRoute } from "./utilities/routing";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { translations } from "./i18n";
import api from "./api";
import { Provider as JotaiProvider } from "jotai";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import "./index.css";

function App() {
  const [_, setLocation] = useLocation();

  useEffect(() => {
    // Skip Tauri event listeners when running outside Tauri (e.g. in e2e tests)
    if (!(window as any).__TAURI_INTERNALS__) return;

    const unlistenExport = listen("export-story", async () => {
      try {
        const filePath = await save({
          defaultPath: "story.fabler",
          filters: [{ name: "Fabler Story", extensions: ["fabler"] }],
        });
        if (!filePath) return;

        await api.exportBundle(filePath);
        alert(translations.alerts.exportSuccess);
      } catch (error) {
        console.error("Failed to export story:", error);
        alert(translations.alerts.exportFailed);
      }
    });

    // TODO: Import story handler needs redesign for project-based workflow
    const unlistenImport = listen("import-story", async () => {});

    // Cleanup listeners when component unmounts
    return () => {
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
            <Route path={editorPageRoute}>
              {(params) => <StoryEditorPage pageIdParam={params.pageId} />}
            </Route>
            <Route path={editorRoute}>
              <StoryEditorPage />
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
