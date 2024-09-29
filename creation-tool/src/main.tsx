import React from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { StoryProvider } from "./StoryContext";
import { pageRoute, storyRoute } from "./utilities/routing";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StoryProvider>
      <Switch>

        <Route path='/'>
          <StartPage />
        </Route>

        <Route path={pageRoute}>
          {params => <StoryEditorPage storyIdParam={params.story} pageIdParam={params.page} />}
        </Route>

        <Route path={storyRoute}>
          {params => <StoryEditorPage storyIdParam={params.story} />}
        </Route>

      </Switch>
    </StoryProvider>
  </React.StrictMode>,
);
