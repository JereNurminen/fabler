import { useState } from "react";
import { Button } from "./ui/Button";
import { useTranslation } from "../i18n";
import type { Flag, ChoiceCondition } from "../bindings";

type ChoiceConditionsProps = {
  conditions: ChoiceCondition[];
  availableFlags: Flag[];
  onAdd: (flagId: number, requiredValue: boolean) => void;
  onRemove: (flagId: number) => void;
};

export const ChoiceConditions = ({ conditions, availableFlags, onAdd, onRemove }: ChoiceConditionsProps) => {
  const { t } = useTranslation();
  const [selectedFlagId, setSelectedFlagId] = useState<number | null>(null);
  const [requiredValue, setRequiredValue] = useState<boolean>(true);

  const handleAdd = () => {
    if (selectedFlagId === null) return;
    onAdd(selectedFlagId, requiredValue);
    setSelectedFlagId(null);
  };

  // Filter out flags that already have conditions
  const usedFlagIds = new Set(conditions.map((cond) => cond.flag_id));
  const availableForAdd = availableFlags.filter((flag) => !usedFlagIds.has(flag.id));

  return (
    <div className="flex flex-col gap-2">
      {conditions.length === 0 ? (
        <div className="py-3 text-center text-gray-500 text-xs italic">
          {t.emptyStates.noConditions}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {conditions.map((cond) => {
            const flag = availableFlags.find((f) => f.id === cond.flag_id);
            return (
              <div
                key={cond.id}
                className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs"
              >
                <span className="text-gray-900">
                  <strong>{flag?.name || t.dynamic.flagFallback(cond.flag_id)}</strong>
                  {` ${t.conditions.mustBe} `}
                  <span
                    className={`font-mono text-white px-1.5 py-0.5 rounded text-xs font-medium ${
                      cond.required_value ? "bg-success" : "bg-danger"
                    }`}
                  >
                    {cond.required_value ? t.badges.true : t.badges.false}
                  </span>
                </span>
                <button
                  onClick={() => onRemove(cond.flag_id)}
                  className="text-danger text-xl w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {availableForAdd.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mt-1">
          <select
            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            value={selectedFlagId ?? ""}
            onChange={(e) => setSelectedFlagId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t.labels.flag}...</option>
            {availableForAdd.map((flag) => (
              <option key={flag.id} value={flag.id}>
                {flag.name}
              </option>
            ))}
          </select>

          <select
            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            value={requiredValue ? "true" : "false"}
            onChange={(e) => setRequiredValue(e.target.value === "true")}
          >
            <option value="true">{t.conditions.mustBeTrue}</option>
            <option value="false">{t.conditions.mustBeFalse}</option>
          </select>

          <Button
            onClick={handleAdd}
            disabled={selectedFlagId === null}
            size="sm"
            className="whitespace-nowrap"
          >
            {t.buttons.addCondition}
          </Button>
        </div>
      )}
    </div>
  );
};
