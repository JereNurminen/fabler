import { useCallback, useEffect, useState } from "react";
import { StoryListing } from "../bindings";
import api from "../api";
import { handleResult, Loadable } from "../utilities/loadable";
import { useTranslation } from "../i18n";
import { Link, useLocation } from "wouter";
import { getLinkToStoryPage } from "../utilities/routing";
import { NewStoryDialog } from "../components/NewStoryDialog";
import { Button } from "../components/ui/Button";

export const StartPage = () => {
  const [stories, setStories] = useState<Loadable<StoryListing[]>>({
    status: "not-loaded",
  });
  const [showNewStoryModal, setShowStoryModal] = useState(false);
  const [_, setLocation] = useLocation();
  const { t } = useTranslation();

  const loadStories = useCallback(async () => {
    setStories({ status: "loading" });
    const result = await api.getStoryList();

    if (result.status === "ok") {
      setStories({ status: "loaded", value: result });
    } else {
      // TODO: Error handling
    }
  }, []);

  useEffect(() => {
    void loadStories();
  }, []);

  const createNewStory = useCallback(async (title: string) => {
    const newStoryId = await api.createStory(title);
    await loadStories();
    return newStoryId;
  }, []);

  const content = (() => {
    switch (stories.status) {
      case "not-loaded":
      case "loading":
        return <p className="text-gray-600">{t.status.loading}</p>;
      case "loaded":
        return handleResult(
          stories.value,
          (ok) => (
            <div className="flex flex-col items-center justify-center gap-2">
              {ok.data.map((story) => (
                <Link
                  key={story.id}
                  href={getLinkToStoryPage(story.id)}
                  className="px-4 py-2 border border-gray-900 rounded hover:bg-gray-100 transition-colors min-w-64 text-center"
                >
                  {t.dynamic.storyListItem(story.id, story.title)}
                </Link>
              ))}
            </div>
          ),
          (err) => <p className="text-red-600">{t.dynamic.errorMessage(err.error)}</p>,
        );
    }
  })();

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">{t.headings.hello}</h1>
      <div className="mb-6">{content}</div>
      <div>
        <Button onClick={() => setShowStoryModal(true)}>
          {t.buttons.newStory}
        </Button>
      </div>
      {showNewStoryModal ? (
        <NewStoryDialog
          onConfirm={async (title) => {
            const result = await createNewStory(title);
            if (result.status === "ok") {
              setLocation(getLinkToStoryPage(result.data));
            }
          }}
          onCancel={() => setShowStoryModal(false)}
        />
      ) : null}
    </div>
  );
};
