import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route, useLocation } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { StoryProvider } from "./StoryContext";
import { pageRoute, storyRoute } from "./utilities/routing";
import { listen } from "@tauri-apps/api/event";

function App() {
  const [_, setLocation] = useLocation();

  useEffect(() => {
    const unlisten = listen("database-reset", () => {
      console.debug("database reset");
      setLocation("/");
    });

    // Cleanup listener when component unmounts
    return () => {
      unlisten.then((unlistenFn) => unlistenFn());
    };
  }, [setLocation]);

  return (
    <StoryProvider>
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
    </StoryProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
