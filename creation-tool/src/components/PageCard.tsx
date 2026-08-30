import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { pageAtomFamily, pageListAtom } from "../atoms/storyAtoms";
import { saveStoryAtom } from "../atoms/storyActions";
import { saveStatusAtom } from "../atoms/saveStatus";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { usePageMutations } from "../hooks/usePageMutations";
import { useTranslation } from "../i18n";
import { generateId } from "../utilities/id";
import { upsertFlagRule, removeFlagRule } from "../utilities/flagRules";
import { FlagOperations } from "./FlagOperations";
import { ChoiceEditor } from "./ChoiceEditor";
import { Input } from "./ui/Input";
import { MarkdownEditor } from "./MarkdownEditor";
import { Button } from "./ui/Button";
import api from "../api";
import type { Choice } from "../types";

const PageCard = ({ pageId }: { pageId: string }) => {
  // Draft state: edits are local until blur, matching the previous behaviour.
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [assetsDir, setAssetsDir] = useState<string | null>(null);

  const page = useAtomValue(pageAtomFamily(pageId));
  const pages = useAtomValue(pageListAtom);
  const { flags, createPage, story } = useStoryAtoms();
  const saveStory = useSetAtom(saveStoryAtom);
  const setSaveStatus = useSetAtom(saveStatusAtom);
  const { updatePage, updateChoice, addChoice, removeChoice } =
    usePageMutations(page);
  const { t } = useTranslation();

  useEffect(() => {
    void api
      .getProjectAssetsDir()
      .then(setAssetsDir)
      .catch((error: unknown) => {
        console.error("Failed to resolve assets dir:", error);
      });
  }, []);

  useEffect(() => {
    if (!page) return;
    setName(page.name);
    const md = page.body.content?.[0];
    setBody(md?.type === "markdown" ? md.source : "");
    setChoices(page.choices);
  }, [page]);

  const resolveImageUrl = useCallback(
    (filename: string) => {
      if (!assetsDir) return filename;
      return convertFileSrc(`${assetsDir}/${filename}`);
    },
    [assetsDir],
  );

  const commitTitleAndBody = () => {
    if (!page) return;
    const newBody = { content: [{ type: "markdown" as const, source: body }] };
    const changed =
      name !== page.name ||
      JSON.stringify(newBody) !== JSON.stringify(page.body);
    if (changed) updatePage({ name, body: newBody });
  };

  // Not wrapped in useTrackedAction: SelectWithCreate awaits this and needs
  // the new id back, so it must stay promise-returning. It reports its own
  // failure instead of swallowing it.
  const handleCreateFlag = async (
    flagName: string,
  ): Promise<{ id: string } | null> => {
    if (!story) return null;
    const id = generateId();
    try {
      await saveStory({
        ...story,
        flags: [...story.flags, { id, name: flagName, default_value: false }],
      });
      return { id };
    } catch (error: unknown) {
      const cause = error instanceof Error ? error.message : String(error);
      setSaveStatus({ state: "failed", message: cause });
      return null;
    }
  };

  if (!page) return null;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="space-y-4">
        <Input
          label={t.labels.pageTitle}
          type="text"
          id="page-title-input"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitTitleAndBody}
          value={name}
        />

        <MarkdownEditor
          value={body}
          onChange={setBody}
          onBlur={commitTitleAndBody}
          resolveImageUrl={resolveImageUrl}
        />
      </div>

      {flags.length > 0 && (
        <div
          className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
          data-testid="page-flag-operations"
        >
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            {t.labels.whenPageShown}
          </h3>
          <FlagOperations
            operations={page.flag_operations}
            availableFlags={flags}
            onAdd={(flagId, operation) =>
              updatePage({
                flag_operations: upsertFlagRule(page.flag_operations, {
                  flag_id: flagId,
                  operation: operation as "set_true" | "set_false" | "toggle",
                }),
              })
            }
            onRemove={(flagId) =>
              updatePage({
                flag_operations: removeFlagRule(page.flag_operations, flagId),
              })
            }
            onCreateFlag={handleCreateFlag}
          />
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t.labels.choices}
        </h3>

        {choices.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-4">
            {t.emptyStates.noChoices}
          </div>
        ) : (
          <div className="space-y-4">
            {choices.map((choice) => (
              <ChoiceEditor
                key={choice.id}
                choice={choice}
                pages={pages}
                flags={flags}
                onDraftChange={(patch) =>
                  setChoices((prev) =>
                    prev.map((c) =>
                      c.id === choice.id ? { ...c, ...patch } : c,
                    ),
                  )
                }
                onCommit={(patch) => updateChoice(choice.id, patch)}
                onDelete={() => removeChoice(choice.id)}
                onCreatePage={async (pageName) => {
                  // createPage rejects on failure (unlike handleCreateFlag's
                  // saveStory, which is caught above). Report our own
                  // failure and resolve to null, matching SelectWithCreate's
                  // contract: report your own failure, resolve, never reject.
                  try {
                    const created = await createPage(pageName);
                    return created ? { id: created.id } : null;
                  } catch (error: unknown) {
                    const cause =
                      error instanceof Error ? error.message : String(error);
                    setSaveStatus({ state: "failed", message: cause });
                    return null;
                  }
                }}
                onCreateFlag={handleCreateFlag}
              />
            ))}
          </div>
        )}

        <Button
          variant="success"
          className="mt-4 w-full sm:w-auto"
          onClick={() => addChoice(pages[0]?.id ?? "")}
        >
          {t.buttons.addChoice}
        </Button>
      </div>
    </div>
  );
};

export default PageCard;
