import React, { useEffect, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route, useLocation } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { editorRoute, editorPageRoute } from "./utilities/routing";
import { listen } from "@tauri-apps/api/event";
import { Provider as JotaiProvider } from "jotai";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ExportBlockedDialog } from "./components/ExportBlockedDialog";
import LoadingSpinner from "./components/LoadingSpinner";
import { useExportStory } from "./hooks/useExportStory";
import "./index.css";

function App() {
  const [, setLocation] = useLocation();
  const { exportStory, blockedProblems, dismissBlocked } = useExportStory();

  useEffect(() => {
    // Skip Tauri event listeners when running outside Tauri (e.g. in e2e tests)
    if (!window.__TAURI_INTERNALS__) return;

    const unlistenExport = listen("export-story", () => void exportStory());

    // TODO: Import story handler needs redesign for project-based workflow
    const unlistenImport = listen("import-story", async () => {});

    // Cleanup listeners when component unmounts
    return () => {
      unlistenExport.then((unlistenFn) => unlistenFn());
      unlistenImport.then((unlistenFn) => unlistenFn());
    };
  }, [setLocation, exportStory]);

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
        {blockedProblems && (
          <ExportBlockedDialog problems={blockedProblems} onClose={dismissBlocked} />
        )}
      </ErrorBoundary>
    </JotaiProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
