import React from "react";
import ReactDOM from "react-dom/client";
import { StartPage } from "./pages/StartPage";
import { Switch, Route } from "wouter";
import StoryEditorPage from "./pages/StoryEditorPage";
import { StoryProvider } from "./StoryContext";

export const getLinkToStoryPage = (id: number) => `/story/${id}`;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StoryProvider>
      <Switch>
        <Route path='/'>
          <StartPage />
        </Route>

        <Route path='/story/:id'>
          {params => <StoryEditorPage idParam={params.id} />}
        </Route>
      </Switch>
    </StoryProvider>
  </React.StrictMode>,
);
