import { useState } from "react";
import { Button } from "./ui/Button";
import { SelectWithCreate } from "./ui/SelectWithCreate";
import { useTranslation } from "../i18n";
import type { Flag } from "../types";

export interface FlagRule<V extends string> {
  flag_id: string;
  value: V;
}

export interface FlagRuleValueOption<V extends string> {
  value: V;
  /** Shown in the add-dropdown. */
  label: string;
  /** Shown in the rule row's chip. Defaults to `label` when absent. */
  badgeLabel?: string;
  /** Visual treatment of the rule row's chip. Defaults to "neutral". */
  tone?: "neutral" | "positive" | "negative";
}

interface FlagRuleListProps<V extends string> {
  rules: Array<FlagRule<V>>;
  availableFlags: Flag[];
  /** The value set this list edits — three for operations, two for conditions. */
  valueOptions: Array<FlagRuleValueOption<V>>;
  onAdd: (flagId: string, value: V) => void;
  onRemove: (flagId: string) => void;
  onCreateFlag?: (name: string) => Promise<{ id: string } | null>;
  addLabel: string;
  valueLabel: string;
  /** Text rendered between the flag name and its value chip. */
  connector: string;
}

const toneClasses: Record<NonNullable<FlagRuleValueOption<string>["tone"]>, string> = {
  neutral: "font-mono bg-gray-200 text-gray-900 px-1.5 py-0.5 rounded text-xs",
  positive: "font-mono bg-success text-white px-1.5 py-0.5 rounded text-xs font-medium",
  negative: "font-mono bg-danger text-white px-1.5 py-0.5 rounded text-xs font-medium",
};

/**
 * "Pick a flag, pick a value" — shared by the page/choice flag-operation
 * editors and the choice-condition editor. The two callers differ only in
 * their stored shape and their value set (including how that value is
 * presented — connector text, chip wording, chip color), so all of that is
 * passed in as data rather than the component branching on which caller it
 * is serving.
 */
export function FlagRuleList<V extends string>({
  rules,
  availableFlags,
  valueOptions,
  onAdd,
  onRemove,
  onCreateFlag,
  addLabel,
  valueLabel,
  connector,
}: FlagRuleListProps<V>) {
  const { t } = useTranslation();
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [selectedValue, setSelectedValue] = useState<V>(valueOptions[0].value);

  const usedFlagIds = new Set(rules.map((r) => r.flag_id));
  const availableForAdd = availableFlags.filter((f) => !usedFlagIds.has(f.id));

  const handleAdd = () => {
    if (!selectedFlagId) return;
    onAdd(selectedFlagId, selectedValue);
    setSelectedFlagId("");
  };

  const selectClass =
    "flex-1 px-2.5 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

  return (
    <div className="flex flex-col gap-2">
      {rules.length === 0 ? (
        <div
          className="py-3 text-center text-gray-500 text-xs italic"
          data-testid="flag-rules-empty"
        >
          {t.emptyStates.noFlagRules}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rules.map((rule) => {
            const flag = availableFlags.find((f) => f.id === rule.flag_id);
            const option = valueOptions.find((o) => o.value === rule.value);
            const badgeText = option?.badgeLabel ?? option?.label ?? rule.value;
            const tone = option?.tone ?? "neutral";
            return (
              <div
                key={rule.flag_id}
                data-testid={`flag-rule-${rule.flag_id}`}
                className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs"
              >
                <span className="text-gray-900">
                  <strong>{flag?.name ?? t.dynamic.flagFallback(rule.flag_id)}</strong>
                  {connector}
                  <span className={toneClasses[tone]}>{badgeText}</span>
                </span>
                <button
                  onClick={() => onRemove(rule.flag_id)}
                  data-testid={`flag-rule-remove-${rule.flag_id}`}
                  aria-label={`Remove ${flag?.name ?? rule.flag_id}`}
                  className="text-danger text-xl w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end mt-1">
        {onCreateFlag ? (
          <div className="flex-1">
            <SelectWithCreate
              label=""
              value={selectedFlagId}
              options={availableForAdd.map((f) => ({ id: f.id, label: f.name }))}
              onChange={setSelectedFlagId}
              onCreate={onCreateFlag}
              createLabel={t.buttons.addFlag}
              createPlaceholder={t.placeholders.flagName}
              createPromptLabel={t.placeholders.flagName}
              placeholder={`${t.labels.flag}...`}
            />
          </div>
        ) : (
          <select
            aria-label={t.labels.flag}
            data-testid="flag-rule-add-flag"
            className={selectClass}
            value={selectedFlagId}
            onChange={(e) => setSelectedFlagId(e.target.value)}
          >
            <option value="">{t.labels.flag}...</option>
            {availableForAdd.map((flag) => (
              <option key={flag.id} value={flag.id}>
                {flag.name}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label={valueLabel}
          data-testid="flag-rule-add-value"
          className={selectClass}
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value as V)}
        >
          {valueOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <Button
          onClick={handleAdd}
          disabled={!selectedFlagId}
          size="sm"
          data-testid="flag-rule-add"
          className="whitespace-nowrap"
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
