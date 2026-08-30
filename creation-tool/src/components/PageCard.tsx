import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { pageAtomFamily, pageListAtom } from "../atoms/storyAtoms";
import { savePageAtom } from "../atoms/storyActions";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { useTranslation } from "../i18n";
import type { Choice } from "../types";
import { generateId } from "../utilities/id";
import { useLocation } from "wouter";
import { getLinkToPage } from "../utilities/routing";
import { FlagOperations } from "./FlagOperations";
import { ChoiceConditions } from "./ChoiceConditions";
import { Input } from "./ui/Input";
import { MarkdownEditor } from "./MarkdownEditor";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import clsx from "clsx";
import { convertFileSrc } from "@tauri-apps/api/core";
import api from "../api";

export default ({ pageId }: { pageId: string }) => {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [assetsDir, setAssetsDir] = useState<string | null>(null);
  const page = useAtomValue(pageAtomFamily(pageId));
  const pages = useAtomValue(pageListAtom);
  const savePage = useSetAtom(savePageAtom);
  const { flags } = useStoryAtoms();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  useEffect(() => {
    api.getProjectAssetsDir().then(setAssetsDir).catch(() => {});
  }, []);

  useEffect(() => {
    if (page) {
      setName(page.name);
      const md = page.body.content?.[0];
      setBody(md?.type === "markdown" ? md.source : "");
      setChoices(page.choices);
    }
  }, [page]);

  const resolveImageUrl = useCallback((filename: string) => {
    if (!assetsDir) return filename;
    return convertFileSrc(`${assetsDir}/${filename}`);
  }, [assetsDir]);

  const handleSave = useCallback(async () => {
    if (!page) return;
    const newBody = { content: [{ type: "markdown" as const, source: body }] };
    if (name !== page.name || JSON.stringify(newBody) !== JSON.stringify(page.body)) {
      try {
        await savePage({ ...page, name, body: newBody });
      } catch (error) {
        console.error("Failed to save page:", error);
      }
    }
  }, [page, name, body, savePage]);

  const handleAddChoice = async () => {
    if (!page) return;

    try {
      const updatedPage = {
        ...page,
        choices: [
          ...page.choices,
          {
            id: generateId(),
            text: "",
            target: pages[0]?.id ?? "",
            flag_operations: [],
            conditions: [],
          },
        ],
      };
      await savePage(updatedPage);
    } catch (error) {
      console.error("Failed to add choice:", error);
    }
  };

  const handleDeleteChoice = async (choiceId: string) => {
    if (!page) return;

    try {
      await savePage({
        ...page,
        choices: page.choices.filter((c) => c.id !== choiceId),
      });
    } catch (error) {
      console.error("Failed to delete choice:", error);
    }
  };

  const handleChoiceTextSave = async (choiceId: string, text: string) => {
    if (!page) return;

    try {
      await savePage({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId ? { ...c, text } : c
        ),
      });
    } catch (error) {
      console.error("Failed to save choice text:", error);
    }
  };

  const handleChoiceTargetChange = async (choiceId: string, target: string) => {
    if (!page) return;

    try {
      await savePage({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId ? { ...c, target } : c
        ),
      });
    } catch (error) {
      console.error("Failed to save choice target:", error);
    }
  };

  const handleSetPageFlagOp = async (flagId: string, operation: string) => {
    if (!page) return;
    try {
      await savePage({
        ...page,
        flag_operations: [
          ...page.flag_operations.filter((op) => op.flag_id !== flagId),
          { flag_id: flagId, operation: operation as "set_true" | "set_false" | "toggle" },
        ],
      });
    } catch (error) {
      console.error("Failed to add page flag operation:", error);
    }
  };

  const handleRemovePageFlagOp = async (flagId: string) => {
    if (!page) return;
    try {
      await savePage({
        ...page,
        flag_operations: page.flag_operations.filter((op) => op.flag_id !== flagId),
      });
    } catch (error) {
      console.error("Failed to remove page flag operation:", error);
    }
  };

  const handleSetChoiceFlagOp = async (choiceId: string, flagId: string, operation: string) => {
    if (!page) return;
    try {
      await savePage({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId
            ? {
                ...c,
                flag_operations: [
                  ...c.flag_operations.filter((op) => op.flag_id !== flagId),
                  { flag_id: flagId, operation: operation as "set_true" | "set_false" | "toggle" },
                ],
              }
            : c
        ),
      });
    } catch (error) {
      console.error("Failed to add choice flag operation:", error);
    }
  };

  const handleRemoveChoiceFlagOp = async (choiceId: string, flagId: string) => {
    if (!page) return;
    try {
      await savePage({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId
            ? { ...c, flag_operations: c.flag_operations.filter((op) => op.flag_id !== flagId) }
            : c
        ),
      });
    } catch (error) {
      console.error("Failed to remove choice flag operation:", error);
    }
  };

  const handleSetCondition = async (choiceId: string, flagId: string, requiredValue: boolean) => {
    if (!page) return;
    try {
      await savePage({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId
            ? {
                ...c,
                conditions: [
                  ...c.conditions.filter((cond) => cond.flag_id !== flagId),
                  { flag_id: flagId, required_value: requiredValue },
                ],
              }
            : c
        ),
      });
    } catch (error) {
      console.error("Failed to add choice condition:", error);
    }
  };

  const handleRemoveCondition = async (choiceId: string, flagId: string) => {
    if (!page) return;
    try {
      await savePage({
        ...page,
        choices: page.choices.map((c) =>
          c.id === choiceId
            ? { ...c, conditions: c.conditions.filter((cond) => cond.flag_id !== flagId) }
            : c
        ),
      });
    } catch (error) {
      console.error("Failed to remove choice condition:", error);
    }
  };

  if (!page) return null;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      {/* Page Title and Content */}
      <div className="space-y-4">
        <Input
          label={t.labels.pageTitle}
          type="text"
          id="page-title-input"
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          value={name}
        />

        <MarkdownEditor
          value={body}
          onChange={setBody}
          onBlur={handleSave}
          resolveImageUrl={resolveImageUrl}
        />
      </div>

      {/* Page Flag Operations */}
      {flags.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200" data-testid="page-flag-operations">
          <h3 className="text-sm font-medium text-gray-900 mb-3">{t.labels.whenPageShown}</h3>
          <FlagOperations
            operations={page.flag_operations}
            availableFlags={flags}
            onAdd={handleSetPageFlagOp}
            onRemove={handleRemovePageFlagOp}
          />
        </div>
      )}

      {/* Choices Section */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t.labels.choices}</h3>

        {choices.length === 0 ? (
          <div className="text-sm text-gray-500 italic py-4">{t.emptyStates.noChoices}</div>
        ) : (
          <div className="space-y-4">
            {choices.map((choice) => (
              <div
                key={choice.id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                {/* Choice Text and Target - Grid on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t.labels.choiceText}
                    type="text"
                    id={`choice-text-${choice.id}`}
                    value={choice.text}
                    onChange={(e) => {
                      setChoices(
                        choices.map((c) =>
                          c.id === choice.id ? { ...c, text: e.target.value } : c
                        )
                      );
                    }}
                    onBlur={() => handleChoiceTextSave(choice.id, choice.text)}
                    placeholder={t.placeholders.choiceText}
                  />

                  <div>
                    <Select
                      label={t.labels.leadsTo}
                      id={`choice-target-${choice.id}`}
                      value={choice.target}
                      onChange={(e) => {
                        const newTarget = e.target.value;
                        setChoices(
                          choices.map((c) =>
                            c.id === choice.id ? { ...c, target: newTarget } : c
                          )
                        );
                        handleChoiceTargetChange(choice.id, newTarget);
                      }}
                    >
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {t.dynamic.pageDisplay(p.name, p.id)}
                        </option>
                      ))}
                    </Select>
                    <button
                      onClick={() => setLocation(getLinkToPage(choice.target))}
                      className={clsx(
                        "text-sm font-medium mt-1",
                        "text-primary dark:text-blue-400",
                        "hover:underline"
                      )}
                    >
                      {t.buttons.goToPage} →
                    </button>
                  </div>
                </div>

                {/* Flag UI - Two columns on desktop */}
                {flags.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div className="p-3 bg-white rounded border border-gray-200">
                      <h4 className="text-xs font-medium text-gray-600 mb-2">
                        {t.labels.showChoiceIf}
                      </h4>
                      <ChoiceConditions
                        conditions={choice.conditions}
                        availableFlags={flags}
                        onAdd={(flagId, requiredValue) =>
                          handleSetCondition(choice.id, flagId, requiredValue)
                        }
                        onRemove={(flagId) => handleRemoveCondition(choice.id, flagId)}
                      />
                    </div>

                    <div className="p-3 bg-white rounded border border-gray-200">
                      <h4 className="text-xs font-medium text-gray-600 mb-2">
                        {t.labels.whenSelected}
                      </h4>
                      <FlagOperations
                        operations={choice.flag_operations}
                        availableFlags={flags}
                        onAdd={(flagId, operation) =>
                          handleSetChoiceFlagOp(choice.id, flagId, operation)
                        }
                        onRemove={(flagId) => handleRemoveChoiceFlagOp(choice.id, flagId)}
                      />
                    </div>
                  </div>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  className="mt-4"
                  onClick={() => handleDeleteChoice(choice.id)}
                >
                  {t.buttons.delete}
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="success"
          className="mt-4 w-full sm:w-auto"
          onClick={handleAddChoice}
        >
          {t.buttons.addChoice}
        </Button>
      </div>
    </div>
  );
};
