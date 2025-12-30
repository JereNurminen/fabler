import React, { useEffect, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route, useLocation } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { pageRoute, storyRoute } from "./utilities/routing";
import { listen } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/plugin-dialog";
import { ThemeProvider } from "styled-components";
import { theme } from "./style";
import { Provider as JotaiProvider } from "jotai";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";

function App() {
  const [_, setLocation] = useLocation();

  useEffect(() => {
    const unlisten = listen("database-reset", async () => {
      setLocation("/");
      await message("Database reset successfully", { title: "", kind: "info" });
      window.location.reload();
    });

    // Cleanup listener when component unmounts
    return () => {
      unlisten.then((unlistenFn) => unlistenFn());
    };
  }, [setLocation]);

  return (
    <ThemeProvider theme={theme}>
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
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
