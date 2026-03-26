import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { pageAtomFamily, allPagesAtom } from "../atoms/storyAtoms";
import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { useTranslation } from "../i18n";
import type { Choice } from "../bindings";
import { useLocation } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";
import { FlagOperations } from "./FlagOperations";
import { ChoiceConditions } from "./ChoiceConditions";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import clsx from "clsx";

export default ({ pageId }: { pageId: number }) => {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [page] = useAtom(pageAtomFamily(pageId));
  const pages = useAtomValue(allPagesAtom);
  const {
    patchPage,
    createChoice,
    deleteChoice,
    patchChoice,
    flags,
    setFlagOperation,
    removeFlagOperation,
    setChoiceCondition,
    removeChoiceCondition,
  } = useStoryAtoms();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (page) {
      setName(page.name);
      setBody(page.body);
      setChoices(page.options);
    }
  }, [page]);

  const patch = useCallback(async () => {
    try {
      await patchPage({ id: pageId, name, body });
    } catch (error) {
      console.error("Failed to patch page:", error);
    }
  }, [pageId, name, body, patchPage]);

  const handleCreateChoice = async () => {
    if (!page) return;

    try {
      const defaultTargetPage = pages[0]?.id || page.id;
      const newChoiceId = await createChoice({
        pageId: page.id,
        text: "",
        targetPageId: defaultTargetPage,
      });

      setChoices([
        ...choices,
        {
          id: newChoiceId,
          page_id: page.id,
          text: "",
          target_page: defaultTargetPage,
          flag_operations: [],
          conditions: [],
        },
      ]);
    } catch (error) {
      console.error("Failed to create choice:", error);
    }
  };

  const handleDeleteChoice = async (choiceId: number) => {
    if (!page) return;

    try {
      setChoices(choices.filter((c) => c.id !== choiceId));
      await deleteChoice({ choiceId, pageId: page.id });
    } catch (error) {
      console.error("Failed to delete choice:", error);
      if (page) {
        setChoices(page.options);
      }
    }
  };

  const handlePatchChoice = async (
    choiceId: number,
    updates: { text?: string; target_page?: number }
  ) => {
    if (!page) return;

    try {
      await patchChoice({
        patch: {
          id: choiceId,
          text: updates.text !== undefined ? updates.text : null,
          target_page: updates.target_page !== undefined ? updates.target_page : null,
        },
        pageId: page.id,
      });
    } catch (error) {
      console.error("Failed to patch choice:", error);
    }
  };

  const handleAddPageFlagOperation = async (flagId: number, operation: string) => {
    if (!page) return;
    try {
      await setFlagOperation({
        op: { choice_id: null, page_id: page.id, flag_id: flagId, operation },
        pageId: page.id,
      });
    } catch (error) {
      console.error("Failed to add page flag operation:", error);
    }
  };

  const handleRemovePageFlagOperation = async (flagId: number) => {
    if (!page) return;
    try {
      await removeFlagOperation({ pageId: page.id, flagId });
    } catch (error) {
      console.error("Failed to remove page flag operation:", error);
    }
  };

  const handleAddChoiceFlagOperation = async (choiceId: number, flagId: number, operation: string) => {
    if (!page) return;
    try {
      setChoices(choices.map((c) => {
        if (c.id === choiceId) {
          return {
            ...c,
            flag_operations: [...c.flag_operations, { id: Date.now(), flag_id: flagId, operation }]
          };
        }
        return c;
      }));

      await setFlagOperation({
        op: { choice_id: choiceId, page_id: null, flag_id: flagId, operation },
        pageId: page.id,
      });
    } catch (error) {
      console.error("Failed to add choice flag operation:", error);
      if (page) setChoices(page.options);
    }
  };

  const handleRemoveChoiceFlagOperation = async (choiceId: number, flagId: number) => {
    if (!page) return;
    try {
      setChoices(choices.map((c) => {
        if (c.id === choiceId) {
          return {
            ...c,
            flag_operations: c.flag_operations.filter((op) => op.flag_id !== flagId)
          };
        }
        return c;
      }));

      await removeFlagOperation({ choiceId, pageId: page.id, flagId });
    } catch (error) {
      console.error("Failed to remove choice flag operation:", error);
      if (page) setChoices(page.options);
    }
  };

  const handleAddChoiceCondition = async (choiceId: number, flagId: number, requiredValue: boolean) => {
    if (!page) return;
    try {
      setChoices(choices.map((c) => {
        if (c.id === choiceId) {
          return {
            ...c,
            conditions: [...c.conditions, { id: Date.now(), flag_id: flagId, required_value: requiredValue }]
          };
        }
        return c;
      }));

      await setChoiceCondition({
        cond: { choice_id: choiceId, flag_id: flagId, required_value: requiredValue },
        pageId: page.id,
      });
    } catch (error) {
      console.error("Failed to add choice condition:", error);
      if (page) setChoices(page.options);
    }
  };

  const handleRemoveChoiceCondition = async (choiceId: number, flagId: number) => {
    if (!page) return;
    try {
      setChoices(choices.map((c) => {
        if (c.id === choiceId) {
          return {
            ...c,
            conditions: c.conditions.filter((cond) => cond.flag_id !== flagId)
          };
        }
        return c;
      }));

      await removeChoiceCondition({ choiceId, pageId: page.id, flagId });
    } catch (error) {
      console.error("Failed to remove choice condition:", error);
      if (page) setChoices(page.options);
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
          onBlur={patch}
          value={name}
        />

        <Textarea
          label={t.labels.pageContent}
          id="page-body-input"
          onChange={(e) => setBody(e.target.value)}
          onBlur={patch}
          value={body}
        />
      </div>

      {/* Page Flag Operations */}
      {flags.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200" data-testid="page-flag-operations">
          <h3 className="text-sm font-medium text-gray-900 mb-3">{t.labels.whenPageShown}</h3>
          <FlagOperations
            operations={page.flag_operations}
            availableFlags={flags}
            onAdd={handleAddPageFlagOperation}
            onRemove={handleRemovePageFlagOperation}
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
                    onBlur={() => handlePatchChoice(choice.id, { text: choice.text })}
                    placeholder={t.placeholders.choiceText}
                  />

                  <div>
                    <Select
                      label={t.labels.leadsTo}
                      id={`choice-target-${choice.id}`}
                      value={choice.target_page}
                      onChange={(e) => {
                        const newTarget = parseInt(e.target.value);
                        setChoices(
                          choices.map((c) =>
                            c.id === choice.id ? { ...c, target_page: newTarget } : c
                          )
                        );
                        handlePatchChoice(choice.id, { target_page: newTarget });
                      }}
                    >
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {t.dynamic.pageDisplay(p.name, p.id)}
                        </option>
                      ))}
                    </Select>
                    <button
                      onClick={() => setLocation(getLinkToPagePage(page.story_id, choice.target_page))}
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
                          handleAddChoiceCondition(choice.id, flagId, requiredValue)
                        }
                        onRemove={(flagId) => handleRemoveChoiceCondition(choice.id, flagId)}
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
                          handleAddChoiceFlagOperation(choice.id, flagId, operation)
                        }
                        onRemove={(flagId) => handleRemoveChoiceFlagOperation(choice.id, flagId)}
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
          onClick={handleCreateChoice}
        >
          {t.buttons.addChoice}
        </Button>
      </div>
    </div>
  );
};
