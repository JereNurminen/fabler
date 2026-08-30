import { FlagRuleList } from "./FlagRuleList";
import { useTranslation } from "../i18n";
import type { Flag, Condition } from "../types";

type ChoiceConditionsProps = {
  conditions: Condition[];
  availableFlags: Flag[];
  onAdd: (flagId: string, requiredValue: boolean) => void;
  onRemove: (flagId: string) => void;
  onCreateFlag?: (name: string) => Promise<{ id: string } | null>;
};

/**
 * Adapter: stored as `{flag_id, required_value: boolean}`, edited as
 * `{flag_id, value: "true" | "false"}`.
 */
export const ChoiceConditions = ({
  conditions,
  availableFlags,
  onAdd,
  onRemove,
  onCreateFlag,
}: ChoiceConditionsProps) => {
  const { t } = useTranslation();
  return (
    <FlagRuleList
      rules={conditions.map((c) => ({
        flag_id: c.flag_id,
        value: c.required_value ? ("true" as const) : ("false" as const),
      }))}
      availableFlags={availableFlags}
      valueOptions={[
        {
          value: "true" as const,
          label: t.conditions.mustBeTrue,
          badgeLabel: t.badges.true,
          tone: "positive",
        },
        {
          value: "false" as const,
          label: t.conditions.mustBeFalse,
          badgeLabel: t.badges.false,
          tone: "negative",
        },
      ]}
      onAdd={(flagId, value) => onAdd(flagId, value === "true")}
      onRemove={onRemove}
      onCreateFlag={onCreateFlag}
      addLabel={t.buttons.addCondition}
      valueLabel={t.labels.requiredValue}
      connector={` ${t.conditions.mustBe} `}
    />
  );
};
