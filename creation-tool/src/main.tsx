import React, { useEffect, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route, useLocation } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { pageRoute, storyRoute } from "./utilities/routing";
import { listen } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/plugin-dialog";
import { translations } from "./i18n";
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

    // Cleanup listener when component unmounts
    return () => {
      unlisten.then((unlistenFn) => unlistenFn());
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
