import clsx from "clsx";
import { useLocation } from "wouter";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { SelectWithCreate } from "./ui/SelectWithCreate";
import { FlagOperations } from "./FlagOperations";
import { ChoiceConditions } from "./ChoiceConditions";
import { useTranslation } from "../i18n";
import { getLinkToPage } from "../utilities/routing";
import { upsertFlagRule, removeFlagRule } from "../utilities/flagRules";
import type { Choice, Flag, FlagOperation, PageListItem } from "@fabler/types";

interface ChoiceEditorProps {
  choice: Choice;
  pages: PageListItem[];
  flags: Flag[];
  /** Local (unsaved) text edits, mirroring the previous inline behaviour. */
  onDraftChange: (patch: Partial<Choice>) => void;
  onCommit: (patch: Partial<Choice>) => void;
  onDelete: () => void;
  onCreatePage: (name: string) => Promise<{ id: string } | null>;
  onCreateFlag: (name: string) => Promise<{ id: string } | null>;
}

export const ChoiceEditor = ({
  choice,
  pages,
  flags,
  onDraftChange,
  onCommit,
  onDelete,
  onCreatePage,
  onCreateFlag,
}: ChoiceEditorProps) => {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t.labels.choiceText}
          type="text"
          id={`choice-text-${choice.id}`}
          value={choice.text}
          onChange={(e) => onDraftChange({ text: e.target.value })}
          onBlur={() => onCommit({ text: choice.text })}
          placeholder={t.placeholders.choiceText}
        />

        <div>
          <SelectWithCreate
            label={t.labels.leadsTo}
            id={`choice-target-${choice.id}`}
            value={choice.target}
            options={pages.map((p) => ({
              id: p.id,
              label: t.dynamic.pageDisplay(p.name, p.id),
            }))}
            onChange={(target) => {
              onDraftChange({ target });
              onCommit({ target });
            }}
            onCreate={onCreatePage}
            createLabel={t.buttons.createPage}
            createPlaceholder={t.placeholders.newPageTitle}
            createPromptLabel={t.placeholders.newPageTitle}
          />
          <button
            onClick={() => setLocation(getLinkToPage(choice.target))}
            className={clsx(
              "text-sm font-medium mt-1",
              "text-primary dark:text-blue-400",
              "hover:underline",
            )}
          >
            {t.buttons.goToPage} →
          </button>
        </div>
      </div>

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
                onCommit({
                  conditions: upsertFlagRule(choice.conditions, {
                    flag_id: flagId,
                    required_value: requiredValue,
                  }),
                })
              }
              onRemove={(flagId) =>
                onCommit({ conditions: removeFlagRule(choice.conditions, flagId) })
              }
              onCreateFlag={onCreateFlag}
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
                onCommit({
                  flag_operations: upsertFlagRule(choice.flag_operations, {
                    flag_id: flagId,
                    operation: operation as FlagOperation["operation"],
                  }),
                })
              }
              onRemove={(flagId) =>
                onCommit({
                  flag_operations: removeFlagRule(choice.flag_operations, flagId),
                })
              }
            />
          </div>
        </div>
      )}

      <Button variant="danger" size="sm" className="mt-4" onClick={onDelete}>
        {t.buttons.delete}
      </Button>
    </div>
  );
};
